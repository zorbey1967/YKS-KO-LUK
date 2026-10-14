-- Yerel / staging taslak. Production’a bu turda uygulanmaz.
-- İstemci Storage INSERT kapatılır; sahte MIME/imza kova Content-Type’ına güvenmez.
-- Yükleme exam-upload / meeting-recording-ingest Edge Function + sihirli bayt.
-- LiveKit Egress yok: recording_enabled false kalır; AI otomatik hesap kapatmaz.

drop policy if exists "exam_scans_insert_own" on storage.objects;
drop policy if exists "meet_rec_insert_own" on storage.objects;

create unique index if not exists admin_security_alerts_review_uidx
  on public.admin_security_alerts (review_id)
  where review_id is not null;

create unique index if not exists meeting_recordings_appt_uidx
  on public.meeting_recordings (appointment_id);

create or replace function public.meeting_recording_pipeline_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

create or replace function public.set_meeting_recording_consent(p_appointment_id text, p_consent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.meeting_recordings%rowtype;
  is_student boolean := false;
  is_coach boolean := false;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  if p_appointment_id is null or length(trim(p_appointment_id)) < 1 then
    raise exception 'randevu gerekli';
  end if;

  select exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.student_id = auth.uid()
  ) into is_student;
  select exists (
    select 1 from public.appointments a
    join public.coaches c on c.id = a.coach_id
    where a.id = p_appointment_id and c.user_id = auth.uid()
  ) into is_coach;
  if not is_student and not is_coach and not public.is_admin() then
    raise exception 'yetkisiz';
  end if;

  insert into public.meeting_recordings (appointment_id, student_id, coach_id, consent_student, consent_coach, recording_status)
  select a.id, a.student_id, a.coach_id,
    case when is_student then coalesce(p_consent, false) else false end,
    case when is_coach then coalesce(p_consent, false) else false end,
    'pending'
  from public.appointments a
  where a.id = p_appointment_id
  on conflict (appointment_id) do nothing;

  select * into rec from public.meeting_recordings r where r.appointment_id = p_appointment_id order by r.created_at desc limit 1;
  if rec.id is null then
    raise exception 'kayıt satırı yok';
  end if;
  if is_student then
    update public.meeting_recordings set consent_student = coalesce(p_consent, false) where id = rec.id;
  elsif is_coach then
    update public.meeting_recordings set consent_coach = coalesce(p_consent, false) where id = rec.id;
  end if;
  return jsonb_build_object(
    'ok', true,
    'pipeline_ready', public.meeting_recording_pipeline_ready(),
    'recording_enabled', false
  );
end;
$$;

create or replace function public.enqueue_meeting_ai_review(p_recording_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.meeting_recordings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select * into rec from public.meeting_recordings where id = p_recording_id;
  if rec.id is null then
    raise exception 'kayıt yok';
  end if;
  if rec.recording_status is distinct from 'uploaded' then
    return jsonb_build_object('ok', false, 'reason', 'uploaded değil');
  end if;
  if rec.consent_student is not true or rec.consent_coach is not true then
    return jsonb_build_object('ok', false, 'reason', 'izin yok');
  end if;
  insert into public.meeting_ai_reviews (
    recording_id, appointment_id, student_id, coach_id, analysis_status, model_confidence
  ) values (
    rec.id, rec.appointment_id, rec.student_id, rec.coach_id, 'queued', 'uncertain'
  )
  on conflict (recording_id) do nothing;
  return jsonb_build_object('ok', true, 'queued', true);
end;
$$;

create or replace function public.retry_failed_meeting_ai(p_recording_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  update public.meeting_ai_reviews
    set analysis_status = 'queued', error_text = '', updated_at = now()
    where recording_id = p_recording_id and analysis_status = 'failed';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'failed kuyruk yok');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.meeting_recording_pipeline_ready() from public, anon;
grant execute on function public.meeting_recording_pipeline_ready() to authenticated;
revoke all on function public.set_meeting_recording_consent(text, boolean) from public, anon;
grant execute on function public.set_meeting_recording_consent(text, boolean) to authenticated;
revoke all on function public.enqueue_meeting_ai_review(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_meeting_ai_review(uuid) to authenticated;
revoke all on function public.retry_failed_meeting_ai(uuid) from public, anon, authenticated;
grant execute on function public.retry_failed_meeting_ai(uuid) to authenticated;
