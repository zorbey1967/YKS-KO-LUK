-- apply_verified_payment v2. 043 dosyası değiştirilmez; imza ve parametreler aynı (edge çağrısı değişmez).
-- 1) Aynı (provider, provider_payment_id) zaten succeeded/refunded ise abonelik, profil ve oturum
--    yeniden yazılmaz; duplicate_payment = true ve mevcut period_end döner. Tekrar/gecikmiş webhook
--    planı düşürmez, iptal edilmiş üyeliği yeniden active yapmaz.
-- 2) Aynı plan aktifken yenileme: period_end = greatest(period_end, now()) + 30 gün (kalan gün korunur).
-- 3) Farklı plan (yükseltme/düşürme) ve abonelik satırı olmayan (deneme) durum 043 ile aynı: now() + 30 gün.
--    Proration yok.
-- 4) İlk kez gelen ama daha eski bir ödeme oturumuna ait ödeme, daha yeni oturumla açılmış aktif farklı
--    planı düşürmez: ödeme kaydı ve oturum paid yazılır, abonelik/profil değişmez, late_payment = true.
-- authenticated/anon EXECUTE yok. Satır silme yok.

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
set search_path to ''
as $$
declare
  now_ts timestamptz := pg_catalog.clock_timestamp();
  inserted int := 0;
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
  starts timestamptz;
  ends timestamptz;
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

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (
    p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id
  )
  on conflict (provider, provider_payment_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    select p.status, p.user_id, p.amount_try, p.currency
      into prev_status, prev_uid, pay_amt, pay_cur
    from public.billing_payments p
    where p.provider = p_provider and p.provider_payment_id = p_payment_id;
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
        'period_end', cur_end
      );
    end if;

    -- Eski pending/failed/canceled kayıt: aynı öğrenciye aitse doğrulanmış ödeme olarak işlenir.
    if prev_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    update public.billing_payments
      set status = 'succeeded',
          checkout_session_id = coalesce(checkout_session_id, p_checkout_id)
      where provider = p_provider and provider_payment_id = p_payment_id;
  end if;

  select s.plan_id, s.status, s.period_start, s.period_end, s.provider, s.provider_subscription_id
    into cur_plan, cur_status, cur_start, cur_end, cur_provider, cur_sub_id
    from public.billing_subscriptions s
   where s.user_id = p_user_id;

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
      if p_checkout_id is not null then
        update public.billing_checkout_sessions
          set status = 'paid', updated_at = now_ts
          where id = p_checkout_id;
      end if;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', false,
        'late_payment', true,
        'period_end', cur_end
      );
    end if;
  end if;

  if cur_plan is not null
     and cur_status = 'active'
     and cur_plan = p_plan_id
     and cur_end is not null then
    starts := case when cur_end > now_ts then coalesce(cur_start, now_ts) else now_ts end;
    ends := greatest(cur_end, now_ts) + interval '30 days';
  else
    starts := now_ts;
    ends := now_ts + interval '30 days';
  end if;

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
    'period_end', ends
  );
end;
$$;

revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated;
