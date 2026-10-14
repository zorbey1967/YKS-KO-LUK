-- İzole throwaway PostgreSQL. Canlıya bağlanmaz.
-- Roller transaction dışında kalır.

create extension if not exists pgcrypto;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email_confirmed_at timestamptz
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists public.profiles (
  id uuid primary key,
  name text,
  email text,
  plan text not null default 'Ücretsiz',
  role text not null default 'student',
  account_status text not null default 'active',
  updated_at timestamptz not null default now()
);

create table if not exists public.student_data (
  user_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text,
  photo text,
  track text,
  focus text,
  experience text,
  bio text,
  student_count integer default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_matches (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid,
  student_id uuid,
  status text not null default 'active'
);

create table if not exists public.appointments (
  id text primary key,
  coach_id uuid,
  student_id uuid,
  student_name text,
  date text,
  time text,
  minutes int,
  status text
);

create table if not exists public.meeting_rooms (
  appointment_id text primary key,
  status text,
  ended_at timestamptz,
  lesson_started_at timestamptz
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric,
  status text
);

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

create or replace function public.caller_account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_active_coach(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coaches c where c.id = p_id and c.status = 'active'
  );
$$;

create or replace function public.own_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.coaches c where c.user_id = auth.uid() limit 1;
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.caller_account_active() from public, anon;
grant execute on function public.caller_account_active() to authenticated;
grant execute on function public.own_coach_id() to authenticated;
grant execute on function public.is_active_coach(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.student_data enable row level security;
alter table public.student_data force row level security;
alter table public.appointments enable row level security;
alter table public.appointments force row level security;

drop policy if exists "profiles_own_select" on public.profiles;
create policy "profiles_own_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using (public.is_admin());

drop policy if exists "student_data_own_select" on public.student_data;
create policy "student_data_own_select" on public.student_data
  for select using (auth.uid() = user_id and public.caller_account_active());

drop policy if exists "student_data_own_write" on public.student_data;
create policy "student_data_own_write" on public.student_data
  for all using (auth.uid() = user_id and public.caller_account_active())
  with check (auth.uid() = user_id and public.caller_account_active());

revoke all on table public.profiles from public, anon;
grant select on table public.profiles to authenticated;
revoke all on table public.student_data from public, anon;
grant select, insert, update on table public.student_data to authenticated;
grant select on table public.appointments to authenticated;
grant select on table public.coach_matches to authenticated;
grant select on table public.coaches to authenticated;
grant select, insert, update on table public.profiles to postgres;
