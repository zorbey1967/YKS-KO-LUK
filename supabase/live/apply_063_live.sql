-- CANLI UYGULAMA: 063 (koç akışı düzeltmeleri). Önkoşul: 062 canlıda.
-- Tek işlem; hata olursa hiçbir değişiklik kalmaz. Tekrar çalıştırmak güvenlidir.
-- SIRA: önce bu dosya, SONRA frontend (frontend cancel_requested_by kolonunu okur).

begin;

do $$
declare
  missing text := '';
begin
  if pg_catalog.to_regprocedure('public.own_active_coach_id()') is null then missing := missing || ' own_active_coach_id'; end if;
  if pg_catalog.to_regprocedure('public.caller_account_active()') is null then missing := missing || ' caller_account_active'; end if;
  if pg_catalog.to_regprocedure('public.profile_display_name(uuid)') is null then missing := missing || ' profile_display_name'; end if;
  if pg_catalog.to_regprocedure('public._finish_meeting_room(text,uuid)') is null then missing := missing || ' _finish_meeting_room'; end if;
  if to_regclass('public.coach_availability') is null then missing := missing || ' coach_availability'; end if;
  if to_regclass('public.meeting_rooms') is null then missing := missing || ' meeting_rooms'; end if;
  if to_regclass('public.support_tickets') is null then missing := missing || ' support_tickets'; end if;
  if position('profiles' in pg_catalog.pg_get_functiondef('public.admin_set_coach_status(uuid,text)'::regprocedure)) > 0 then
    missing := missing || ' 062';
  end if;
  if missing <> '' then
    raise exception 'ONKOSUL_EKSIK:% - hiçbir değişiklik yapılmadı', missing;
  end if;
end
$$;

-- ===================== 063_coach_flow_fixes.sql =====================
-- 063: Koç akışı düzeltmeleri (tek hesap öğrenci + koç).
-- Önkoşul: 062. Canlıda koç / randevu / ödev verisi yokken hazırlandı; tekrar çalıştırmak güvenlidir.
-- Kapsam:
--   1) Koç dizini öğrenciye boş dönüyordu (security_invoker görünüm + coaches RLS yalnız sahibine).
--   2) Eski saf koç hesapları (role='coach') tek hesap modeline (role='student') alınır.
--   3) coaches: yeniden başvuru (reddedilen → pending), onaylı koçun adı kilitli, askı alanı korunur.
--   4) Koç işlemleri yalnız onaylı + hesabı aktif koçla; kendi saatine randevu yok; çakışma ve talep sınırı.
--   5) "Bağlı öğrenci" yalnız onaylı / tamamlanmış randevu veya aktif eşleşme.
--   6) Randevu ve ödev satırlarına istemciden doğrudan yazma kapalı (yalnız RPC / yönetici).
--   7) Eksik RPC'ler: onaylı randevu iptal talebi / kararı, koç öğrenci özeti.
--   8) Görüşmeye yalnız zaman penceresinde girilir; ders başlamadan "bitir" yok.
--   9) Destek kaydında koç modunda yazan onaylı koç "Koç" görünür.

-- 2) Tek hesap modeli: saf koç hesabı kalmaz -------------------------------------------------------
update public.profiles set role = 'student' where role = 'coach';

-- 3) coaches ---------------------------------------------------------------------------------------
alter table public.coaches add column if not exists status_before_suspend text;

create or replace function public.force_coach_pending()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
begin
  new.updated_at := pg_catalog.now();
  if public.is_admin() then
    return new;
  end if;
  if uid is null then
    -- Sunucu (kayıt tetikleyicisi / service_role): yeni kayıt yalnız beklemede açılır.
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.status_before_suspend := null;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.user_id := uid;
    new.status_before_suspend := null;
    new.score := 100;
    new.email := coalesce(nullif(auth.jwt() ->> 'email', ''), new.email);
    return new;
  end if;
  new.user_id := old.user_id;
  new.email := old.email;
  new.status_before_suspend := old.status_before_suspend;
  if old.status = 'rejected' and new.status = 'pending' then
    null; -- yeniden başvuru
  else
    new.status := old.status;
  end if;
  if old.status = 'active' then
    new.name := old.name;
  end if;
  return new;
end;
$$;

-- Kayıtta "Koç başvurusu" seçildiyse başvuru sunucuda beklemede açılır (cihazdan bağımsız).
-- Fotoğraf meta veride taşınmaz; ilk girişte istemci ekler. Hata kaydı engellemez.
create or replace function public.coach_application_from_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text;
begin
  if lower(coalesce(meta->>'intent', '')) <> 'coach' then
    return new;
  end if;
  full_name := left(trim(coalesce(nullif(meta->>'name', ''),
                                  trim(coalesce(meta->>'first_name', '') || ' ' || coalesce(meta->>'last_name', '')))), 120);
  begin
    insert into public.coaches (user_id, name, email, track, focus, student_count, status)
    values (
      new.id,
      coalesce(nullif(full_name, ''), 'Koç'),
      new.email,
      left(coalesce(nullif(trim(meta->>'coach_track'), ''), 'YKS Sayısal'), 60),
      left(coalesce(nullif(trim(meta->>'coach_focus'), ''), 'Süreç koçluğu'), 200),
      least(500, greatest(0, coalesce(nullif(meta->>'coach_student_count', '')::int, 0))),
      'pending'
    )
    on conflict (user_id) do nothing;
  exception when others then
    null;
  end;
  return new;
end;
$$;
revoke all on function public.coach_application_from_signup() from public, anon, authenticated;

drop trigger if exists zz_coach_application_from_signup on auth.users;
create trigger zz_coach_application_from_signup
  after insert on auth.users
  for each row execute function public.coach_application_from_signup();

-- 1) Koç dizini: yalnız onaylı ve hesabı aktif koçların kart alanları -------------------------------
create or replace function public.coach_directory_rows()
returns table (
  id uuid, name text, photo text, track text, focus text, experience text, bio text,
  student_count integer, created_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $$
  select c.id, c.name, c.photo, c.track, c.focus, c.experience, c.bio, c.student_count, c.created_at
    from public.coaches c
    join public.profiles p on p.id = c.user_id
   where auth.uid() is not null
     and c.status = 'active'
     and p.account_status = 'active';
$$;
revoke all on function public.coach_directory_rows() from public, anon;
grant execute on function public.coach_directory_rows() to authenticated;

create or replace view public.coach_directory with (security_invoker = true) as
  select d.id, d.name, d.photo, d.track, d.focus, d.experience, d.bio, d.student_count, d.created_at
    from public.coach_directory_rows() d;
revoke all on table public.coach_directory from public, anon;
grant select on table public.coach_directory to authenticated;

create or replace function public.is_active_coach(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.coaches c
      join public.profiles p on p.id = c.user_id
     where c.id = p_id and c.status = 'active' and p.account_status = 'active'
  );
$$;

-- 5) Bağlı öğrenci ----------------------------------------------------------------------------------
create or replace function public.coach_linked_to_student(p_coach uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
           select 1 from public.appointments a
            where a.coach_id = p_coach and a.student_id = p_student and a.status in ('onay', 'tamamlandi'))
      or exists (
           select 1 from public.coach_matches m
            where m.coach_id = p_coach and m.student_id = p_student and m.status = 'active');
$$;

create or replace function public.coach_linked_students()
returns table(student_id uuid, name text, grade text, dept text, exam_date text, week_hours numeric, open_tasks integer)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'oturum gerekli'; end if;
  cid := public.own_active_coach_id();
  if cid is null then raise exception 'yetkisiz'; end if;
  return query
  with ids as (
    select distinct a.student_id as sid from public.appointments a
     where a.coach_id = cid and a.status in ('onay', 'tamamlandi')
    union
    select distinct m.student_id from public.coach_matches m
     where m.coach_id = cid and m.student_id is not null and m.status = 'active'
  )
  select i.sid, public.profile_display_name(i.sid),
    coalesce(nullif(sd.data->>'grade', ''), ''),
    coalesce(nullif(p.target_department, ''), nullif(sd.data->>'dept', ''), ''),
    coalesce(nullif(sd.data->>'examDate', ''), ''),
    coalesce(nullif(sd.data->>'weekHours', '')::numeric, 0),
    coalesce((select count(*)::int from jsonb_array_elements(coalesce(sd.data->'tasks', '[]'::jsonb)) t
               where (t->>'done') is distinct from 'true'), 0)
  from ids i
  left join public.profiles p on p.id = i.sid
  left join public.student_data sd on sd.user_id = i.sid
  where i.sid is distinct from auth.uid();
end;
$$;

create or replace function public.coach_student_brief(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  cid uuid;
  payload jsonb;
begin
  if auth.uid() is null then raise exception 'oturum gerekli'; end if;
  cid := public.own_active_coach_id();
  if cid is null then raise exception 'yetkisiz'; end if;
  if p_student is null or p_student = auth.uid() or not public.coach_linked_to_student(cid, p_student) then
    raise exception 'yetkisiz';
  end if;
  select sd.data into payload from public.student_data sd where sd.user_id = p_student;
  return jsonb_build_object('ok', true, 'payload', coalesce(payload, '{}'::jsonb));
end;
$$;
revoke all on function public.coach_student_brief(uuid) from public, anon;
grant execute on function public.coach_student_brief(uuid) to authenticated;

create or replace function public.assign_coach_homework(p_student_id uuid, p_title text, p_due date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  cid uuid;
  hid uuid;
  title_n text := left(trim(coalesce(p_title, '')), 200);
begin
  if auth.uid() is null then raise exception 'oturum gerekli'; end if;
  cid := public.own_active_coach_id();
  if cid is null then raise exception 'yetkisiz'; end if;
  if p_student_id is null or length(title_n) < 2 then raise exception 'öğrenci ve ödev gerekli'; end if;
  if p_student_id = auth.uid() or not public.coach_linked_to_student(cid, p_student_id) then
    raise exception 'bu öğrenci randevu veya eşleşme ile bağlı değil';
  end if;
  select h.id into hid from public.coach_homeworks h
   where h.coach_id = cid and h.student_id = p_student_id and lower(h.title) = lower(title_n)
     and h.due is not distinct from p_due and h.done = false
   limit 1;
  if hid is not null then return hid; end if;
  insert into public.coach_homeworks (coach_id, student_id, title, due)
  values (cid, p_student_id, title_n, p_due)
  returning id into hid;
  return hid;
end;
$$;
revoke all on function public.assign_coach_homework(uuid, text, date) from public, anon;
grant execute on function public.assign_coach_homework(uuid, text, date) to authenticated;

-- 6) Doğrudan yazma kapalı ----------------------------------------------------------------------------
drop policy if exists "appt_insert" on public.appointments;
drop policy if exists "appt_update" on public.appointments;
drop policy if exists "appt_delete" on public.appointments;
create policy "appt_insert" on public.appointments for insert with check (public.is_admin());
create policy "appt_update" on public.appointments for update using (public.is_admin()) with check (public.is_admin());
create policy "appt_delete" on public.appointments for delete using (public.is_admin());

revoke insert, update, delete, truncate, references, trigger on table public.coach_homeworks from anon, authenticated;
grant select on table public.coach_homeworks to authenticated;
do $$
declare
  t text;
begin
  foreach t in array array['coach_program_pdfs', 'meeting_recordings', 'support_tickets'] loop
    if pg_catalog.to_regclass('public.' || t) is not null then
      execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end
$$;

-- 4) Koç işlemleri ---------------------------------------------------------------------------------
create or replace function public.add_coach_slot(p_starts_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  cid uuid;
  slot public.coach_availability;
begin
  cid := public.own_active_coach_id();
  if cid is null then
    raise exception 'koç hesabı onaylı değil';
  end if;
  if p_starts_at is null or p_starts_at < now() + interval '30 minutes' then
    raise exception 'slot en az 30 dk sonra olmalı';
  end if;
  insert into public.coach_availability (coach_id, starts_at, ends_at, minutes, status)
  values (cid, p_starts_at, p_starts_at + interval '40 minutes', 40, 'open')
  returning * into slot;
  return jsonb_build_object('id', slot.id, 'starts_at', slot.starts_at, 'ends_at', slot.ends_at, 'status', slot.status);
end;
$$;

create or replace function public.request_appointment(p_availability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  slot public.coach_availability;
  appt_id text;
  open_n int;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
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
  if slot.coach_id is not distinct from public.own_coach_id() then
    raise exception 'kendi saatine randevu alamazsın';
  end if;
  if slot.starts_at < now() + interval '30 minutes' then
    raise exception 'son talep 30 dk kala kapanır';
  end if;

  perform pg_advisory_xact_lock(hashtext('appt_student:' || auth.uid()::text));

  select count(*) into open_n from public.appointments a
   where a.student_id = auth.uid() and a.status = 'bekliyor' and a.starts_at > now();
  if open_n >= 5 then
    raise exception 'en fazla 5 bekleyen talep';
  end if;
  if exists (
    select 1 from public.appointments a
     where a.student_id = auth.uid()
       and a.status = 'onay'
       and a.starts_at is not null
       and tstzrange(a.starts_at, a.starts_at + make_interval(mins => coalesce(a.minutes, 40)))
           && tstzrange(slot.starts_at, slot.ends_at)
  ) then
    raise exception 'bu saatte onaylı randevun var';
  end if;
  if exists (
    select 1 from public.appointments a
    where a.student_id = auth.uid()
      and a.coach_id = slot.coach_id
      and a.starts_at is not distinct from slot.starts_at
      and a.status in ('bekliyor', 'onay')
  ) then
    raise exception 'bu koçta bu saat için talebin var';
  end if;

  update public.coach_availability set status = 'held' where id = slot.id and status = 'open';
  if not found then
    raise exception 'slot müsait değil';
  end if;

  appt_id := 'ap_' || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into public.appointments (
      id, coach_id, student_id, student_name, date, time, minutes, status, availability_id
    ) values (
      appt_id, slot.coach_id, auth.uid(), public.profile_display_name(auth.uid()),
      public.istanbul_date(slot.starts_at), public.istanbul_time(slot.starts_at), 40, 'bekliyor', slot.id
    );
  exception
    when unique_violation then
      update public.coach_availability set status = 'open' where id = slot.id and status = 'held';
      raise exception 'bu koçta bu saat için talebin var';
  end;

  return jsonb_build_object('ok', true, 'id', appt_id, 'status', 'bekliyor', 'starts_at', slot.starts_at);
end;
$$;

create or replace function public.respond_appointment(p_id text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
  if not public.is_admin() and appt.coach_id is distinct from public.own_active_coach_id() then
    raise exception 'yetkisiz';
  end if;
  if appt.status is distinct from 'bekliyor' then
    raise exception 'talep açık değil';
  end if;

  perform 1 from public.appointments x
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
         and x.id is distinct from appt.id
         and x.status = 'onay'
         and x.starts_at is not null
         and tstzrange(x.starts_at, x.starts_at + make_interval(mins => coalesce(x.minutes, 40)))
             && tstzrange(appt.starts_at, appt.starts_at + make_interval(mins => coalesce(appt.minutes, 40)))
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
      'ok', true, 'status', 'onay', 'cancelled', cancelled, 'coachName', coalesce(coach_name, 'Koç'),
      'message', format('Kabul: %s. Aynı saat için diğer bekleyen talepler iptal edildi (%s).', coalesce(coach_name, 'Koç'), cancelled)
    );
  end if;

  update public.appointments set status = 'iptal', cancel_reason = 'coach_rejected'
   where id = appt.id and status = 'bekliyor';
  if appt.availability_id is not null then
    update public.coach_availability set status = 'open' where id = appt.availability_id and status = 'held';
  end if;
  return jsonb_build_object('ok', true, 'status', 'iptal', 'cancelled', 0);
end;
$$;

-- 7) Onaylı randevu iptali: talebi bir taraf açar, KARŞI taraf (veya yönetici) karar verir -----------
alter table public.appointments add column if not exists cancel_requested_by uuid;

alter table public.appointments drop constraint if exists appointments_cancel_reason_check;
alter table public.appointments add constraint appointments_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in (
      'student_no_show', 'sibling_accepted', 'coach_rejected', 'expired',
      'approved_cancel_request', 'approved_cancel_accepted'
    )
  );
alter table public.appointments drop constraint if exists appointments_cancel_decision_check;
alter table public.appointments add constraint appointments_cancel_decision_check
  check (cancel_decision is null or cancel_decision in ('pending', 'accepted', 'denied'));

create table if not exists public.appointment_cancel_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  actor uuid not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint appointment_cancel_events_action_check check (action in ('request', 'duplicate', 'accept', 'deny'))
);
alter table public.appointment_cancel_events enable row level security;
alter table public.appointment_cancel_events force row level security;
drop policy if exists "cancel_events_select" on public.appointment_cancel_events;
create policy "cancel_events_select" on public.appointment_cancel_events
  for select using (public.is_admin() or actor = auth.uid() or public.appointment_is_party(appointment_id));
drop policy if exists "cancel_events_insert_definer" on public.appointment_cancel_events;
create policy "cancel_events_insert_definer" on public.appointment_cancel_events
  for insert to postgres with check (true);
revoke all on table public.appointment_cancel_events from public, anon, authenticated;
grant select on table public.appointment_cancel_events to authenticated;

create or replace function public.request_cancel_approved_appointment(p_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  n int := 0;
begin
  if auth.uid() is null then raise exception 'oturum gerekli'; end if;
  if not public.caller_account_active() then raise exception 'hesap askıda'; end if;
  select * into appt from public.appointments a where a.id = p_id for update;
  if not found then raise exception 'randevu yok'; end if;
  if appt.status is distinct from 'onay' then raise exception 'yalnız onaylı randevu için iptal talebi'; end if;
  if not (appt.student_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = appt.coach_id and c.user_id = auth.uid())) then
    raise exception 'yetkisiz';
  end if;
  if appt.cancel_requested_at is not null and coalesce(appt.cancel_decision, 'pending') = 'pending' then
    insert into public.appointment_cancel_events (appointment_id, actor, action) values (appt.id, auth.uid(), 'duplicate');
    return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', true);
  end if;
  update public.appointments
     set cancel_requested_at = pg_catalog.now(), cancel_requested_by = auth.uid(),
         cancel_reason = 'approved_cancel_request', cancel_decision = 'pending'
   where id = appt.id and status = 'onay'
     and (cancel_requested_at is null or cancel_decision is distinct from 'pending');
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.appointment_cancel_events (appointment_id, actor, action) values (appt.id, auth.uid(), 'duplicate');
    return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', true);
  end if;
  insert into public.appointment_cancel_events (appointment_id, actor, action) values (appt.id, auth.uid(), 'request');
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', false);
end;
$$;

create or replace function public.decide_approved_appointment_cancel(p_id text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  appt public.appointments%rowtype;
  is_party boolean := false;
  n int := 0;
begin
  if auth.uid() is null then raise exception 'oturum gerekli'; end if;
  if not public.caller_account_active() then raise exception 'hesap askıda'; end if;
  select * into appt from public.appointments a where a.id = p_id for update;
  if not found then raise exception 'randevu yok'; end if;
  if appt.status is distinct from 'onay' then raise exception 'yalnız onaylı randevu'; end if;
  if appt.cancel_requested_at is null or coalesce(appt.cancel_decision, 'pending') is distinct from 'pending' then
    raise exception 'iptal talebi yok';
  end if;
  is_party := appt.student_id = auth.uid()
    or exists (select 1 from public.coaches c where c.id = appt.coach_id and c.user_id = auth.uid());
  if not public.is_admin() then
    if not is_party then raise exception 'yetkisiz'; end if;
    if appt.cancel_requested_by is not distinct from auth.uid() then
      raise exception 'kendi iptal talebine karşı taraf karar verir';
    end if;
  end if;
  if p_accept then
    update public.appointments
       set status = 'iptal', cancel_reason = 'approved_cancel_accepted', cancel_decision = 'accepted'
     where id = appt.id and status = 'onay' and cancel_decision = 'pending';
    get diagnostics n = row_count;
    if n = 0 then raise exception 'iptal talebi yok'; end if;
    if appt.availability_id is not null then
      update public.coach_availability
         set status = case when starts_at > pg_catalog.now() + interval '30 minutes' then 'open' else 'closed' end
       where id = appt.availability_id and status = 'booked';
    end if;
    insert into public.appointment_cancel_events (appointment_id, actor, action) values (appt.id, auth.uid(), 'accept');
    return jsonb_build_object('ok', true, 'status', 'iptal', 'deleted', false);
  end if;
  update public.appointments set cancel_decision = 'denied'
   where id = appt.id and status = 'onay' and cancel_decision = 'pending';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'iptal talebi yok'; end if;
  insert into public.appointment_cancel_events (appointment_id, actor, action) values (appt.id, auth.uid(), 'deny');
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', false, 'decision', 'denied');
end;
$$;

revoke all on function public.request_cancel_approved_appointment(text) from public, anon;
grant execute on function public.request_cancel_approved_appointment(text) to authenticated;
revoke all on function public.decide_approved_appointment_cancel(text, boolean) from public, anon;
grant execute on function public.decide_approved_appointment_cancel(text, boolean) to authenticated;

-- 8) Görüşme zaman penceresi ------------------------------------------------------------------------
create or replace function public.can_join_meeting(p_appointment_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
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
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active') then
    return false;
  end if;
  if not public.appointment_is_party(p_appointment_id) then
    return false;
  end if;
  if exists (
    select 1 from public.appointments a
      join public.coaches c on c.id = a.coach_id
     where a.id = p_appointment_id and c.user_id = auth.uid() and c.status is distinct from 'active'
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

  return now() >= appt.starts_at - make_interval(mins => coalesce(appt.join_before_min, 20))
     and now() <= appt.starts_at + make_interval(mins => coalesce(appt.minutes, 40) + coalesce(appt.join_after_min, 15));
end;
$$;

create or replace function public.end_meeting(p_appointment_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
  if exists (select 1 from public.appointments a where a.id = p_appointment_id and a.starts_at > now()) then
    raise exception 'ders başlamadan bitirilemez';
  end if;

  perform public._finish_meeting_room(p_appointment_id, auth.uid());

  return jsonb_build_object('ok', true, 'status', 'ended', 'recording', false);
end;
$$;

-- 9) Destek: koç modundan yazan onaylı koç ---------------------------------------------------------
create or replace function public.support_force_ticket()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  wants text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.is_admin() then
    new.user_id := auth.uid();
    if tg_op = 'INSERT' then
      new.status := 'new';
      wants := lower(coalesce(new.sender_role, 'student'));
      if wants = 'coach' and public.own_active_coach_id() is not null then
        new.sender_role := 'coach';
      else
        new.sender_role := 'student';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.email := left(coalesce(nullif(auth.jwt() ->> 'email', ''), new.email, ''), 320);
    new.first_name := left(trim(coalesce(new.first_name, '')), 80);
    new.last_name := left(trim(coalesce(new.last_name, '')), 80);
    new.subject := left(trim(new.subject), 160);
    new.body := left(trim(new.body), 4000);
    if new.sender_role is null or new.sender_role not in ('student', 'coach') then
      new.sender_role := 'student';
    end if;
  elsif public.is_admin() then
    new.user_id := old.user_id;
    new.email := old.email;
    new.first_name := old.first_name;
    new.last_name := old.last_name;
    new.subject := old.subject;
    new.body := old.body;
    new.sender_role := old.sender_role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.support_force_reply()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  new.author_id := auth.uid();
  if public.is_admin() then
    new.role := 'admin';
  else
    if not exists (
      select 1 from public.support_tickets t
      where t.id = new.ticket_id and t.user_id = auth.uid()
    ) then
      raise exception 'Kayıt bulunamadı';
    end if;
    select case when t.sender_role = 'coach' then 'coach' else 'student' end into new.role
      from public.support_tickets t where t.id = new.ticket_id;
  end if;
  new.body := left(trim(new.body), 4000);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_class c where c.oid = 'public.coach_directory'::regclass
                 and 'security_invoker=true' = any(coalesce(c.reloptions, '{}'))) then
    raise exception 'SON_KONTROL_BASARISIZ: coach_directory - geri aliniyor';
  end if;
  if pg_catalog.to_regprocedure('public.coach_directory_rows()') is null
     or pg_catalog.to_regprocedure('public.request_cancel_approved_appointment(text)') is null
     or pg_catalog.to_regprocedure('public.decide_approved_appointment_cancel(text,boolean)') is null
     or pg_catalog.to_regprocedure('public.coach_student_brief(uuid)') is null then
    raise exception 'SON_KONTROL_BASARISIZ: fonksiyon eksik - geri aliniyor';
  end if;
  if position('kendi saatine' in pg_catalog.pg_get_functiondef('public.request_appointment(uuid)'::regprocedure)) = 0 then
    raise exception 'SON_KONTROL_BASARISIZ: request_appointment - geri aliniyor';
  end if;
  if exists (select 1 from public.profiles where role = 'coach') then
    raise exception 'SON_KONTROL_BASARISIZ: saf koç hesabı kaldı - geri aliniyor';
  end if;
end
$$;

commit;

select 'CANLI_063_OK' as sonuc;