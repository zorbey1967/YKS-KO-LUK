-- Slotlar, 30 dk talep, koç -5. Öğrenci süre kesme YOK (öğrenci no-show 008).
-- 001–006 değişmez. recording / can_join_meeting aynı. Yaş kilidi yok.
-- Aynı starts_at + farklı koç talebi serbest. Duplicate: öğrenci+koç+starts_at.
-- Global expire/apply: EXECUTE yalnız service_role.

alter table public.coaches
  add column if not exists score integer not null default 100;
alter table public.coaches drop constraint if exists coaches_score_check;
alter table public.coaches add constraint coaches_score_check
  check (score >= 0 and score <= 100);
update public.coaches set score = 100 where score is null;

alter table public.appointments
  add column if not exists availability_id uuid;

create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  minutes integer not null default 40,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_availability_status_check check (status in ('open', 'held', 'booked', 'closed')),
  constraint coach_availability_minutes_check check (minutes = 40),
  constraint coach_availability_range_check check (ends_at = starts_at + make_interval(mins => 40))
);

create unique index if not exists coach_availability_active_start_idx
  on public.coach_availability (coach_id, starts_at)
  where status in ('open', 'held', 'booked');

create index if not exists coach_availability_coach_idx on public.coach_availability (coach_id, starts_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_availability_fk'
  ) then
    alter table public.appointments
      add constraint appointments_availability_fk
      foreign key (availability_id) references public.coach_availability(id) on delete restrict;
  end if;
end $$;

create unique index if not exists appointments_one_onay_student_start_idx
  on public.appointments (student_id, starts_at)
  where status = 'onay' and starts_at is not null;

create unique index if not exists appointments_one_active_student_coach_start_idx
  on public.appointments (student_id, coach_id, starts_at)
  where status in ('bekliyor', 'onay') and starts_at is not null;

create unique index if not exists appointments_one_open_slot_idx
  on public.appointments (availability_id)
  where availability_id is not null and status in ('bekliyor', 'onay');

create table if not exists public.meeting_audit (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null references public.appointments(id) on delete cascade,
  actor_id uuid not null,
  role text not null,
  event text not null,
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  constraint meeting_audit_role_check check (role in ('student', 'coach')),
  constraint meeting_audit_event_check check (event in (
    'token_ok', 'coach_penalty', 'student_duration_cut', 'student_penalty'
  ))
);

create unique index if not exists meeting_audit_once_idx
  on public.meeting_audit (appointment_id, role, event);

create table if not exists public.score_audit (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  appointment_id text references public.appointments(id) on delete set null,
  reason text not null,
  old_score integer not null,
  new_score integer not null,
  at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'score_audit_appt_reason_unique'
  ) then
    alter table public.score_audit
      add constraint score_audit_appt_reason_unique unique (appointment_id, reason);
  end if;
end $$;

create or replace function public.istanbul_date(p_ts timestamptz)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_ts at time zone 'Europe/Istanbul')::date;
$$;

create or replace function public.istanbul_time(p_ts timestamptz)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select to_char(p_ts at time zone 'Europe/Istanbul', 'HH24:MI');
$$;

create or replace function public.ranges_overlap(a0 timestamptz, a1 timestamptz, b0 timestamptz, b1 timestamptz)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select a0 < b1 and b0 < a1;
$$;

create or replace function public.coach_availability_no_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.minutes := 40;
  new.ends_at := new.starts_at + interval '40 minutes';
  new.updated_at := now();
  if exists (
    select 1 from public.coach_availability x
    where x.coach_id = new.coach_id
      and x.id is distinct from new.id
      and x.status in ('open', 'held', 'booked')
      and public.ranges_overlap(new.starts_at, new.ends_at, x.starts_at, x.ends_at)
  ) then
    raise exception 'müsaitlik çakışıyor';
  end if;
  return new;
end;
$$;

drop trigger if exists coach_availability_no_overlap on public.coach_availability;
create trigger coach_availability_no_overlap
  before insert or update on public.coach_availability
  for each row execute procedure public.coach_availability_no_overlap();

create or replace function public.add_coach_slot(p_starts_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid;
  slot public.coach_availability;
begin
  cid := public.own_coach_id();
  if cid is null then
    raise exception 'koç hesabı yok';
  end if;
  if p_starts_at is null or p_starts_at < now() + interval '30 minutes' then
    raise exception 'slot en az 30 dk sonra olmalı';
  end if;
  insert into public.coach_availability (coach_id, starts_at, ends_at, minutes, status)
  values (cid, p_starts_at, p_starts_at + interval '40 minutes', 40, 'open')
  returning * into slot;
  return jsonb_build_object(
    'id', slot.id,
    'starts_at', slot.starts_at,
    'ends_at', slot.ends_at,
    'status', slot.status
  );
end;
$$;

create or replace function public.close_coach_slot(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  slot public.coach_availability;
begin
  if public.own_coach_id() is null then
    raise exception 'koç hesabı yok';
  end if;
  select * into slot from public.coach_availability
    where id = p_id and coach_id = public.own_coach_id() for update;
  if not found then
    raise exception 'slot yok';
  end if;
  if slot.status = 'booked' then
    raise exception 'onaylı randevu sessiz silinemez';
  end if;
  if slot.status = 'held' then
    update public.appointments
      set status = 'iptal'
      where availability_id = slot.id and status = 'bekliyor';
  end if;
  update public.coach_availability set status = 'closed' where id = slot.id;
  return jsonb_build_object('ok', true, 'id', slot.id, 'status', 'closed');
end;
$$;

create or replace function public.list_open_slots(p_coach_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if p_coach_id is null or not public.is_active_coach(p_coach_id) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'date', public.istanbul_date(s.starts_at),
      'time', public.istanbul_time(s.starts_at)
    ) order by s.starts_at)
    from public.coach_availability s
    where s.coach_id = p_coach_id
      and s.status = 'open'
      and s.starts_at >= now() + interval '30 minutes'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_my_slots()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cid uuid;
begin
  cid := public.own_coach_id();
  if cid is null then
    raise exception 'koç hesabı yok';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'status', s.status,
      'date', public.istanbul_date(s.starts_at),
      'time', public.istanbul_time(s.starts_at)
    ) order by s.starts_at)
    from public.coach_availability s
    where s.coach_id = cid
      and s.status in ('open', 'held', 'booked')
      and s.starts_at >= now() - interval '1 day'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.request_appointment(p_availability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  slot public.coach_availability;
  appt_id text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if p_availability_id is null then
    raise exception 'slot yok';
  end if;

  select * into slot from public.coach_availability where id = p_availability_id for update;
  if not found or slot.status is distinct from 'open' then
    raise exception 'slot müsait değil';
  end if;
  if not public.is_active_coach(slot.coach_id) then
    raise exception 'koç aktif değil';
  end if;
  if slot.starts_at < now() + interval '30 minutes' then
    raise exception 'son talep 30 dk kala kapanır';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text || ':' || slot.coach_id::text || ':' || slot.starts_at::text)
  );

  if exists (
    select 1 from public.appointments a
    where a.student_id = auth.uid()
      and a.coach_id = slot.coach_id
      and a.starts_at is not distinct from slot.starts_at
      and a.status in ('bekliyor', 'onay')
  ) then
    raise exception 'bu koçta bu saat için talebin var';
  end if;

  update public.coach_availability
    set status = 'held'
    where id = slot.id and status = 'open';
  if not found then
    raise exception 'slot müsait değil';
  end if;

  appt_id := 'ap_' || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.appointments (
      id, coach_id, student_id, student_name, date, time, minutes, status, availability_id
    ) values (
      appt_id,
      slot.coach_id,
      auth.uid(),
      public.profile_display_name(auth.uid()),
      public.istanbul_date(slot.starts_at),
      public.istanbul_time(slot.starts_at),
      40,
      'bekliyor',
      slot.id
    );
  exception
    when unique_violation then
      update public.coach_availability set status = 'open' where id = slot.id and status = 'held';
      raise exception 'bu koçta bu saat için talebin var';
  end;

  return jsonb_build_object(
    'ok', true,
    'id', appt_id,
    'status', 'bekliyor',
    'starts_at', slot.starts_at
  );
end;
$$;

create or replace function public.respond_appointment(p_id text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
  cancelled int := 0;
  coach_name text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if p_id is null or length(trim(p_id)) = 0 then
    raise exception 'randevu yok';
  end if;

  select * into appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'randevu yok';
  end if;
  if not public.is_admin() and appt.coach_id is distinct from public.own_coach_id() then
    raise exception 'yetkisiz';
  end if;
  if appt.status is distinct from 'bekliyor' then
    raise exception 'talep açık değil';
  end if;

  perform 1
  from public.appointments x
  where x.student_id = appt.student_id
    and x.starts_at is not distinct from appt.starts_at
    and x.status in ('bekliyor', 'onay')
  order by x.id
  for update;

  if p_accept then
    if appt.starts_at is null or now() >= appt.starts_at - interval '30 minutes' then
      raise exception 'onay penceresi kapandı';
    end if;
    if exists (
      select 1 from public.appointments x
      where x.student_id = appt.student_id
        and x.starts_at is not distinct from appt.starts_at
        and x.status = 'onay'
    ) then
      raise exception 'bu saat başka koçta onaylı';
    end if;

    begin
      update public.appointments set status = 'onay' where id = appt.id and status = 'bekliyor';
      if not found then
        raise exception 'talep açık değil';
      end if;
    exception
      when unique_violation then
        raise exception 'bu saat başka koçta onaylı';
    end;

    update public.appointments
      set status = 'iptal'
      where student_id = appt.student_id
        and starts_at is not distinct from appt.starts_at
        and id is distinct from appt.id
        and status = 'bekliyor';
    get diagnostics cancelled = row_count;

    if appt.availability_id is not null then
      update public.coach_availability set status = 'booked' where id = appt.availability_id;
    end if;
    update public.coach_availability av
      set status = 'open'
      where av.status = 'held'
        and av.id in (
          select a.availability_id from public.appointments a
          where a.student_id = appt.student_id
            and a.starts_at is not distinct from appt.starts_at
            and a.id is distinct from appt.id
            and a.status = 'iptal'
            and a.availability_id is not null
        );

    select c.name into coach_name from public.coaches c where c.id = appt.coach_id;
    return jsonb_build_object(
      'ok', true,
      'status', 'onay',
      'cancelled', cancelled,
      'coachName', coalesce(coach_name, 'Koç'),
      'message', format(
        'Kabul: %s. Aynı saat için diğer bekleyen talepler iptal edildi (%s).',
        coalesce(coach_name, 'Koç'),
        cancelled
      )
    );
  end if;

  update public.appointments set status = 'iptal' where id = appt.id and status = 'bekliyor';
  if appt.availability_id is not null then
    update public.coach_availability set status = 'open' where id = appt.availability_id and status = 'held';
  end if;
  return jsonb_build_object('ok', true, 'status', 'iptal', 'cancelled', 0);
end;
$$;

create or replace function public.expire_pending_appointments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
begin
  update public.appointments a
    set status = 'iptal'
    where a.status = 'bekliyor'
      and a.starts_at is not null
      and now() >= a.starts_at - interval '30 minutes';
  get diagnostics n = row_count;
  update public.coach_availability av
    set status = 'open'
    where av.status = 'held'
      and not exists (
        select 1 from public.appointments a
        where a.availability_id = av.id and a.status = 'bekliyor'
      );
  return n;
end;
$$;

create or replace function public.log_meeting_token_ok(p_appointment_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  role text;
begin
  if auth.uid() is null or not public.can_join_meeting(p_appointment_id) then
    return;
  end if;
  if exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.student_id = auth.uid()
  ) then
    role := 'student';
  else
    role := 'coach';
  end if;
  insert into public.meeting_audit (appointment_id, actor_id, role, event)
  values (p_appointment_id, auth.uid(), role, 'token_ok')
  on conflict (appointment_id, role, event) do nothing;
end;
$$;

create or replace function public._apply_coach_penalty(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
  coach_score int;
  coach_user uuid;
  coach_joined boolean;
  audit_id uuid;
  old_s int;
  new_s int;
begin
  select * into appt from public.appointments where id = p_id for update;
  if not found then
    return false;
  end if;
  if appt.status is distinct from 'onay' then
    return false;
  end if;
  if appt.starts_at is null or now() < appt.starts_at + interval '10 minutes' then
    return false;
  end if;

  select c.user_id into coach_user
  from public.coaches c where c.id = appt.coach_id;
  if not found or coach_user is null then
    return false;
  end if;

  select exists (
    select 1 from public.meeting_audit m
    where m.appointment_id = appt.id and m.role = 'coach' and m.event = 'token_ok'
      and m.at <= appt.starts_at + interval '10 minutes'
  ) into coach_joined;
  if coach_joined then
    return false;
  end if;

  insert into public.meeting_audit (appointment_id, actor_id, role, event)
  values (appt.id, coach_user, 'coach', 'coach_penalty')
  on conflict (appointment_id, role, event) do nothing
  returning id into audit_id;
  if audit_id is null then
    return false;
  end if;

  select c.score into coach_score
  from public.coaches c where c.id = appt.coach_id for update;
  if not found then
    return false;
  end if;
  old_s := coach_score;
  new_s := greatest(old_s - 5, 0);
  update public.coaches set score = new_s where id = appt.coach_id;
  insert into public.score_audit (coach_id, appointment_id, reason, old_score, new_score)
  values (appt.coach_id, appt.id, 'no_show_or_late', old_s, new_s)
  on conflict on constraint score_audit_appt_reason_unique do nothing;
  return true;
end;
$$;

create or replace function public.apply_lesson_outcomes()
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
    select a.id
    from public.appointments a
    where a.status = 'onay'
      and a.starts_at is not null
      and now() >= a.starts_at + interval '10 minutes'
      and a.starts_at > now() - interval '7 days'
  loop
    if public._apply_coach_penalty(rec.id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

alter table public.coach_availability enable row level security;
alter table public.meeting_audit enable row level security;
alter table public.score_audit enable row level security;

drop policy if exists "av_select" on public.coach_availability;
create policy "av_select" on public.coach_availability
  for select using (
    public.is_admin()
    or coach_id = public.own_coach_id()
    or (status = 'open' and public.is_active_coach(coach_id))
  );

drop policy if exists "av_write" on public.coach_availability;
create policy "av_write" on public.coach_availability
  for all using (public.is_admin() or coach_id = public.own_coach_id())
  with check (public.is_admin() or coach_id = public.own_coach_id());

drop policy if exists "audit_select_party" on public.meeting_audit;
create policy "audit_select_party" on public.meeting_audit
  for select using (actor_id = auth.uid() or public.is_admin() or public.appointment_is_party(appointment_id));

drop policy if exists "score_audit_coach" on public.score_audit;
create policy "score_audit_coach" on public.score_audit
  for select using (
    public.is_admin()
    or coach_id = public.own_coach_id()
  );

revoke all on table public.coach_availability from public, anon, authenticated;
revoke all on table public.meeting_audit from public, anon, authenticated;
revoke all on table public.score_audit from public, anon, authenticated;
grant select on table public.coach_availability to authenticated;
grant select on table public.meeting_audit to authenticated;
grant select on table public.score_audit to authenticated;

revoke all on function public.add_coach_slot(timestamptz) from public, anon, authenticated;
revoke all on function public.close_coach_slot(uuid) from public, anon, authenticated;
revoke all on function public.list_open_slots(uuid) from public, anon, authenticated;
revoke all on function public.list_my_slots() from public, anon, authenticated;
revoke all on function public.request_appointment(uuid) from public, anon, authenticated;
revoke all on function public.respond_appointment(text, boolean) from public, anon, authenticated;
revoke all on function public.expire_pending_appointments() from public, anon, authenticated;
revoke all on function public.log_meeting_token_ok(text) from public, anon, authenticated;
revoke all on function public._apply_coach_penalty(text) from public, anon, authenticated;
revoke all on function public.apply_lesson_outcomes() from public, anon, authenticated;
revoke all on function public.istanbul_date(timestamptz) from public, anon, authenticated;
revoke all on function public.istanbul_time(timestamptz) from public, anon, authenticated;
revoke all on function public.ranges_overlap(timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

grant execute on function public.add_coach_slot(timestamptz) to authenticated;
grant execute on function public.close_coach_slot(uuid) to authenticated;
grant execute on function public.list_open_slots(uuid) to authenticated;
grant execute on function public.list_my_slots() to authenticated;
grant execute on function public.request_appointment(uuid) to authenticated;
grant execute on function public.respond_appointment(text, boolean) to authenticated;
grant execute on function public.log_meeting_token_ok(text) to authenticated;

grant execute on function public.expire_pending_appointments() to service_role;
grant execute on function public.apply_lesson_outcomes() to service_role;

create or replace function public.appointments_require_slot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and not public.is_admin() and new.availability_id is null then
    raise exception 'yalnız açık saatten talep';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_require_slot on public.appointments;
create trigger appointments_require_slot
  before insert on public.appointments
  for each row execute procedure public.appointments_require_slot();

create or replace function public.coaches_protect_score()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.score is distinct from old.score and current_user = 'authenticated' then
    raise exception 'puan kilitli';
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_protect_score on public.coaches;
create trigger coaches_protect_score
  before update on public.coaches
  for each row execute procedure public.coaches_protect_score();
