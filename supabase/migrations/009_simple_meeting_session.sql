-- Basit görüşme: T-20 giriş, iki taraf birlikte 40 dk, Bitir, no-show job no-op.
-- 001–008 değişmez. Production'a ancak onayla uygulanır.
-- recording_enabled false. expire_my (T-30 bekleyen talep) aynı.
-- Trigger DROP + backfill + CREATE: migration UPDATE join_before_min=20'yi ezmez.

create or replace function public.appointments_fill_starts_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.join_before_min := 20;
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

update public.appointments
  set join_before_min = 20
  where status in ('bekliyor', 'onay')
    and join_before_min is distinct from 20;

create trigger appointments_fill_starts_at
  before insert or update on public.appointments
  for each row execute procedure public.appointments_fill_starts_at();

alter table public.meeting_rooms
  add column if not exists lesson_started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid,
  add column if not exists student_present_at timestamptz,
  add column if not exists coach_present_at timestamptz;

create or replace function public.appointment_in_join_window(p_appointment_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.appointment_is_party(p_appointment_id)
    and exists (
      select 1
      from public.appointments a
      where a.id = p_appointment_id
        and a.status = 'onay'
        and a.starts_at is not null
    );
$$;

create or replace function public.can_join_meeting(p_appointment_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
  room public.meeting_rooms;
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

  select * into appt from public.appointments where id = p_appointment_id;
  if not found or appt.status is distinct from 'onay' or appt.starts_at is null then
    return false;
  end if;

  select * into room from public.meeting_rooms where appointment_id = p_appointment_id;
  if found then
    if room.status in ('ended', 'blocked') or room.ended_at is not null then
      return false;
    end if;
    if room.lesson_started_at is not null then
      return now() < room.lesson_started_at + interval '40 minutes';
    end if;
  end if;

  return true;
end;
$$;

create or replace function public._finish_meeting_room(p_appointment_id text, p_ended_by uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.meeting_rooms
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        ended_by = coalesce(ended_by, p_ended_by),
        student_present_at = null,
        coach_present_at = null,
        updated_at = now(),
        recording_enabled = false
    where appointment_id = p_appointment_id
      and status is distinct from 'ended'
      and status is distinct from 'blocked';

  update public.appointments
    set status = 'tamamlandi'
    where id = p_appointment_id
      and status = 'onay';
end;
$$;

-- Süre dolduysa atomik ended. İkinci çağrı 0 satır günceller.
create or replace function public._expire_meeting_if_due(p_appointment_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  closed int;
begin
  update public.meeting_rooms
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        student_present_at = null,
        coach_present_at = null,
        updated_at = now(),
        recording_enabled = false
    where appointment_id = p_appointment_id
      and lesson_started_at is not null
      and now() >= lesson_started_at + interval '40 minutes'
      and status is distinct from 'ended'
      and status is distinct from 'blocked';
  get diagnostics closed = row_count;
  if closed > 0 then
    update public.appointments
      set status = 'tamamlandi'
      where id = p_appointment_id
        and status = 'onay';
    return true;
  end if;
  return exists (
    select 1 from public.meeting_rooms r
    where r.appointment_id = p_appointment_id
      and (r.status in ('ended', 'blocked') or r.ended_at is not null)
  );
end;
$$;

create or replace function public.ensure_meeting_room(p_appointment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.meeting_rooms;
begin
  if not public.meeting_appointment_id_ok(p_appointment_id) then
    raise exception 'geçersiz randevu';
  end if;
  perform public._expire_meeting_if_due(p_appointment_id);
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
          when public.meeting_rooms.status = 'live' then public.meeting_rooms.status
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
    'recording_enabled', false,
    'lesson_started_at', room.lesson_started_at,
    'ended_at', room.ended_at
  );
end;
$$;

create or replace function public._meeting_caller_role(p_appointment_id text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into appt from public.appointments where id = p_appointment_id;
  if not found then
    return null;
  end if;
  if appt.student_id = auth.uid() then
    return 'student';
  end if;
  if exists (
    select 1 from public.coaches c
    where c.id = appt.coach_id and c.user_id = auth.uid()
  ) then
    return 'coach';
  end if;
  return null;
end;
$$;

create or replace function public._meeting_join_remaining_sec(p_appointment_id text)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
  room public.meeting_rooms;
  sec numeric;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if not found then
    return 0;
  end if;
  select * into room from public.meeting_rooms where appointment_id = p_appointment_id;
  if found and (room.status in ('ended', 'blocked') or room.ended_at is not null) then
    return 0;
  end if;
  if found and room.lesson_started_at is not null then
    sec := extract(epoch from room.lesson_started_at + interval '40 minutes' - now());
    return greatest(0, floor(sec))::int;
  end if;
  -- Timer yok: join serbest; token TTL kenarı 10 dk (meeting-token min(600, bu değer)).
  return 600;
end;
$$;

create or replace function public.set_meeting_presence(p_appointment_id text, p_present boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  role text;
  room public.meeting_rooms;
  stu_in boolean;
  coa_in boolean;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.appointment_is_party(p_appointment_id) then
    raise exception 'yetki yok';
  end if;

  perform public._expire_meeting_if_due(p_appointment_id);

  select * into room from public.meeting_rooms where appointment_id = p_appointment_id for update;
  if not found then
    raise exception 'oda yok';
  end if;
  if room.status in ('ended', 'blocked') or room.ended_at is not null then
    raise exception 'görüşme kapalı';
  end if;
  if not public.can_join_meeting(p_appointment_id) then
    raise exception 'görüşme için yetki veya zaman yok';
  end if;

  role := public._meeting_caller_role(p_appointment_id);
  if role is null then
    raise exception 'yetki yok';
  end if;

  if role = 'student' then
    update public.meeting_rooms
      set student_present_at = case when p_present then now() else null end,
          updated_at = now()
      where appointment_id = p_appointment_id;
  else
    update public.meeting_rooms
      set coach_present_at = case when p_present then now() else null end,
          updated_at = now()
      where appointment_id = p_appointment_id;
  end if;

  update public.meeting_rooms r
    set lesson_started_at = now(),
        status = 'live',
        updated_at = now()
    from public.appointments a
    where r.appointment_id = p_appointment_id
      and a.id = p_appointment_id
      and r.lesson_started_at is null
      and r.status not in ('ended', 'blocked')
      and a.starts_at is not null
      and now() >= a.starts_at
      and r.student_present_at is not null
      and r.coach_present_at is not null
      and r.student_present_at > now() - interval '25 seconds'
      and r.coach_present_at > now() - interval '25 seconds';

  select * into room from public.meeting_rooms where appointment_id = p_appointment_id;
  stu_in := room.student_present_at is not null and room.student_present_at > now() - interval '25 seconds';
  coa_in := room.coach_present_at is not null and room.coach_present_at > now() - interval '25 seconds';

  return jsonb_build_object(
    'ok', true,
    'status', room.status,
    'lesson_started_at', room.lesson_started_at,
    'ended_at', room.ended_at,
    'student_in', stu_in,
    'coach_in', coa_in,
    'remaining_sec', case
      when room.lesson_started_at is null then null
      else public._meeting_join_remaining_sec(p_appointment_id)
    end,
    'join_remaining_sec', public._meeting_join_remaining_sec(p_appointment_id),
    'server_now', now(),
    'recording', false
  );
end;
$$;

create or replace function public.end_meeting(p_appointment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.appointment_is_party(p_appointment_id) then
    raise exception 'yetki yok';
  end if;
  if not exists (select 1 from public.meeting_rooms where appointment_id = p_appointment_id) then
    raise exception 'oda yok';
  end if;

  perform public._finish_meeting_room(p_appointment_id, auth.uid());

  return jsonb_build_object('ok', true, 'status', 'ended', 'recording', false);
end;
$$;

create or replace function public.meeting_session_state(p_appointment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room public.meeting_rooms;
  stu_in boolean;
  coa_in boolean;
  rem int;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.appointment_is_party(p_appointment_id) then
    raise exception 'yetki yok';
  end if;

  perform public._expire_meeting_if_due(p_appointment_id);

  select * into room from public.meeting_rooms where appointment_id = p_appointment_id;
  if not found then
    return jsonb_build_object(
      'ok', true,
      'status', 'idle',
      'lesson_started_at', null,
      'ended_at', null,
      'student_in', false,
      'coach_in', false,
      'remaining_sec', null,
      'join_remaining_sec', public._meeting_join_remaining_sec(p_appointment_id),
      'server_now', now(),
      'recording', false
    );
  end if;

  rem := public._meeting_join_remaining_sec(p_appointment_id);
  stu_in := room.student_present_at is not null and room.student_present_at > now() - interval '25 seconds';
  coa_in := room.coach_present_at is not null and room.coach_present_at > now() - interval '25 seconds';

  return jsonb_build_object(
    'ok', true,
    'status', room.status,
    'lesson_started_at', room.lesson_started_at,
    'ended_at', room.ended_at,
    'student_in', stu_in,
    'coach_in', coa_in,
    'remaining_sec', case
      when room.lesson_started_at is null or room.status in ('ended', 'blocked') then
        case when room.status in ('ended', 'blocked') then 0 else null end
      else rem
    end,
    'join_remaining_sec', rem,
    'server_now', now(),
    'recording', false
  );
end;
$$;

create or replace function public._apply_coach_penalty(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return false;
end;
$$;

create or replace function public._apply_student_noshow(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return false;
end;
$$;

create or replace function public._close_expired_meeting_sessions(p_all boolean)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  n int := 0;
begin
  for rec in
    select r.appointment_id
    from public.meeting_rooms r
    join public.appointments a on a.id = r.appointment_id
    left join public.coaches c on c.id = a.coach_id
    where r.lesson_started_at is not null
      and r.status not in ('ended', 'blocked')
      and now() >= r.lesson_started_at + interval '40 minutes'
      and (
        p_all
        or a.student_id = auth.uid()
        or c.user_id = auth.uid()
      )
  loop
    if public._expire_meeting_if_due(rec.appointment_id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

create or replace function public.apply_lesson_outcomes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public._close_expired_meeting_sessions(true);
end;
$$;

create or replace function public.apply_my_lesson_outcomes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  return public._close_expired_meeting_sessions(false);
end;
$$;

revoke all on function public._meeting_caller_role(text) from public, anon, authenticated;
revoke all on function public._finish_meeting_room(text, uuid) from public, anon, authenticated;
revoke all on function public._expire_meeting_if_due(text) from public, anon, authenticated;
revoke all on function public._close_expired_meeting_sessions(boolean) from public, anon, authenticated;
revoke all on function public._meeting_join_remaining_sec(text) from public, anon, authenticated;
revoke all on function public.set_meeting_presence(text, boolean) from public, anon, authenticated;
revoke all on function public.end_meeting(text) from public, anon, authenticated;
revoke all on function public.meeting_session_state(text) from public, anon, authenticated;
revoke all on function public._apply_student_noshow(text) from public, anon, authenticated;
revoke all on function public._apply_coach_penalty(text) from public, anon, authenticated;
revoke all on function public.apply_lesson_outcomes() from public, anon, authenticated;
revoke all on function public.apply_my_lesson_outcomes() from public, anon, authenticated;

grant execute on function public.set_meeting_presence(text, boolean) to authenticated;
grant execute on function public.end_meeting(text) to authenticated;
grant execute on function public.meeting_session_state(text) to authenticated;
grant execute on function public.apply_my_lesson_outcomes() to authenticated;
grant execute on function public.apply_lesson_outcomes() to service_role;
grant execute on function public.can_join_meeting(text) to authenticated;
grant execute on function public.ensure_meeting_room(text) to authenticated;
grant execute on function public.appointment_is_party(text) to authenticated;
