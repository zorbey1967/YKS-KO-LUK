-- Additive production schema (helpers only in this file).
-- Live MCP chunks (already applied): prod_helper_fns_profile_cols, prod_zorro_history,
-- prod_weekplan_exam_reports, prod_coach_homeworks, prod_billing_tables_rpcs,
-- prod_library_meeting_admin_tables, prod_recordings_admin_notes_finance.
-- 043: apply_verified_payment + Shopier unique index (service_role only).
-- Does not replace start_top_plan_trial, protect_plan, handle_new_user, request_appointment.
-- No DROP TABLE/COLUMN. No user-row DELETE. No 011/027/032/039/040 wholesale applies.

alter table public.profiles
  add column if not exists signup_intent text,
  add column if not exists signup_grade text,
  add column if not exists signup_track text,
  add column if not exists signup_exam text,
  add column if not exists approval_note text,
  add column if not exists billing_provider text not null default '',
  add column if not exists provider_customer_id text not null default '',
  add column if not exists provider_subscription_id text not null default '';

alter table public.appointments
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_decision text;

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
set search_path to ''
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

create or replace function public.caller_account_active()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select p.account_status = 'active' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
revoke all on function public.caller_account_active() from public, anon;
grant execute on function public.caller_account_active() to authenticated;

create or replace function public.own_active_coach_id()
returns uuid
language sql
stable
security definer
set search_path to ''
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

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
