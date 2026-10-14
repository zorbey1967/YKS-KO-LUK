-- Yerel / staging taslak. Production’a bu turda uygulanmaz.
-- 027–029 dosyalarına dokunulmaz. E-posta gömülmez. platform_owner satırı boş bırakılır;
-- UUID yalnızca SQL Editor / postgres ile yazılır (otomatik yükseltme yok).
-- Güvenlik: istemci GUC (yks.internal) ile üyelik kilidi aşılamaz.
-- Faturalama yazımı yalnızca current_user authenticated/anon dışındayken
-- (SECURITY DEFINER postgres / service_role) serbesttir.

alter table public.profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text,
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists billing_provider text not null default '',
  add column if not exists provider_customer_id text not null default '',
  add column if not exists provider_subscription_id text not null default '';

create table if not exists public.platform_owner (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.platform_owner enable row level security;
alter table public.platform_owner force row level security;
revoke all on table public.platform_owner from public, anon, authenticated;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_owner o
    join public.profiles p on p.id = o.user_id
    where o.user_id = auth.uid()
      and p.account_status = 'active'
  );
$$;

revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

create or replace function public.protect_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'Ücretsiz';
      new.trial_started_at := null;
      new.trial_ends_at := null;
      new.subscription_status := null;
      new.subscription_started_at := null;
      new.subscription_ends_at := null;
      new.billing_provider := '';
      new.provider_customer_id := '';
      new.provider_subscription_id := '';
    else
      new.plan := old.plan;
      new.trial_started_at := old.trial_started_at;
      new.trial_ends_at := old.trial_ends_at;
      new.subscription_status := old.subscription_status;
      new.subscription_started_at := old.subscription_started_at;
      new.subscription_ends_at := old.subscription_ends_at;
      new.billing_provider := coalesce(old.billing_provider, '');
      new.provider_customer_id := coalesce(old.provider_customer_id, '');
      new.provider_subscription_id := coalesce(old.provider_subscription_id, '');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan
  before insert or update on public.profiles
  for each row execute procedure public.protect_plan();

revoke all on function public.protect_plan() from public, anon, authenticated;

do $$
declare
  allowed text[] := array[]::text[];
  c text;
  candidates text[] := array[
    'name', 'email', 'target_department', 'target_rank', 'updated_at',
    'signup_intent', 'signup_grade', 'signup_track', 'signup_exam'
  ];
begin
  foreach c in array candidates loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = c
    ) then
      allowed := array_append(allowed, quote_ident(c));
    end if;
  end loop;
  execute 'revoke update on table public.profiles from public, anon, authenticated';
  if array_length(allowed, 1) is not null then
    execute format(
      'grant update (%s) on table public.profiles to authenticated',
      array_to_string(allowed, ', ')
    );
  end if;
end
$$;

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
  prow text;
  n int;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'trial_started_at'
  ) then
    raise exception 'üyelik şeması yok';
  end if;

  select p.trial_started_at, p.trial_ends_at, p.subscription_status, p.role
    into started, ends, st, prow
  from public.profiles p
  where p.id = uid
  for update;

  if not found then
    raise exception 'profil yok';
  end if;
  -- Koç / yönetici / diğer roller deneme açamaz. Sahip için ayrı yükseltme yok.
  if prow is distinct from 'student' then
    raise exception 'deneme yalnızca öğrenci hesabına özel';
  end if;

  if st = 'active' and exists (
    select 1 from public.profiles p2
    where p2.id = uid and (p2.subscription_ends_at is null or p2.subscription_ends_at > now())
  ) then
    return jsonb_build_object('ok', true, 'status', 'active', 'message', 'Ücretli üyelik açık; deneme gerekmez.');
  end if;

  if started is not null then
    return jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', case when ends is not null and ends > now() then 'Deneme zaten açık.' else 'Bu hesap denemeyi kullandı.' end
    );
  end if;

  update public.profiles
  set
    trial_started_at = now(),
    trial_ends_at = now() + interval '14 days',
    subscription_status = 'trialing',
    updated_at = now()
  where id = uid and trial_started_at is null;

  get diagnostics n = row_count;
  if n = 0 then
    select p.trial_started_at, p.trial_ends_at into started, ends from public.profiles p where p.id = uid;
    return jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', 'Deneme zaten kayıtlı.'
    );
  end if;

  select p.trial_started_at, p.trial_ends_at into started, ends from public.profiles p where p.id = uid;
  return jsonb_build_object(
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

create or replace function public.own_active_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.coaches c
  join public.profiles p on p.id = c.user_id
  where c.user_id = auth.uid()
    and c.status = 'active'
    and p.account_status = 'active'
  limit 1;
$$;

revoke all on function public.own_active_coach_id() from public, anon;
grant execute on function public.own_active_coach_id() to authenticated;

create table if not exists public.student_week_plans (
  student_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete set null,
  days jsonb not null default '[]'::jsonb,
  week_hours numeric not null default 0,
  notes text not null default '',
  lock text not null default 'self' check (lock in ('self', 'coach')),
  updated_at timestamptz not null default now()
);

alter table public.student_week_plans enable row level security;
alter table public.student_week_plans force row level security;

drop policy if exists "week_plan_select" on public.student_week_plans;
create policy "week_plan_select" on public.student_week_plans
  for select using (
    public.caller_account_active()
    and (
      student_id = auth.uid()
      or (coach_id is not null and coach_id = public.own_active_coach_id())
      or public.is_admin()
    )
  );

revoke all on table public.student_week_plans from public, anon, authenticated;
grant select on table public.student_week_plans to authenticated;

create or replace function public.upsert_student_week_plan(
  p_student uuid,
  p_days jsonb,
  p_week_hours numeric,
  p_notes text,
  p_lock text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  if p_student is null then
    raise exception 'öğrenci gerekli';
  end if;
  if p_lock not in ('self', 'coach') then
    raise exception 'geçersiz kilit';
  end if;

  cid := public.own_active_coach_id();
  if cid is not null then
    if not exists (
      select 1
      from public.coach_matches m
      where m.coach_id = cid
        and m.student_id = p_student
        and m.status = 'active'
    ) then
      raise exception 'bu öğrenci sana atanmadı';
    end if;
    insert into public.student_week_plans (student_id, coach_id, days, week_hours, notes, lock, updated_at)
    values (p_student, cid, coalesce(p_days, '[]'::jsonb), coalesce(p_week_hours, 0), coalesce(p_notes, ''), 'coach', now())
    on conflict (student_id) do update
      set coach_id = excluded.coach_id,
          days = excluded.days,
          week_hours = excluded.week_hours,
          notes = excluded.notes,
          lock = 'coach',
          updated_at = now();
    return;
  end if;

  if p_student is distinct from auth.uid() then
    raise exception 'yetkisiz';
  end if;

  if exists (
    select 1
    from public.coach_matches m
    join public.coaches c on c.id = m.coach_id
    join public.profiles p on p.id = c.user_id
    where m.student_id = auth.uid()
      and m.status = 'active'
      and c.status = 'active'
      and p.account_status = 'active'
  ) then
    raise exception 'aktif koçun varken planı sen değiştiremezsin';
  end if;

  insert into public.student_week_plans (student_id, coach_id, days, week_hours, notes, lock, updated_at)
  values (p_student, null, coalesce(p_days, '[]'::jsonb), coalesce(p_week_hours, 0), coalesce(p_notes, ''), 'self', now())
  on conflict (student_id) do update
    set days = excluded.days,
        week_hours = excluded.week_hours,
        notes = excluded.notes,
        lock = 'self',
        coach_id = null,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_student_week_plan(uuid, jsonb, numeric, text, text) from public, anon;
grant execute on function public.upsert_student_week_plan(uuid, jsonb, numeric, text, text) to authenticated;

create table if not exists public.exam_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text not null default '',
  exam_name text not null,
  correct integer not null default 0,
  wrong integer not null default 0,
  blank integer not null default 0,
  net numeric not null default 0,
  topics jsonb not null default '{}'::jsonb,
  verified_key boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.exam_reports enable row level security;
alter table public.exam_reports force row level security;

drop policy if exists "exam_reports_own" on public.exam_reports;
create policy "exam_reports_own" on public.exam_reports
  for all using (
    user_id = auth.uid()
    and public.caller_account_active()
  )
  with check (
    user_id = auth.uid()
    and public.caller_account_active()
  );

drop policy if exists "exam_reports_coach" on public.exam_reports;
create policy "exam_reports_coach" on public.exam_reports
  for select using (
    public.caller_account_active()
    and public.own_active_coach_id() is not null
    and exists (
      select 1 from public.coach_matches m
      where m.student_id = exam_reports.user_id
        and m.coach_id = public.own_active_coach_id()
        and m.status = 'active'
    )
  );

revoke all on table public.exam_reports from public, anon;
grant select, insert on table public.exam_reports to authenticated;

create or replace function public.protect_exam_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.verified_key := false;
    if auth.uid() is not null then
      new.user_id := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists exam_reports_protect on public.exam_reports;
create trigger exam_reports_protect
  before insert or update on public.exam_reports
  for each row execute procedure public.protect_exam_report();

revoke all on function public.protect_exam_report() from public, anon, authenticated;

create table if not exists public.exam_scan_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  n integer not null default 0,
  primary key (user_id, window_start),
  constraint exam_scan_quota_n_check check (n >= 0)
);

alter table public.exam_scan_quota enable row level security;
alter table public.exam_scan_quota force row level security;
revoke all on table public.exam_scan_quota from public, anon, authenticated;

create or replace function public.take_exam_scan_slot()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  win timestamptz := date_trunc('hour', now());
  got integer;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;

  insert into public.exam_scan_quota (user_id, window_start, n)
  values (uid, win, 1)
  on conflict (user_id, window_start) do update
    set n = public.exam_scan_quota.n + 1
    where public.exam_scan_quota.n < 8
  returning public.exam_scan_quota.n into got;

  if got is null then
    raise exception 'analiz kotası doldu';
  end if;
  return got;
end;
$$;

revoke all on function public.take_exam_scan_slot() from public, anon;
grant execute on function public.take_exam_scan_slot() to authenticated;
