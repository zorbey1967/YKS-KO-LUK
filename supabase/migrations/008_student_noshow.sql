-- 007 sonrası: öğrenci no-show iptal + -5 bir kez. Süre kesilmez.
-- Eski tek-bekliyor index kalkar. 001–006 değişmez.
-- CHECK genişler; student_duration_cut silinmez.
-- apply_lesson_outcomes_one YOK. Yardımcılar: _apply_coach_penalty, _apply_student_noshow.

alter table public.profiles
  add column if not exists score integer not null default 100;
alter table public.profiles drop constraint if exists profiles_score_check;
alter table public.profiles add constraint profiles_score_check
  check (score >= 0 and score <= 100);
update public.profiles set score = 100 where score is null;

alter table public.appointments
  add column if not exists cancel_reason text;
alter table public.appointments drop constraint if exists appointments_cancel_reason_check;
alter table public.appointments add constraint appointments_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in ('student_no_show', 'sibling_accepted', 'coach_rejected', 'expired')
  );

alter table public.meeting_audit drop constraint if exists meeting_audit_event_check;
alter table public.meeting_audit add constraint meeting_audit_event_check
  check (event in (
    'token_ok', 'coach_penalty', 'student_duration_cut', 'student_penalty'
  ));

drop index if exists public.appointments_one_bekliyor_student_idx;
drop index if exists public.appointments_one_active_student_start_idx;

create unique index if not exists appointments_one_active_student_coach_start_idx
  on public.appointments (student_id, coach_id, starts_at)
  where status in ('bekliyor', 'onay') and starts_at is not null;

create table if not exists public.student_score_audit (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id text not null references public.appointments(id) on delete cascade,
  reason text not null,
  old_score integer not null,
  new_score integer not null,
  at timestamptz not null default now(),
  constraint student_score_audit_appointment_unique unique (appointment_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_score_audit_appointment_unique'
  ) then
    alter table public.student_score_audit
      add constraint student_score_audit_appointment_unique unique (appointment_id);
  end if;
end $$;

alter table public.student_score_audit enable row level security;
drop policy if exists "student_score_audit_own" on public.student_score_audit;
create policy "student_score_audit_own" on public.student_score_audit
  for select using (student_id = auth.uid() or public.is_admin());

revoke all on table public.student_score_audit from public, anon, authenticated;
grant select on table public.student_score_audit to authenticated;

create or replace function public.profiles_protect_score()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.score is distinct from old.score and current_user = 'authenticated' then
    raise exception 'puan kilitli';
  end if;
  if tg_op = 'INSERT' and current_user = 'authenticated' then
    new.score := 100;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_score on public.profiles;
create trigger profiles_protect_score
  before insert or update on public.profiles
  for each row execute procedure public.profiles_protect_score();

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
      update public.appointments set status = 'onay', cancel_reason = null
      where id = appt.id and status = 'bekliyor';
      if not found then
        raise exception 'talep açık değil';
      end if;
    exception
      when unique_violation then
        raise exception 'bu saat başka koçta onaylı';
    end;

    update public.appointments
      set status = 'iptal', cancel_reason = 'sibling_accepted'
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

  update public.appointments
    set status = 'iptal', cancel_reason = 'coach_rejected'
    where id = appt.id and status = 'bekliyor';
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
    set status = 'iptal', cancel_reason = coalesce(a.cancel_reason, 'expired')
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

create or replace function public._apply_student_noshow(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appt public.appointments;
  coach_joined boolean;
  student_joined boolean;
  noshow_reason text;
  audit_id uuid;
  old_s int;
  new_s int;
  penalty int := 5;
begin
  select * into appt from public.appointments where id = p_id for update;
  if not found or appt.status is distinct from 'onay' then
    return false;
  end if;
  if appt.starts_at is null or now() < appt.starts_at + interval '10 minutes' then
    return false;
  end if;

  select exists (
    select 1 from public.meeting_audit m
    where m.appointment_id = appt.id and m.role = 'coach' and m.event = 'token_ok'
      and m.at <= appt.starts_at + interval '10 minutes'
  ) into coach_joined;
  select exists (
    select 1 from public.meeting_audit m
    where m.appointment_id = appt.id and m.role = 'student' and m.event = 'token_ok'
      and m.at <= appt.starts_at + interval '10 minutes'
  ) into student_joined;
  if student_joined then
    return false;
  end if;

  noshow_reason := case
    when coach_joined then 'student_noshow_coach_present'
    else 'student_noshow_both_absent'
  end;

  insert into public.meeting_audit (appointment_id, actor_id, role, event, meta)
  values (appt.id, appt.student_id, 'student', 'student_penalty', jsonb_build_object('kind', noshow_reason))
  on conflict (appointment_id, role, event) do nothing
  returning id into audit_id;

  if audit_id is not null then
    insert into public.profiles (id, score) values (appt.student_id, 100)
    on conflict (id) do nothing;
    select score into old_s from public.profiles where id = appt.student_id for update;
    old_s := coalesce(old_s, 100);
    new_s := greatest(old_s - penalty, 0);
    update public.profiles set score = new_s where id = appt.student_id;
    insert into public.student_score_audit (student_id, appointment_id, reason, old_score, new_score)
    values (appt.student_id, appt.id, noshow_reason, old_s, new_s)
    on conflict on constraint student_score_audit_appointment_unique do nothing;
  end if;

  update public.appointments
    set status = 'iptal', cancel_reason = 'student_no_show'
    where id = appt.id and status = 'onay';

  return audit_id is not null;
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
    if public._apply_student_noshow(rec.id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

create or replace function public.apply_my_lesson_outcomes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;

  -- Öğrenci dalı: yalnız kendi student_id satırları; yalnız öğrenci no-show.
  for rec in
    select a.id
    from public.appointments a
    where a.student_id = auth.uid()
      and a.status = 'onay'
      and a.starts_at is not null
      and now() >= a.starts_at + interval '10 minutes'
      and a.starts_at > now() - interval '7 days'
  loop
    if public._apply_student_noshow(rec.id) then
      n := n + 1;
    end if;
  end loop;

  -- Koç dalı: yalnız c.user_id = çağıran; yalnız koç cezası.
  for rec in
    select a.id
    from public.appointments a
    join public.coaches c on c.id = a.coach_id
    where c.user_id = auth.uid()
      and a.status = 'onay'
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

create or replace function public.expire_my_pending_appointments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  cid := public.own_coach_id();
  update public.appointments a
    set status = 'iptal', cancel_reason = coalesce(a.cancel_reason, 'expired')
    where a.status = 'bekliyor'
      and a.starts_at is not null
      and now() >= a.starts_at - interval '30 minutes'
      and (a.student_id = auth.uid() or (cid is not null and a.coach_id = cid));
  get diagnostics n = row_count;
  update public.coach_availability av
    set status = 'open'
    where av.status = 'held'
      and not exists (
        select 1 from public.appointments a
        where a.availability_id = av.id and a.status = 'bekliyor'
      )
      and (
        (cid is not null and av.coach_id = cid)
        or exists (
          select 1 from public.appointments a
          where a.availability_id = av.id and a.student_id = auth.uid()
        )
      );
  return n;
end;
$$;

revoke all on function public.request_appointment(uuid) from public, anon, authenticated;
revoke all on function public.respond_appointment(text, boolean) from public, anon, authenticated;
revoke all on function public._apply_student_noshow(text) from public, anon, authenticated;
revoke all on function public._apply_coach_penalty(text) from public, anon, authenticated;
revoke all on function public.apply_lesson_outcomes() from public, anon, authenticated;
revoke all on function public.expire_pending_appointments() from public, anon, authenticated;
revoke all on function public.apply_my_lesson_outcomes() from public, anon, authenticated;
revoke all on function public.expire_my_pending_appointments() from public, anon, authenticated;

grant execute on function public.request_appointment(uuid) to authenticated;
grant execute on function public.respond_appointment(text, boolean) to authenticated;
grant execute on function public.apply_my_lesson_outcomes() to authenticated;
grant execute on function public.expire_my_pending_appointments() to authenticated;
grant execute on function public.apply_lesson_outcomes() to service_role;
grant execute on function public.expire_pending_appointments() to service_role;
