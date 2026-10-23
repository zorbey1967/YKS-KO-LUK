-- 055: Ticari açılış öncesi güvenlik + üyelik düzeltmeleri (tek dosya, additive, idempotent).
--
-- 050–054 (içerik denetimi, STT, OAuth niyeti, canlı e-posta hotfix'i, ödeme v2) bu dosyadan
-- önce çalışır. 055 onların kurallarını korur ve aşağıdakileri tek yerde birleştirir.
-- Canlı şema 001–010 + MCP parçaları (prod_*) + 041–049 (+ 053) ile kuruldu; 011–040 zinciri
-- canlıda toplu uygulanmadı. Bu dosya iki durumda da aynı sonucu verir. Satır silmez,
-- tablo/kolon düşürmez.
--
--  1. profiles: istemci yalnızca kendi satırını okuyabilir ve yalnızca ad / hedef alanlarını
--     güncelleyebilir. INSERT, DELETE ve e-posta / rol / plan / üyelik kolonlarına yazma kapalı.
--     (001'deki "profiles_own_upsert" FOR ALL politikası kaldırılır.)
--  2. protect_role / handle_new_user: e-posta ile yönetici atama yok (053 ile aynı kural;
--     istemci rol / durum / e-posta değiştiremez). handle_new_user 052'deki OAuth niyet
--     kuralını korur ve kayıttaki ad-soyad, sınıf, alan ve sınav bilgisini profile yazar.
--     Yeni öğrenci hemen aktif (053 ile aynı). Onaylı koçların profil rolü bir kez 'coach' yapılır.
--  3. apply_verified_payment (054'ün yerine, kurallarını içerir):
--       * aynı ödeme tekrar gelirse (succeeded / refunded) hiçbir şey yazılmaz;
--       * daha eski bir ödeme oturumu, daha yeni aktif farklı paketi düşüremez (late_payment);
--       * süresi bitmemiş ücretli üyelikte yeni 30 gün mevcut bitişin üstüne eklenir; paket
--         değişiminde (Pro → Premium) de kalan gün korunur;
--       * her ödeme kapsadığı aralığı (covers_start / covers_end) kaydeder (iade için).
--  4. apply_payment_refund (yeni, yalnız sunucu): tam iadede o ödemenin kapsadığı süre düşülür,
--     kalan süre yoksa erişim kapanır. Kısmi iade erişimi değiştirmez. Tekrar bildirim etkisiz.
--  5. start_top_plan_trial: e-postası doğrulanmamış hesap deneme başlatamaz.
--  6. Yönetici ödeme listeleri: search_path sabit, yalnız is_admin(); iade/kapsam alanları eklenir.
--
-- Önkoşul: 041–049 (042 caller_account_active, billing_* tabloları), 050–054.
-- Önce `npm run test:pg:commercial` ile throwaway PostgreSQL'de prova edilir.

-- 1) profiles ------------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles_own_upsert" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_own_select'
  ) then
    execute 'create policy "profiles_own_select" on public.profiles for select using (auth.uid() = id)';
  end if;
end
$$;

revoke insert, update, delete, truncate on table public.profiles from public, anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.column_name)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name in ('name', 'target_department', 'target_rank', 'updated_at');
  if cols is not null then
    execute format('grant update (%s) on table public.profiles to authenticated', cols);
  end if;
end
$$;

-- 2) Rol ve kayıt --------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'active'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- auth.uid() null: Auth tetikleyicisi / service_role. İstemci asla admin/koç açamaz (053).
    if auth.uid() is not null and not public.is_admin() then
      new.role := 'student';
    else
      new.role := coalesce(nullif(new.role, ''), 'student');
      if new.role not in ('student', 'coach') then
        new.role := 'student';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_admin() then
      new.role := old.role;
      new.account_status := old.account_status;
      new.email := old.email;
    elsif new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    elsif old.role = 'admin' and new.role is distinct from 'admin' then
      new.role := 'admin';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_role() from public, anon, authenticated;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute procedure public.protect_role();

alter table public.profiles
  add column if not exists signup_intent text,
  add column if not exists signup_grade text,
  add column if not exists signup_track text,
  add column if not exists signup_exam text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text;
  intent text;
  blocked boolean := false;
begin
  full_name := trim(concat_ws(' ', nullif(trim(meta->>'first_name'), ''), nullif(trim(meta->>'last_name'), '')));
  if full_name = '' then
    full_name := trim(coalesce(meta->>'name', meta->>'full_name', ''));
  end if;
  full_name := left(regexp_replace(full_name, '\s+', ' ', 'g'), 80);
  -- 011'deki ad filtresi canlıda olmayabilir; varsa kullanılır, yoksa kayıt yine çalışır.
  if full_name <> '' and pg_catalog.to_regprocedure('public.person_name_blocked(text)') is not null then
    execute 'select public.person_name_blocked($1)' into blocked using full_name;
    if coalesce(blocked, false) then
      full_name := '';
    end if;
  end if;
  intent := lower(coalesce(nullif(trim(meta->>'intent'), ''), 'student'));
  if intent not in ('student', 'coach') then
    intent := 'student';
  end if;

  insert into public.profiles (
    id, email, name, role, account_status,
    signup_intent, signup_grade, signup_track, signup_exam
  ) values (
    new.id,
    new.email,
    full_name,
    'student',
    'active',
    intent,
    left(coalesce(meta->>'grade', ''), 40),
    left(coalesce(meta->>'track', ''), 40),
    left(coalesce(meta->>'exam', ''), 40)
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case when public.profiles.role = 'admin' then 'admin' else public.profiles.role end,
        name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
        -- 052: niyet yalnız hâlâ varsayılan öğrenci iken ve meta gelmişse güncellenir.
        signup_intent = case
          when public.profiles.role = 'admin' then public.profiles.signup_intent
          when coalesce(public.profiles.signup_intent, '') in ('', 'student')
            and excluded.signup_intent in ('student', 'coach')
            then excluded.signup_intent
          else public.profiles.signup_intent
        end,
        signup_grade = coalesce(nullif(public.profiles.signup_grade, ''), excluded.signup_grade),
        signup_track = coalesce(nullif(public.profiles.signup_track, ''), excluded.signup_track),
        signup_exam = coalesce(nullif(public.profiles.signup_exam, ''), excluded.signup_exam);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- (Kaldırıldı, 063: tek hesap modelinde onaylı koçun profil rolü 'student' kalır.)

-- 3) Ödeme: yenileme ve paket değişimi ----------------------------------------------------

alter table public.billing_payments
  add column if not exists plan_id text,
  add column if not exists covers_start timestamptz,
  add column if not exists covers_end timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_total_try numeric(12,2);

alter table public.billing_subscriptions
  add column if not exists canceled_at timestamptz;

create or replace function public.apply_verified_payment(
  p_user_id uuid,
  p_plan_id text,
  p_provider text,
  p_payment_id text,
  p_amount_try numeric,
  p_checkout_id uuid default null,
  p_subscription_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := pg_catalog.clock_timestamp();
  prev_status text;
  prev_uid uuid;
  pay_amt numeric;
  pay_cur text;
  chk_amt numeric;
  chk_cur text;
  chk_uid uuid;
  chk_created timestamptz;
  cur_plan text;
  cur_status text;
  cur_start timestamptz;
  cur_end timestamptz;
  cur_provider text;
  cur_sub_id text;
  cur_created timestamptz;
  base timestamptz;
  starts timestamptz;
  ends timestamptz;
  extended boolean := false;
begin
  if p_user_id is null or p_payment_id is null or p_provider is null then
    raise exception 'eksik ödeme kimliği';
  end if;
  if p_plan_id not in ('pro', 'premium') then
    raise exception 'paket_yok';
  end if;
  if p_amount_try is null or p_amount_try <= 0 then
    raise exception 'tutar_gecersiz';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || p_user_id::text));

  if p_checkout_id is not null then
    select s.amount_try, s.currency, s.user_id, s.created_at
      into chk_amt, chk_cur, chk_uid, chk_created
    from public.billing_checkout_sessions s
    where s.id = p_checkout_id;
    if not found then
      raise exception 'oturum_yok';
    end if;
    if chk_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    if upper(coalesce(chk_cur, 'TRY')) is distinct from 'TRY' then
      raise exception 'para_birimi';
    end if;
    if abs(coalesce(chk_amt, 0) - p_amount_try) > 0.009 then
      raise exception 'tutar_uyusmuyor';
    end if;
  end if;

  -- 054: aynı ödeme daha önce işlendiyse (başarılı ya da iade edilmiş) hiçbir şey yazılmaz.
  select p.status, p.user_id, p.amount_try, p.currency
    into prev_status, prev_uid, pay_amt, pay_cur
  from public.billing_payments p
  where p.provider = p_provider and p.provider_payment_id = p_payment_id;
  if found then
    if abs(coalesce(pay_amt, 0) - p_amount_try) > 0.009 or upper(coalesce(pay_cur, '')) is distinct from 'TRY' then
      raise exception 'tutar_uyusmuyor';
    end if;
    if prev_status in ('succeeded', 'refunded') then
      select s.period_end into cur_end
      from public.billing_subscriptions s
      where s.user_id = p_user_id;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', true,
        'late_payment', false,
        'extended', false,
        'period_end', cur_end
      );
    end if;
    if prev_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
  end if;

  select s.plan_id, s.status, s.period_start, s.period_end, s.provider, s.provider_subscription_id
    into cur_plan, cur_status, cur_start, cur_end, cur_provider, cur_sub_id
  from public.billing_subscriptions s
  where s.user_id = p_user_id
  for update;

  -- 054: daha eski bir ödeme oturumu, daha yeni aktif farklı paketi düşüremez.
  -- Ödeme kaydedilir (para alındı), üyelik değişmez; webhook inceleme olayı yazar.
  if cur_plan is not null
     and cur_status = 'active'
     and cur_end is not null and cur_end > now_ts
     and cur_plan is distinct from p_plan_id
     and chk_created is not null
     and coalesce(cur_sub_id, '') <> '' then
    select cs.created_at into cur_created
      from public.billing_payments bp
      join public.billing_checkout_sessions cs on cs.id = bp.checkout_session_id
     where bp.user_id = p_user_id
       and bp.provider = cur_provider
       and bp.provider_payment_id = cur_sub_id;
    if cur_created is not null and chk_created < cur_created then
      insert into public.billing_payments (
        user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id, plan_id
      ) values (
        p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id, p_plan_id
      )
      on conflict (provider, provider_payment_id) do update
        set status = 'succeeded',
            plan_id = excluded.plan_id,
            checkout_session_id = coalesce(public.billing_payments.checkout_session_id, excluded.checkout_session_id);
      if p_checkout_id is not null then
        update public.billing_checkout_sessions
          set status = 'paid', updated_at = now_ts
          where id = p_checkout_id;
      end if;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', false,
        'late_payment', true,
        'extended', false,
        'period_end', cur_end
      );
    end if;
  end if;

  -- Süresi bitmemiş ücretli üyelik varsa yeni 30 gün onun bitişinden başlar; paket değişse de
  -- kalan gün korunur.
  if cur_status = 'active' and cur_end is not null and cur_end > now_ts then
    base := cur_end;
    starts := coalesce(cur_start, now_ts);
    extended := true;
  else
    base := now_ts;
    starts := now_ts;
  end if;
  ends := base + interval '30 days';

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id,
    plan_id, covers_start, covers_end
  ) values (
    p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id,
    p_plan_id, base, ends
  )
  on conflict (provider, provider_payment_id) do update
    -- Yalnız eski pending / failed / canceled kayıt buraya gelir (yukarıda elendi).
    set status = 'succeeded',
        plan_id = excluded.plan_id,
        covers_start = excluded.covers_start,
        covers_end = excluded.covers_end,
        checkout_session_id = coalesce(public.billing_payments.checkout_session_id, excluded.checkout_session_id);

  insert into public.billing_subscriptions (
    user_id, plan_id, status, period_start, period_end, provider,
    provider_subscription_id, locked_amount_try, currency, updated_at
  ) values (
    p_user_id, p_plan_id, 'active', starts, ends, p_provider,
    coalesce(nullif(p_subscription_id, ''), p_payment_id), p_amount_try, 'TRY', now_ts
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    locked_amount_try = excluded.locked_amount_try,
    currency = 'TRY',
    canceled_at = null,
    updated_at = now_ts;

  if p_checkout_id is not null then
    update public.billing_checkout_sessions
      set status = 'paid', updated_at = now_ts
      where id = p_checkout_id;
  end if;

  update public.profiles
    set
      plan = p_plan_id,
      subscription_status = 'active',
      subscription_started_at = starts,
      subscription_ends_at = ends,
      billing_provider = p_provider,
      provider_subscription_id = coalesce(nullif(p_subscription_id, ''), p_payment_id),
      updated_at = pg_catalog.now()
    where id = p_user_id
      and role = 'student';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicate_payment', false,
    'late_payment', false,
    'extended', extended,
    'period_end', ends
  );
end;
$$;
revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated;

-- 4) İade ---------------------------------------------------------------------------------

create or replace function public.apply_payment_refund(
  p_provider text,
  p_payment_id text,
  p_refunded_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
  sub_end timestamptz;
  covered interval;
  new_end timestamptz;
  revoked boolean := false;
  now_ts timestamptz := pg_catalog.clock_timestamp();
begin
  if p_provider is null or p_payment_id is null then
    raise exception 'eksik ödeme kimliği';
  end if;

  select * into pay
  from public.billing_payments p
  where p.provider = p_provider and p.provider_payment_id = p_payment_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'odeme_yok');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || pay.user_id::text));
  select * into pay from public.billing_payments p where p.id = pay.id for update;

  if pay.status = 'refunded' then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'zaten_iade', 'duplicate', true);
  end if;
  if pay.status <> 'succeeded' then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'odeme_basarili_degil');
  end if;

  if coalesce(p_refunded_total, 0) + 0.009 < pay.amount_try then
    update public.billing_payments
      set refunded_total_try = greatest(coalesce(refunded_total_try, 0), coalesce(p_refunded_total, 0))
      where id = pay.id;
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'kismi_iade', 'refunded_total', p_refunded_total);
  end if;

  update public.billing_payments
    set status = 'refunded', refunded_at = now_ts, refunded_total_try = coalesce(p_refunded_total, pay.amount_try)
    where id = pay.id;

  covered := case
    when pay.covers_start is not null and pay.covers_end is not null then pay.covers_end - pay.covers_start
    else interval '30 days'
  end;

  select s.period_end into sub_end from public.billing_subscriptions s where s.user_id = pay.user_id for update;
  if sub_end is not null then
    new_end := sub_end - covered;
    if new_end <= now_ts then
      revoked := true;
      update public.billing_subscriptions
        set status = 'canceled', period_end = now_ts, canceled_at = now_ts, updated_at = now_ts
        where user_id = pay.user_id;
      update public.profiles
        set subscription_status = 'canceled', subscription_ends_at = now_ts, updated_at = pg_catalog.now()
        where id = pay.user_id and role = 'student';
    else
      update public.billing_subscriptions
        set period_end = new_end, updated_at = now_ts
        where user_id = pay.user_id;
      update public.profiles
        set subscription_ends_at = new_end, updated_at = pg_catalog.now()
        where id = pay.user_id and role = 'student' and subscription_status = 'active';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'applied', true,
    'revoked', revoked,
    'period_end', case when revoked then now_ts else new_end end
  );
end;
$$;
revoke all on function public.apply_payment_refund(text, text, numeric) from public, anon, authenticated;

-- 5) Deneme -------------------------------------------------------------------------------
-- Durum makinesi src/lib/trialStart.ts startTopPlanTrialStep ile aynı; ek olarak e-posta doğrulaması.

create or replace function public.start_top_plan_trial()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  started timestamptz;
  ends timestamptz;
  st text;
  sub_ends timestamptz;
  prow text;
  n int;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;

  select p.trial_started_at, p.trial_ends_at, p.subscription_status, p.subscription_ends_at, p.role
    into started, ends, st, sub_ends, prow
  from public.profiles p
  where p.id = uid
  for update;
  if not found then
    raise exception 'profil yok';
  end if;

  -- Yönetici test hesabı: yalnızca mevcut deneme kaydı okunur, yeni deneme yazılmaz.
  if prow = 'admin' then
    if started is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
        'trial_started_at', started,
        'trial_ends_at', ends,
        'message', case when ends is not null and ends > pg_catalog.now() then 'Deneme zaten açık.' else 'Bu hesap denemeyi kullandı.' end
      );
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'deneme yalnızca öğrenci hesabına özel');
  end if;
  if prow is distinct from 'student' then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'deneme yalnızca öğrenci hesabına özel');
  end if;

  if st = 'active' and (sub_ends is null or sub_ends > pg_catalog.now()) then
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'active', 'message', 'Ücretli üyelik açık; deneme gerekmez.');
  end if;

  if started is not null then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', case when ends is not null and ends > pg_catalog.now() then 'Deneme zaten açık.' else 'Bu hesap denemeyi kullandı.' end
    );
  end if;

  if not exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'Deneme için önce e-posta adresini doğrula.');
  end if;

  update public.profiles
  set
    trial_started_at = pg_catalog.now(),
    trial_ends_at = pg_catalog.now() + interval '14 days',
    subscription_status = 'trialing',
    updated_at = pg_catalog.now()
  where id = uid and trial_started_at is null;
  get diagnostics n = row_count;

  select p.trial_started_at, p.trial_ends_at into started, ends from public.profiles p where p.id = uid;
  if n = 0 then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', 'Deneme zaten kayıtlı.'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 'trialing',
    'trial_started_at', started,
    'trial_ends_at', ends,
    'plan', 'premium',
    'message', '14 günlük Premium deneme başladı. Ücret alınmadı.'
  );
end;
$$;
revoke all on function public.start_top_plan_trial() from public, anon;
grant execute on function public.start_top_plan_trial() to authenticated;

-- 6) Yönetici ödeme görünümü --------------------------------------------------------------

drop function if exists public.admin_list_payments();
create function public.admin_list_payments()
returns table (
  id uuid,
  user_id uuid,
  email text,
  amount_try numeric,
  currency text,
  status text,
  provider text,
  provider_payment_id text,
  plan_id text,
  covers_end timestamptz,
  refunded_at timestamptz,
  refunded_total_try numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id, p.user_id, pr.email, p.amount_try, p.currency, p.status, p.provider,
    p.provider_payment_id, p.plan_id, p.covers_end, p.refunded_at, p.refunded_total_try, p.created_at
  from public.billing_payments p
  left join public.profiles pr on pr.id = p.user_id
  order by p.created_at desc
  limit 200;
end;
$$;
revoke all on function public.admin_list_payments() from public, anon;
grant execute on function public.admin_list_payments() to authenticated;

drop function if exists public.admin_list_billing();
create function public.admin_list_billing()
returns table (
  id uuid,
  name text,
  email text,
  plan text,
  subscription_status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  account_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id, p.name, p.email, p.plan, p.subscription_status,
    p.trial_started_at, p.trial_ends_at, p.subscription_ends_at, p.account_status
  from public.profiles p
  where p.role = 'student'
  order by p.updated_at desc;
end;
$$;
revoke all on function public.admin_list_billing() from public, anon;
grant execute on function public.admin_list_billing() to authenticated;

create or replace function public.admin_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_n int;
  trial_n int;
  fail_n int;
  cancel_n int;
  refund_n int;
  verified numeric;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select count(*) into active_n from public.profiles
    where role = 'student' and subscription_status = 'active'
      and (subscription_ends_at is null or subscription_ends_at > pg_catalog.now());
  select count(*) into trial_n from public.profiles
    where role = 'student' and subscription_status = 'trialing'
      and trial_ends_at is not null and trial_ends_at > pg_catalog.now();
  select count(*) into fail_n from public.billing_payments where status = 'failed';
  select count(*) into cancel_n from public.profiles
    where role = 'student' and subscription_status = 'canceled';
  select count(*) into refund_n from public.billing_payments where status = 'refunded';
  select coalesce(sum(amount_try), 0) into verified
    from public.billing_payments where status = 'succeeded';
  return pg_catalog.jsonb_build_object(
    'active', active_n,
    'trialing', trial_n,
    'failed_payments', fail_n,
    'canceled', cancel_n,
    'refunded', refund_n,
    'verified_total_try', verified
  );
end;
$$;
revoke all on function public.admin_billing_overview() from public, anon;
grant execute on function public.admin_billing_overview() to authenticated;
