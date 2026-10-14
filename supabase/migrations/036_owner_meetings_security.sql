-- Yerel / staging. Production’a bu turda uygulanmaz.
-- 030 platform_owner + 032 disable + 034 dizin gerekir.
-- Silme yok. Oturum iptali yalnız askıdaki non-owner. Test koç dizin dışı.
-- Kayıt kovası özel; sihirli bayt edge’de (meeting-record-ingest).

alter table public.coaches
  add column if not exists is_test boolean not null default false;

create or replace function public.coach_directory_cards()
returns table (
  id uuid,
  name text,
  photo text,
  track text,
  focus text,
  experience text,
  bio text,
  student_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.photo, c.track, c.focus, c.experience, c.bio, c.student_count, c.created_at
  from public.coaches c
  inner join public.profiles p on p.id = c.user_id
  where c.status = 'active'
    and p.account_status = 'active'
    and coalesce(c.is_test, false) = false;
$$;

create or replace function public.grant_owner_premium_entitlement(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.owner_confirm_reason(p_owner) is distinct from 'ok' then
    return jsonb_build_object('ok', false, 'skipped', true, 'reason', 'sahip UUID doğrulanamadı; paket yazılmadı');
  end if;
  update public.profiles
    set
      plan = 'premium',
      subscription_status = 'active',
      subscription_started_at = coalesce(subscription_started_at, now()),
      subscription_ends_at = null,
      billing_provider = case when billing_provider = '' then 'owner_privilege' else billing_provider end,
      updated_at = now()
    where id = p_owner
      and account_status = 'active';
  return jsonb_build_object('ok', true, 'skipped', false, 'plan', 'premium', 'role_unchanged', true);
end;
$$;

revoke all on function public.grant_owner_premium_entitlement(uuid) from public, anon, authenticated;

create or replace function public.revoke_non_owner_sessions(p_confirm_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
begin
  if public.owner_confirm_reason(p_confirm_owner) is distinct from 'ok' then
    return jsonb_build_object('ok', false, 'skipped', true, 'revoked', 0, 'reason', 'sahip UUID doğrulanamadı; oturum yok');
  end if;
  delete from auth.sessions s
  where s.user_id is distinct from p_confirm_owner
    and s.user_id in (
      select p.id from public.profiles p
      where p.account_status = 'pasif'
        and p.id not in (select k.id from public.keep_ids_for_disable() k)
    );
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'skipped', false, 'revoked', n);
end;
$$;

revoke all on function public.revoke_non_owner_sessions(uuid) from public, anon, authenticated;

create or replace function public.disable_non_owner_accounts(p_confirm_owner uuid, p_expect jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  actor uuid;
  n_prof integer := 0;
  n_coach integer := 0;
  appt_before integer := 0;
  meet_before integer := 0;
  pay_before integer := 0;
  sessions jsonb;
begin
  perform pg_advisory_xact_lock(932032);

  preview := public.preview_disable_non_owner_accounts(p_confirm_owner);
  if coalesce((preview->>'skipped')::boolean, true) then
    return preview || jsonb_build_object('updated_profiles', 0, 'updated_coaches', 0, 'sessions_revoked', 0);
  end if;
  if p_expect is null or not public.disable_counts_match(preview, p_expect) then
    return preview || jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', case when p_expect is null
        then 'beklenen sayılar yok; toplu kapatma yok'
        else 'beklenen sayılar eşleşmedi; toplu kapatma yok'
      end,
      'updated_profiles', 0,
      'updated_coaches', 0,
      'sessions_revoked', 0
    );
  end if;

  if to_regclass('public.appointments') is not null then
    select count(*)::integer into appt_before from public.appointments;
  end if;
  if to_regclass('public.meeting_rooms') is not null then
    select count(*)::integer into meet_before from public.meeting_rooms;
  end if;
  if to_regclass('public.billing_payments') is not null then
    select count(*)::integer into pay_before from public.billing_payments;
  end if;

  actor := p_confirm_owner;

  update public.profiles p
  set account_status = 'pasif', updated_at = now()
  where p.account_status is distinct from 'pasif'
    and p.id not in (select k.id from public.keep_ids_for_disable() k);
  get diagnostics n_prof = row_count;

  update public.coaches c
  set
    status_before_suspend = c.status,
    status = 'pasif',
    updated_at = now()
  where c.status = 'active'
    and c.user_id not in (select k.id from public.keep_ids_for_disable() k)
    and c.status_before_suspend is null;
  get diagnostics n_coach = row_count;

  if to_regclass('public.admin_account_events') is not null and n_prof > 0 then
    insert into public.admin_account_events (actor_id, target_id, action)
    select actor, p.id, 'suspend'
    from public.profiles p
    where p.account_status = 'pasif'
      and p.id not in (select k.id from public.keep_ids_for_disable() k)
      and p.updated_at >= now() - interval '5 seconds';
  end if;

  if to_regclass('public.appointments') is not null then
    if (select count(*)::integer from public.appointments) is distinct from appt_before then
      raise exception 'randevu sayısı değişti; işlem geri alınır';
    end if;
  end if;
  if to_regclass('public.meeting_rooms') is not null then
    if (select count(*)::integer from public.meeting_rooms) is distinct from meet_before then
      raise exception 'görüşme sayısı değişti; işlem geri alınır';
    end if;
  end if;
  if to_regclass('public.billing_payments') is not null then
    if (select count(*)::integer from public.billing_payments) is distinct from pay_before then
      raise exception 'ödeme sayısı değişti; işlem geri alınır';
    end if;
  end if;

  sessions := public.revoke_non_owner_sessions(p_confirm_owner);

  return preview || jsonb_build_object(
    'updated_profiles', n_prof,
    'updated_coaches', n_coach,
    'appointments_preserved', true,
    'meetings_preserved', true,
    'payments_preserved', true,
    'sessions_revoked', coalesce((sessions->>'revoked')::integer, 0)
  );
end;
$$;

revoke all on function public.disable_non_owner_accounts(uuid, jsonb) from public, anon, authenticated;

create table if not exists public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  room_id uuid,
  student_id uuid not null references auth.users(id) on delete restrict,
  coach_id uuid not null,
  consent_student boolean not null default false,
  consent_coach boolean not null default false,
  recording_status text not null default 'pending',
  object_path text not null default '',
  duration_sec integer,
  started_at timestamptz,
  ended_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  constraint meeting_recordings_status_check check (
    recording_status in ('pending', 'recording', 'uploaded', 'failed', 'purged')
  )
);

create table if not exists public.meeting_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.meeting_recordings(id) on delete restrict,
  appointment_id text not null,
  student_id uuid not null,
  coach_id uuid not null,
  risk_level text not null default 'none',
  rationale text not null default '',
  transcript_ref text not null default '',
  model_confidence text not null default 'uncertain',
  analysis_status text not null default 'queued',
  analysis_version text not null default 'v1',
  error_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_ai_reviews_risk_check check (risk_level in ('none', 'low', 'medium', 'high')),
  constraint meeting_ai_reviews_status_check check (analysis_status in ('queued', 'running', 'done', 'failed')),
  constraint meeting_ai_reviews_conf_check check (model_confidence in ('low', 'uncertain', 'high'))
);

create unique index if not exists meeting_ai_reviews_recording_uidx
  on public.meeting_ai_reviews (recording_id);

create table if not exists public.admin_security_alerts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.meeting_ai_reviews(id) on delete restrict,
  appointment_id text,
  risk_level text not null default 'high',
  title text not null,
  body text not null default '',
  review_state text not null default 'open',
  admin_notes text not null default '',
  action_taken text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_security_alerts_state_check check (review_state in ('open', 'reviewing', 'dismissed', 'escalated'))
);

create table if not exists public.admin_security_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  alert_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.meeting_recordings enable row level security;
alter table public.meeting_ai_reviews enable row level security;
alter table public.admin_security_alerts enable row level security;
alter table public.admin_security_audit enable row level security;
alter table public.meeting_recordings force row level security;
alter table public.meeting_ai_reviews force row level security;
alter table public.admin_security_alerts force row level security;
alter table public.admin_security_audit force row level security;

drop policy if exists "rec_select_party" on public.meeting_recordings;
create policy "rec_select_party" on public.meeting_recordings
  for select using (
    public.is_admin()
    or student_id = auth.uid()
    or coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
  );

drop policy if exists "ai_select_admin" on public.meeting_ai_reviews;
create policy "ai_select_admin" on public.meeting_ai_reviews
  for select using (public.is_admin());

drop policy if exists "ai_select_party_safe" on public.meeting_ai_reviews;
create policy "ai_select_party_safe" on public.meeting_ai_reviews
  for select using (
    not public.is_admin()
    and analysis_status in ('queued', 'running', 'done', 'failed')
    and (
      student_id = auth.uid()
      or coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
    )
  );

drop policy if exists "alert_admin" on public.admin_security_alerts;
create policy "alert_admin" on public.admin_security_alerts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit_admin" on public.admin_security_audit;
create policy "audit_admin" on public.admin_security_audit
  for select using (public.is_admin());

revoke all on table public.meeting_recordings from public, anon;
revoke all on table public.meeting_ai_reviews from public, anon, authenticated;
revoke all on table public.admin_security_alerts from public, anon, authenticated;
revoke all on table public.admin_security_audit from public, anon, authenticated;
grant select on table public.meeting_recordings to authenticated;

create or replace function public.my_meeting_ai_status()
returns table (
  recording_id uuid,
  appointment_id text,
  analysis_status text,
  analysis_version text,
  under_admin_review boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.recording_id, r.appointment_id, r.analysis_status, r.analysis_version,
    exists (select 1 from public.admin_security_alerts a where a.review_id = r.id and a.review_state in ('open', 'reviewing', 'escalated'))
  from public.meeting_ai_reviews r
  where r.student_id = auth.uid()
     or r.coach_id in (select c.id from public.coaches c where c.user_id = auth.uid());
$$;

create or replace function public.admin_security_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'appointment_id', r.appointment_id,
      'coach_id', r.coach_id,
      'student_id', r.student_id,
      'risk_level', r.risk_level,
      'rationale', r.rationale,
      'transcript_ref', r.transcript_ref,
      'model_confidence', r.model_confidence,
      'analysis_status', r.analysis_status,
      'analysis_version', r.analysis_version,
      'error_text', r.error_text,
      'created_at', r.created_at
    ) order by r.created_at desc)
    from public.meeting_ai_reviews r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.my_meeting_ai_status() from public, anon;
grant execute on function public.my_meeting_ai_status() to authenticated;
revoke all on function public.admin_security_inbox() from public, anon, authenticated;
grant execute on function public.admin_security_inbox() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-recordings',
  'meeting-recordings',
  false,
  104857600,
  array['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4', 'audio/mpeg']::text[]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meet_rec_insert_own" on storage.objects;
create policy "meet_rec_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meeting-recordings'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "meet_rec_select" on storage.objects;
create policy "meet_rec_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'meeting-recordings'
  and public.caller_account_active()
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = (select auth.uid()::text)
  )
);

-- SQL Editor: platform_owner insert + preview + disable + grant premium (e-posta yok):
--   insert into public.platform_owner (user_id) values ('<uuid>');
--   select public.preview_disable_non_owner_accounts('<uuid>'::uuid);
--   select public.disable_non_owner_accounts('<uuid>'::uuid, '<preview>'::jsonb);
--   select public.grant_owner_premium_entitlement('<uuid>'::uuid);
