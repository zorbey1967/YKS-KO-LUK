-- Yalnızca yerel/test PostgreSQL. Üretimde çalıştırmayın.
-- Roller transaction dışında kalır; throwaway veritabanı kullanın.

do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;

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
  updated_at timestamptz not null default now(),
  constraint profiles_account_status_check check (account_status in ('active', 'pasif'))
);

create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid,
  starts_at timestamptz,
  status text
);

create table if not exists public.appointments (
  id text primary key,
  coach_id uuid,
  student_id uuid,
  student_name text,
  date text,
  time text,
  minutes int,
  status text,
  availability_id uuid,
  starts_at timestamptz
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
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

create or replace function public.is_active_coach(p_id uuid)
returns boolean language sql stable as $$ select false $$;

create or replace function public.profile_display_name(p_id uuid)
returns text language sql stable as $$ select 'test' $$;

create or replace function public.istanbul_date(p_ts timestamptz)
returns text language sql stable as $$ select '2026-01-01' $$;

create or replace function public.istanbul_time(p_ts timestamptz)
returns text language sql stable as $$ select '12:00' $$;

create table if not exists public.meeting_rooms (
  appointment_id text primary key,
  status text,
  ended_at timestamptz,
  lesson_started_at timestamptz
);

-- 009 politikası (üyelik yok): yalnızca oturum + taraf + onay. Staging ürün kararı ayrı.
create or replace function public.can_join_meeting(p_appointment_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_appointment_id is null or length(p_appointment_id) < 4 then
    return false;
  end if;
  select * into appt from public.appointments where id = p_appointment_id;
  if not found or appt.status is distinct from 'onay' then
    return false;
  end if;
  if appt.student_id is distinct from auth.uid() and appt.coach_id is distinct from auth.uid() then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.can_join_meeting(text) from public, anon;
grant execute on function public.can_join_meeting(text) to authenticated;
