-- Sunucu tarafı STT ses denetimi (istemci transcript YASAK).
-- Production’a bu turda uygulanmaz. LiveKit Egress / STT sağlayıcı yoksa yaptırım kapalı kalır.
-- Gizlilik: ham ses ve tam transcript saklanmaz; yalnızca etiket + güven + olay kimliği.

-- Randevu kimlikleri metin (009); uuid kısıtı ses yolu ile uyumsuzdu.
alter table public.moderation_violations
  alter column appointment_id type text using appointment_id::text;

-- Tekrarlayan STT webhook’ları için idempotency.
create table if not exists public.moderation_stt_events (
  event_id text primary key,
  appointment_id text not null,
  speaker_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default '',
  stt_confidence numeric(4,3) not null default 0
    check (stt_confidence >= 0 and stt_confidence <= 1),
  evidence_label text not null default '',
  violation_id uuid references public.moderation_violations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_stt_events_created_idx
  on public.moderation_stt_events (created_at desc);
create index if not exists moderation_stt_events_speaker_idx
  on public.moderation_stt_events (speaker_user_id, created_at desc);

alter table public.moderation_stt_events enable row level security;
alter table public.moderation_stt_events force row level security;

revoke all on table public.moderation_stt_events from public, anon, authenticated;
-- Yönetici salt okuma (ihlal incelemesi); yazma yalnızca service_role.
grant select on table public.moderation_stt_events to authenticated;

drop policy if exists moderation_stt_events_admin_select on public.moderation_stt_events;
create policy moderation_stt_events_admin_select on public.moderation_stt_events
  for select using (public.is_admin());

-- Konuşmacının randevu tarafı olduğunu auth.uid() olmadan doğrula (service_role).
create or replace function public.appointment_user_is_party(p_appointment_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    left join public.coaches c on c.id = a.coach_id
    where a.id = p_appointment_id
      and p_user_id is not null
      and (
        a.student_id = p_user_id
        or c.user_id = p_user_id
      )
  );
$$;

revoke all on function public.appointment_user_is_party(text, uuid) from public, anon, authenticated;
grant execute on function public.appointment_user_is_party(text, uuid) to service_role;

-- Yalnızca service_role: imzalı STT webhook edge’i çağırır.
-- p_snippet: en fazla 120 karakter (etiket taraması); tam transcript saklanmaz.
create or replace function public.service_record_voice_stt_violation(
  p_event_id text,
  p_appointment_id text,
  p_speaker_user_id uuid,
  p_provider text,
  p_stt_confidence numeric,
  p_snippet text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  vid uuid;
  scan jsonb;
  blocked boolean;
  severe boolean;
  conf numeric;
  cat text;
  lab text;
  existing uuid;
  snippet text := left(trim(coalesce(p_snippet, '')), 120);
begin
  if coalesce(nullif(trim(p_event_id), ''), '') is null or length(p_event_id) > 128 then
    return jsonb_build_object('ok', false, 'error', 'geçersiz olay');
  end if;
  if coalesce(nullif(trim(p_appointment_id), ''), '') is null or length(p_appointment_id) > 80 then
    return jsonb_build_object('ok', false, 'error', 'geçersiz randevu');
  end if;
  if p_speaker_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'konuşmacı gerekli');
  end if;
  if coalesce(p_stt_confidence, 0) < 0.9 then
    return jsonb_build_object('ok', true, 'blocked', false, 'skipped', 'low_stt_confidence');
  end if;
  if snippet = '' or length(snippet) < 2 then
    return jsonb_build_object('ok', true, 'blocked', false, 'skipped', 'empty_snippet');
  end if;

  select violation_id into existing
  from public.moderation_stt_events
  where event_id = p_event_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', existing, 'suspended', false);
  end if;

  if not public.appointment_user_is_party(p_appointment_id, p_speaker_user_id) then
    return jsonb_build_object('ok', false, 'error', 'konuşmacı bu görüşmede değil');
  end if;

  scan := public.scan_text_profanity(snippet);
  blocked := coalesce((scan->>'blocked')::boolean, false);
  severe := coalesce((scan->>'severe')::boolean, false);
  conf := least(
    coalesce((scan->>'confidence')::numeric, 0),
    coalesce(p_stt_confidence, 0)
  );
  cat := coalesce(nullif(scan->>'category', ''), 'none');
  lab := left(coalesce(scan->>'label', ''), 80);

  begin
    insert into public.moderation_stt_events (
      event_id, appointment_id, speaker_user_id, provider, stt_confidence, evidence_label
    ) values (
      p_event_id, p_appointment_id, p_speaker_user_id,
      left(coalesce(p_provider, ''), 40),
      least(greatest(coalesce(p_stt_confidence, 0), 0), 1),
      lab
    );
  exception when unique_violation then
    select violation_id into existing from public.moderation_stt_events where event_id = p_event_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', existing, 'suspended', false);
  end;

  if not blocked then
    return jsonb_build_object('ok', true, 'blocked', false, 'suspended', false, 'confidence', conf);
  end if;

  insert into public.moderation_violations (
    user_id, kind, category, confidence, status, appointment_id, evidence_label
  ) values (
    p_speaker_user_id, 'voice_meeting', cat, conf, 'reviewing', p_appointment_id, lab
  )
  returning id into vid;

  update public.moderation_stt_events
    set violation_id = vid
  where event_id = p_event_id;

  if public.moderation_target_is_admin(p_speaker_user_id) then
    return jsonb_build_object(
      'ok', true, 'id', vid, 'blocked', true, 'suspended', false,
      'admin_review_only', true, 'eligible_auto_suspend', false, 'confidence', conf
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', vid,
    'blocked', true,
    'severe', severe,
    'confidence', conf,
    'suspended', false,
    'eligible_auto_suspend', (severe and conf >= 0.92),
    'speaker_user_id', p_speaker_user_id
  );
end;
$$;

revoke all on function public.service_record_voice_stt_violation(text, text, uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.service_record_voice_stt_violation(text, text, uuid, text, numeric, text)
  to service_role;
