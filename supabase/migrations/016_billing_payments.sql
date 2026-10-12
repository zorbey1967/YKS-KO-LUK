-- Ödeme kayıtları, iptal talebi, tutar kilidi.
-- 013’e ek. PRODUCTION’A bu adımda uygulanmaz.
-- İstemci plan/ödeme durumu yazamaz (protect_plan + RLS).

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('pro', 'premium')),
  amount_try numeric(12,2) not null check (amount_try > 0),
  currency text not null default 'TRY',
  status text not null default 'pending' check (
    status in ('pending', 'redirected', 'paid', 'failed', 'canceled', 'expired')
  ),
  provider text not null default '',
  provider_session_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('pro', 'premium')),
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete')
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  provider text not null default '',
  provider_subscription_id text not null default '',
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  locked_amount_try numeric(12,2),
  currency text not null default 'TRY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id uuid references public.billing_checkout_sessions(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  amount_try numeric(12,2) not null,
  currency text not null default 'TRY',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
  provider text not null,
  provider_payment_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table if not exists public.billing_cancel_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'processed', 'dismissed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_user_idx on public.billing_payments (user_id, created_at desc);
create index if not exists billing_checkout_user_idx on public.billing_checkout_sessions (user_id, created_at desc);
create index if not exists billing_cancel_user_idx on public.billing_cancel_requests (user_id, created_at desc);

alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_cancel_requests enable row level security;

revoke all on public.billing_checkout_sessions from anon, public;
revoke all on public.billing_subscriptions from anon, public;
revoke all on public.billing_payments from anon, public;
revoke all on public.billing_cancel_requests from anon, public;

grant select on public.billing_checkout_sessions to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_payments to authenticated;
grant select, insert on public.billing_cancel_requests to authenticated;

drop policy if exists billing_checkout_own_select on public.billing_checkout_sessions;
create policy billing_checkout_own_select on public.billing_checkout_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists billing_subs_own_select on public.billing_subscriptions;
create policy billing_subs_own_select on public.billing_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists billing_pay_own_select on public.billing_payments;
create policy billing_pay_own_select on public.billing_payments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists billing_cancel_own_select on public.billing_cancel_requests;
create policy billing_cancel_own_select on public.billing_cancel_requests
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists billing_cancel_own_insert on public.billing_cancel_requests;
create policy billing_cancel_own_insert on public.billing_cancel_requests
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'open');

-- İstemci plan/deneme/abonelik yazamaz; denemeyi sıfırlayamaz.
create or replace function public.protect_plan()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
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

-- Deneme yalnızca bir kez (admin_review_student 013 ile aynı kural).
create or replace function public.request_subscription_cancel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.role = 'student') then
    raise exception 'yalnızca öğrenci';
  end if;
  insert into public.billing_cancel_requests (user_id, status)
  values (uid, 'open');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_subscription_cancel() from public, anon;
grant execute on function public.request_subscription_cancel() to authenticated;

create or replace function public.admin_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_n int;
  trial_n int;
  fail_n int;
  cancel_n int;
  verified numeric;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select count(*) into active_n from public.profiles
    where role = 'student' and subscription_status = 'active';
  select count(*) into trial_n from public.profiles
    where role = 'student' and subscription_status = 'trialing'
      and trial_ends_at is not null and trial_ends_at > now();
  select count(*) into fail_n from public.billing_payments where status = 'failed';
  select count(*) into cancel_n from public.profiles
    where role = 'student' and subscription_status = 'canceled';
  select coalesce(sum(amount_try), 0) into verified
    from public.billing_payments where status = 'succeeded';
  return jsonb_build_object(
    'active', active_n,
    'trialing', trial_n,
    'failed_payments', fail_n,
    'canceled', cancel_n,
    'verified_total_try', verified
  );
end;
$$;

revoke all on function public.admin_billing_overview() from public, anon;
grant execute on function public.admin_billing_overview() to authenticated;
