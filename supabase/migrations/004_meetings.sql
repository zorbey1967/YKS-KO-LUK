-- Aşama A0: randevu zaman penceresi + görüşme odası kaydı.
-- Görüntülü bağlantı (LiveKit) ve kayıt YOKTUR. recording_enabled her zaman false.
-- Bu dosya otomatik uygulanmaz. Supabase SQL Editor veya onaylı CLI ile çalıştırın.
-- 003_coaches.sql gerekir. 001/002/003 değiştirilmez.
-- EXECUTE: appointment_is_party (RLS), can_join_meeting, ensure_meeting_room.
-- appointment_in_join_window authenticated EXECUTE almaz.

alter table public.appointments
  add column if not exists starts_at timestamptz,
  add column if not exists join_before_min integer not null default 10,
  add column if not exists join_after_min integer not null default 15;

alter table public.appointments drop constraint if exists appointments_join_before_check;
alter table public.appointments add constraint appointments_join_before_check
  check (join_before_min >= 0 and join_before_min <= 120);

alter table public.appointments drop constraint if exists appointments_join_after_check;
alter table public.appointments add constraint appointments_join_after_check
  check (join_after_min >= 0 and join_after_min <= 180);

create or replace function public.appointment_starts_at(p_date date, p_time text)
returns timestamptz
language sql
immutable
as $$
  select timezone('Europe/Istanbul', (p_date::text || ' ' || coalesce(nullif(trim(p_time), ''), '00:00'))::timestamp);
$$;

create or replace function public.appointments_fill_starts_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.join_before_min := 10;
      new.join_after_min := 15;
    end if;
  elsif not public.is_admin() then
    new.join_before_min := old.join_before_min;
    new.join_after_min := old.join_after_min;
  end if;
  new.starts_at := public.appointment_starts_at(new.date, new.time);
  return new;
end;
$$;

drop trigger if exists appointments_fill_starts_at on public.appointments;
create trigger appointments_fill_starts_at
  before insert or update on public.appointments
  for each row execute procedure public.appointments_fill_starts_at();

update public.appointments
  set starts_at = public.appointment_starts_at(date, time)
  where starts_at is null;

create table if not exists public.meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null unique references public.appointments(id) on delete cascade,
  status text not null default 'idle',
  recording_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_rooms_status_check check (status in ('idle', 'waiting', 'live', 'ended', 'blocked')),
  constraint meeting_rooms_no_recording_check check (recording_enabled = false)
);

create index if not exists meeting_rooms_appointment_idx on public.meeting_rooms (appointment_id);

create or replace function public.meeting_appointment_id_ok(p_appointment_id text)
returns boolean
language sql
immutable
as $$
  select p_appointment_id is not null
    and length(trim(p_appointment_id)) > 0
    and length(p_appointment_id) <= 80;
$$;

create or replace function public.appointment_is_party(p_appointment_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.meeting_appointment_id_ok(p_appointment_id)
    and auth.uid() is not null
    and exists (
      select 1
      from public.appointments a
      join public.coaches c on c.id = a.coach_id
      where a.id = p_appointment_id
        and (
          a.student_id = auth.uid()
          or c.user_id = auth.uid()
        )
    );
$$;

create or replace function public.appointment_in_join_window(p_appointment_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.appointment_is_party(p_appointment_id)
    and exists (
      select 1
      from public.appointments a
      where a.id = p_appointment_id
        and a.status = 'onay'
        and a.starts_at is not null
        and now() >= a.starts_at - make_interval(mins => a.join_before_min)
        and now() <= a.starts_at + make_interval(mins => a.minutes + a.join_after_min)
    );
$$;

create or replace function public.can_join_meeting(p_appointment_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.meeting_appointment_id_ok(p_appointment_id) then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'active'
  ) then
    return false;
  end if;
  if not public.appointment_is_party(p_appointment_id) then
    return false;
  end if;
  if exists (
    select 1
    from public.appointments a
    join public.coaches c on c.id = a.coach_id
    where a.id = p_appointment_id
      and c.user_id = auth.uid()
      and c.status is distinct from 'active'
  ) then
    return false;
  end if;
  return public.appointment_in_join_window(p_appointment_id);
end;
$$;

create or replace function public.ensure_meeting_room(p_appointment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.meeting_rooms;
begin
  if not public.meeting_appointment_id_ok(p_appointment_id) then
    raise exception 'geçersiz randevu';
  end if;
  if not public.can_join_meeting(p_appointment_id) then
    raise exception 'görüşme için yetki veya zaman yok';
  end if;

  insert into public.meeting_rooms (appointment_id, status, recording_enabled)
  values (p_appointment_id, 'waiting', false)
  on conflict (appointment_id) do update
    set updated_at = now(),
        recording_enabled = false,
        status = case
          when public.meeting_rooms.status = 'ended' then public.meeting_rooms.status
          when public.meeting_rooms.status = 'blocked' then public.meeting_rooms.status
          else 'waiting'
        end
  returning * into room;

  if room.status in ('ended', 'blocked') then
    raise exception 'görüşme kapalı';
  end if;

  return jsonb_build_object(
    'id', room.id,
    'appointment_id', room.appointment_id,
    'status', room.status,
    'recording_enabled', false
  );
end;
$$;

alter table public.meeting_rooms enable row level security;

drop policy if exists "meeting_rooms_select_party" on public.meeting_rooms;
create policy "meeting_rooms_select_party" on public.meeting_rooms
  for select using (public.appointment_is_party(appointment_id));

revoke all on table public.meeting_rooms from public, anon, authenticated;
grant select on table public.meeting_rooms to authenticated;

revoke all on function public.meeting_appointment_id_ok(text) from public, anon, authenticated;
revoke all on function public.appointment_starts_at(date, text) from public, anon, authenticated;
revoke all on function public.appointment_is_party(text) from public, anon, authenticated;
revoke all on function public.appointment_in_join_window(text) from public, anon, authenticated;
revoke all on function public.can_join_meeting(text) from public, anon, authenticated;
revoke all on function public.ensure_meeting_room(text) from public, anon, authenticated;

grant execute on function public.appointment_is_party(text) to authenticated;
grant execute on function public.can_join_meeting(text) to authenticated;
grant execute on function public.ensure_meeting_room(text) to authenticated;
