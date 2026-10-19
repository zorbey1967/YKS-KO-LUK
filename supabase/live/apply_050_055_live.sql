-- CANLI UYGULAMA: 050, 051, 052, 054, 055 (053 canlıda zaten var; tekrar çalıştırılmaz).
-- Tek işlem: herhangi bir adım hata verirse hiçbir değişiklik kalmaz (otomatik geri alma).
-- Önce önkoşullar kontrol edilir; 041–049 veya 053 eksikse hiçbir şeye dokunmadan durur.
-- Supabase SQL Editor'a dosyanın TAMAMI yapıştırılıp bir kez çalıştırılır.

begin;

do $$
declare
  missing text := '';
begin
  if to_regclass('public.platform_owner') is null then missing := missing || ' 042(platform_owner)'; end if;
  if pg_catalog.to_regprocedure('public.caller_account_active()') is null then missing := missing || ' 042(caller_account_active)'; end if;
  if to_regclass('public.support_tickets') is null then missing := missing || ' 044'; end if;
  if to_regclass('public.schedule_pdf_submissions') is null then missing := missing || ' 046'; end if;
  if to_regclass('public.coach_program_pdfs') is null then missing := missing || ' 047'; end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'support_tickets' and column_name = 'sender_role') then
    missing := missing || ' 049';
  end if;
  if to_regclass('public.billing_payments') is null or to_regclass('public.billing_subscriptions') is null
     or to_regclass('public.billing_checkout_sessions') is null then
    missing := missing || ' billing_*';
  end if;
  if not exists (select 1 from pg_proc where proname = 'protect_role' and prosrc like '%new.email := old.email%') then
    missing := missing || ' 053';
  end if;
  if missing <> '' then
    raise exception 'ONKOSUL_EKSIK:% — hiçbir değişiklik yapılmadı', missing;
  end if;
end
$$;


-- ===================== 050_content_moderation.sql =====================

-- AI / lexikon küfür denetimi + ihlal kayıtları.
-- Production’a bu turda otomatik uygulanmaz. RLS gevşetilmez; service_role istemciye verilmez.
-- Yönetici hesapları otomatik askıya alma ile kapatılmaz (yalnızca inceleme kaydı).
-- Otomatik askı: yalnızca sunucu tarafı scan_text_profanity sonucuna göre (istemci confidence’a güvenilmez).

create table if not exists public.moderation_violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('display_name', 'voice_meeting')),
  category text not null default 'profanity',
  confidence numeric(4,3) not null default 0
    check (confidence >= 0 and confidence <= 1),
  status text not null default 'reviewing'
    check (status in ('reviewing', 'suspended', 'appealed', 'restored')),
  appointment_id uuid,
  evidence_label text not null default '',
  admin_notes text not null default '',
  appeal_note text not null default '',
  admin_actor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Yeniden uygulanabilirlik: eski 050 taslağında eksik kolonlar.
alter table public.moderation_violations
  add column if not exists appeal_note text not null default '';
alter table public.moderation_violations
  add column if not exists evidence_label text not null default '';
alter table public.moderation_violations
  add column if not exists admin_notes text not null default '';
alter table public.moderation_violations
  add column if not exists admin_actor_id uuid;
alter table public.moderation_violations
  add column if not exists appointment_id uuid;

create index if not exists moderation_violations_created_idx
  on public.moderation_violations (created_at desc);
create index if not exists moderation_violations_user_idx
  on public.moderation_violations (user_id, created_at desc);
create index if not exists moderation_violations_status_idx
  on public.moderation_violations (status, created_at desc);

alter table public.moderation_violations enable row level security;
alter table public.moderation_violations force row level security;

revoke all on table public.moderation_violations from public, anon;
grant select on table public.moderation_violations to authenticated;

drop policy if exists moderation_violations_admin_select on public.moderation_violations;
create policy moderation_violations_admin_select on public.moderation_violations
  for select using (public.is_admin());

drop policy if exists moderation_violations_own_select on public.moderation_violations;
create policy moderation_violations_own_select on public.moderation_violations
  for select using (auth.uid() = user_id);

create or replace function public.scan_text_profanity(p_raw text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  compact text := public.normalize_person_key(p_raw);
  word text;
  exact_severe text[] := array[
    'amk','amq','orospu','orospucocugu','orospuevladi','sikerim','siktir','siktigim',
    'aminakoyim','aminakoyayim','yarrak','yarak','amcik','pezevenk','serefsiz',
    'ibne','gotveren','fuck','bitch','asshole'
  ];
  exact_mild text[] := array['aq','mk','mq','oc','pic','got','shit'];
  longw text[] := array[
    'aminakoy','orospucocuk','orospuevlad','siktigimin','siktirgit','gotveren','yarragi'
  ];
  w text;
  cword text;
begin
  if compact = '' or length(compact) < 2 then
    return jsonb_build_object('blocked', false, 'severe', false, 'confidence', 0, 'category', 'none', 'label', '');
  end if;
  if compact = any(exact_severe) then
    return jsonb_build_object('blocked', true, 'severe', true, 'confidence', 0.97, 'category', 'profanity', 'label', 'ağır küfür');
  end if;
  if compact = any(exact_mild) then
    return jsonb_build_object('blocked', true, 'severe', false, 'confidence', 0.85, 'category', 'profanity', 'label', 'uygunsuz ifade');
  end if;
  foreach w in array longw loop
    if length(w) >= 5 and position(w in compact) > 0 then
      return jsonb_build_object('blocked', true, 'severe', true, 'confidence', 0.94, 'category', 'profanity', 'label', 'ağır küfür');
    end if;
  end loop;
  foreach word in array regexp_split_to_array(lower(coalesce(p_raw, '')), '[\s,''._\-!?]+') loop
    cword := public.normalize_person_key(word);
    if cword = any(exact_severe) then
      return jsonb_build_object('blocked', true, 'severe', true, 'confidence', 0.97, 'category', 'profanity', 'label', 'ağır küfür');
    end if;
    if cword = any(exact_mild) then
      return jsonb_build_object('blocked', true, 'severe', false, 'confidence', 0.85, 'category', 'profanity', 'label', 'uygunsuz ifade');
    end if;
  end loop;
  return jsonb_build_object('blocked', false, 'severe', false, 'confidence', 0, 'category', 'none', 'label', '');
end;
$$;

revoke all on function public.scan_text_profanity(text) from public, anon;
grant execute on function public.scan_text_profanity(text) to authenticated;

create or replace function public.moderation_target_is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.role = 'admin'
  );
$$;

revoke all on function public.moderation_target_is_admin(uuid) from public, anon;
grant execute on function public.moderation_target_is_admin(uuid) to authenticated;

-- İstemci p_confidence/p_severe/p_auto_suspend ile askı zorlayamaz; tarama p_text üzerinde sunucuda.
-- user_id her zaman auth.uid(); başka hesaba yaptırım yok.
-- Otomatik askı bu RPC’de YOK: yalnızca ihlal kaydı (reviewing). Askı = edge service_role + Auth ban.
create or replace function public.record_moderation_violation(
  p_kind text,
  p_text text,
  p_appointment_id uuid default null,
  p_auto_suspend boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  vid uuid;
  scan jsonb;
  blocked boolean;
  severe boolean;
  conf numeric;
  cat text;
  lab text;
  eligible_auto boolean := false;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'oturum gerekli');
  end if;
  -- Ses ihlali istemci RPC ile yazılamaz; yalnızca 051 service_role STT yolu.
  if p_kind = 'voice_meeting' then
    return jsonb_build_object('ok', false, 'error', 'ses ihlali yalnızca sunucu STT');
  end if;
  if p_kind not in ('display_name') then
    return jsonb_build_object('ok', false, 'error', 'geçersiz tür');
  end if;
  if length(trim(coalesce(p_text, ''))) < 2 or length(coalesce(p_text, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'metin uygun değil');
  end if;

  scan := public.scan_text_profanity(p_text);
  blocked := coalesce((scan->>'blocked')::boolean, false);
  severe := coalesce((scan->>'severe')::boolean, false);
  conf := coalesce((scan->>'confidence')::numeric, 0);
  cat := coalesce(nullif(scan->>'category', ''), 'none');
  lab := left(coalesce(scan->>'label', ''), 80);

  if not blocked then
    return jsonb_build_object('ok', true, 'blocked', false, 'suspended', false, 'confidence', conf);
  end if;

  insert into public.moderation_violations (
    user_id, kind, category, confidence, status, appointment_id, evidence_label
  ) values (
    uid, p_kind, cat, conf, 'reviewing', p_appointment_id, lab
  )
  returning id into vid;

  if public.moderation_target_is_admin(uid) then
    return jsonb_build_object(
      'ok', true, 'id', vid, 'blocked', true, 'suspended', false,
      'admin_review_only', true, 'confidence', conf, 'severe', severe,
      'eligible_auto_suspend', false
    );
  end if;

  -- p_auto_suspend istemciden gelse bile burada askı uygulanmaz; edge karar verir.
  eligible_auto := (p_auto_suspend is true) and severe and conf >= 0.92;

  return jsonb_build_object(
    'ok', true,
    'id', vid,
    'blocked', true,
    'severe', severe,
    'confidence', conf,
    'suspended', false,
    'needs_auth_ban', false,
    'eligible_auto_suspend', eligible_auto
  );
end;
$$;

revoke all on function public.record_moderation_violation(text, text, uuid, boolean) from public, anon;
grant execute on function public.record_moderation_violation(text, text, uuid, boolean) to authenticated;

create or replace function public.admin_list_moderation_violations(p_limit integer default 100)
returns setof public.moderation_violations
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
    select *
    from public.moderation_violations
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 300));
end;
$$;

revoke all on function public.admin_list_moderation_violations(integer) from public, anon;
grant execute on function public.admin_list_moderation_violations(integer) to authenticated;

-- Hesap durumu yalnızca admin-account-status edge ile (DB+Auth atomik) değiştirilir.
-- Bu RPC ihlal satırını günceller; istemci auth_sync_status ile edge’i çağırır.
-- Böylece Auth ban fail → DB revert, RPC’nin önceden yazdığı durumla çakışmaz.
create or replace function public.admin_review_moderation_violation(
  p_id uuid,
  p_status text,
  p_notes text default '',
  p_reactivate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  v record;
  need_auth_sync text := '';
begin
  if actor is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'yetkisiz');
  end if;
  if p_status not in ('reviewing', 'suspended', 'appealed', 'restored') then
    return jsonb_build_object('ok', false, 'error', 'geçersiz durum');
  end if;
  select * into v from public.moderation_violations where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'kayıt yok');
  end if;

  update public.moderation_violations
    set status = p_status,
        admin_notes = left(coalesce(p_notes, ''), 2000),
        admin_actor_id = actor,
        updated_at = now()
  where id = p_id;

  if p_reactivate and p_status = 'restored' then
    need_auth_sync := 'active';
  elsif p_status = 'suspended' and not public.moderation_target_is_admin(v.user_id) then
    need_auth_sync := 'pasif';
  end if;

  return jsonb_build_object('ok', true, 'user_id', v.user_id, 'auth_sync_status', need_auth_sync);
end;
$$;

revoke all on function public.admin_review_moderation_violation(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_review_moderation_violation(uuid, text, text, boolean) to authenticated;

create or replace function public.appeal_moderation_violation(p_id uuid, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'oturum gerekli');
  end if;
  update public.moderation_violations
    set status = 'appealed',
        appeal_note = left(coalesce(nullif(trim(p_note), ''), appeal_note), 500),
        updated_at = now()
  where id = p_id
    and user_id = uid
    and status in ('suspended', 'reviewing');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'itiraz edilemedi');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.appeal_moderation_violation(uuid, text) from public, anon;
grant execute on function public.appeal_moderation_violation(uuid, text) to authenticated;

-- ===================== 051_meeting_stt_moderation.sql =====================

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

-- ===================== 052_oauth_signup_intent.sql =====================

-- Google OAuth sonrası koç/öğrenci intent: 027 handle_new_user signup_intent’i düşürdü.
-- E-posta ile otomatik admin YOK. İstemci metadata veya claim RPC ile intent yazar.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
  intent text;
begin
  full_name := trim(concat_ws(' ',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'));
  if full_name = '' then
    full_name := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  end if;
  if public.person_name_blocked(full_name) then
    full_name := '';
  end if;

  intent := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'intent'), ''), 'student'));
  if intent not in ('student', 'coach') then
    intent := 'student';
  end if;

  insert into public.profiles (
    id, email, name, role, account_status,
    signup_intent, signup_grade, signup_track, signup_exam
  )
  values (
    new.id,
    new.email,
    full_name,
    'student',
    'pending',
    intent,
    left(coalesce(new.raw_user_meta_data->>'grade', ''), 40),
    left(coalesce(new.raw_user_meta_data->>'track', ''), 40),
    left(coalesce(new.raw_user_meta_data->>'exam', ''), 40)
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when public.profiles.role = 'admin' then 'admin'
          else public.profiles.role
        end,
        name = case
          when nullif(trim(public.profiles.name), '') is not null then public.profiles.name
          else excluded.name
        end,
        -- Intent yalnızca hâlâ varsayılan öğrenci iken ve meta gelmişse güncellenir.
        signup_intent = case
          when public.profiles.role = 'admin' then public.profiles.signup_intent
          when public.profiles.signup_intent = 'student'
            and excluded.signup_intent in ('student', 'coach')
            then excluded.signup_intent
          else public.profiles.signup_intent
        end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- OAuth dönüşünde sessionStorage pending → sunucu (metadata OAuth’ta yok).
-- role asla admin yapılamaz; mevcut admin dokunulmaz.
create or replace function public.claim_signup_prefs(
  p_intent text,
  p_grade text default '',
  p_track text default '',
  p_exam text default '',
  p_first_name text default '',
  p_last_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  intent text := lower(coalesce(nullif(trim(p_intent), ''), 'student'));
  full_name text;
  cur record;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'oturum gerekli');
  end if;
  if intent not in ('student', 'coach') then
    return jsonb_build_object('ok', false, 'error', 'geçersiz intent');
  end if;

  select p.id, p.role, p.signup_intent, p.name, u.created_at as created_at
    into cur
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = uid
  for update of p;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profil yok');
  end if;
  if cur.role = 'admin' then
    return jsonb_build_object('ok', true, 'skipped', 'admin');
  end if;

  -- Yalnızca yeni / henüz koç intent’i yokken; eski hesapta öğrenci→koç yükseltme yok (24s).
  if cur.signup_intent = 'coach' and intent = 'student' then
    return jsonb_build_object('ok', true, 'skipped', 'already_coach_intent');
  end if;
  if cur.signup_intent = 'student' and intent = 'coach'
     and cur.created_at < now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'error', 'intent süresi doldu');
  end if;

  full_name := trim(concat_ws(' ', nullif(trim(p_first_name), ''), nullif(trim(p_last_name), '')));
  if full_name <> '' and public.person_name_blocked(full_name) then
    full_name := '';
  end if;

  update public.profiles
  set
    signup_intent = intent,
    signup_grade = case when nullif(trim(p_grade), '') is null then signup_grade else left(trim(p_grade), 40) end,
    signup_track = case when nullif(trim(p_track), '') is null then signup_track else left(trim(p_track), 40) end,
    signup_exam = case when nullif(trim(p_exam), '') is null then signup_exam else left(trim(p_exam), 40) end,
    name = case
      when nullif(trim(name), '') is not null then name
      when full_name <> '' then full_name
      else name
    end,
    updated_at = now()
  where id = uid;

  return jsonb_build_object('ok', true, 'signup_intent', intent);
end;
$$;

revoke all on function public.claim_signup_prefs(text, text, text, text, text, text) from public, anon;
grant execute on function public.claim_signup_prefs(text, text, text, text, text, text) to authenticated;

-- ===================== 054_apply_verified_payment_v2.sql =====================

-- apply_verified_payment v2. 043 dosyası değiştirilmez; imza ve parametreler aynı (edge çağrısı değişmez).
-- 1) Aynı (provider, provider_payment_id) zaten succeeded/refunded ise abonelik, profil ve oturum
--    yeniden yazılmaz; duplicate_payment = true ve mevcut period_end döner. Tekrar/gecikmiş webhook
--    planı düşürmez, iptal edilmiş üyeliği yeniden active yapmaz.
-- 2) Aynı plan aktifken yenileme: period_end = greatest(period_end, now()) + 30 gün (kalan gün korunur).
-- 3) Farklı plan (yükseltme/düşürme) ve abonelik satırı olmayan (deneme) durum 043 ile aynı: now() + 30 gün.
--    Proration yok.
-- 4) İlk kez gelen ama daha eski bir ödeme oturumuna ait ödeme, daha yeni oturumla açılmış aktif farklı
--    planı düşürmez: ödeme kaydı ve oturum paid yazılır, abonelik/profil değişmez, late_payment = true.
-- authenticated/anon EXECUTE yok. Satır silme yok.

create or replace function public.apply_verified_payment(
  p_user_id uuid,
  p_plan_id text,
  p_provider text,
  p_payment_id text,
  p_amount_try numeric,
  p_checkout_id uuid default null,
  p_subscription_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  now_ts timestamptz := pg_catalog.clock_timestamp();
  inserted int := 0;
  prev_status text;
  prev_uid uuid;
  pay_amt numeric;
  pay_cur text;
  chk_amt numeric;
  chk_cur text;
  chk_uid uuid;
  chk_created timestamptz;
  cur_plan text;
  cur_status text;
  cur_start timestamptz;
  cur_end timestamptz;
  cur_provider text;
  cur_sub_id text;
  cur_created timestamptz;
  starts timestamptz;
  ends timestamptz;
begin
  if p_user_id is null or p_payment_id is null or p_provider is null then
    raise exception 'eksik ödeme kimliği';
  end if;
  if p_plan_id not in ('pro', 'premium') then
    raise exception 'paket_yok';
  end if;
  if p_amount_try is null or p_amount_try <= 0 then
    raise exception 'tutar_gecersiz';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || p_user_id::text));

  if p_checkout_id is not null then
    select s.amount_try, s.currency, s.user_id, s.created_at
      into chk_amt, chk_cur, chk_uid, chk_created
    from public.billing_checkout_sessions s
    where s.id = p_checkout_id;
    if not found then
      raise exception 'oturum_yok';
    end if;
    if chk_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    if upper(coalesce(chk_cur, 'TRY')) is distinct from 'TRY' then
      raise exception 'para_birimi';
    end if;
    if abs(coalesce(chk_amt, 0) - p_amount_try) > 0.009 then
      raise exception 'tutar_uyusmuyor';
    end if;
  end if;

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (
    p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id
  )
  on conflict (provider, provider_payment_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    select p.status, p.user_id, p.amount_try, p.currency
      into prev_status, prev_uid, pay_amt, pay_cur
    from public.billing_payments p
    where p.provider = p_provider and p.provider_payment_id = p_payment_id;
    if abs(coalesce(pay_amt, 0) - p_amount_try) > 0.009 or upper(coalesce(pay_cur, '')) is distinct from 'TRY' then
      raise exception 'tutar_uyusmuyor';
    end if;

    if prev_status in ('succeeded', 'refunded') then
      select s.period_end into cur_end
      from public.billing_subscriptions s
      where s.user_id = p_user_id;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', true,
        'late_payment', false,
        'period_end', cur_end
      );
    end if;

    -- Eski pending/failed/canceled kayıt: aynı öğrenciye aitse doğrulanmış ödeme olarak işlenir.
    if prev_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    update public.billing_payments
      set status = 'succeeded',
          checkout_session_id = coalesce(checkout_session_id, p_checkout_id)
      where provider = p_provider and provider_payment_id = p_payment_id;
  end if;

  select s.plan_id, s.status, s.period_start, s.period_end, s.provider, s.provider_subscription_id
    into cur_plan, cur_status, cur_start, cur_end, cur_provider, cur_sub_id
    from public.billing_subscriptions s
   where s.user_id = p_user_id;

  if cur_plan is not null
     and cur_status = 'active'
     and cur_end is not null and cur_end > now_ts
     and cur_plan is distinct from p_plan_id
     and chk_created is not null
     and coalesce(cur_sub_id, '') <> '' then
    select cs.created_at into cur_created
      from public.billing_payments bp
      join public.billing_checkout_sessions cs on cs.id = bp.checkout_session_id
     where bp.user_id = p_user_id
       and bp.provider = cur_provider
       and bp.provider_payment_id = cur_sub_id;
    if cur_created is not null and chk_created < cur_created then
      if p_checkout_id is not null then
        update public.billing_checkout_sessions
          set status = 'paid', updated_at = now_ts
          where id = p_checkout_id;
      end if;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', false,
        'late_payment', true,
        'period_end', cur_end
      );
    end if;
  end if;

  if cur_plan is not null
     and cur_status = 'active'
     and cur_plan = p_plan_id
     and cur_end is not null then
    starts := case when cur_end > now_ts then coalesce(cur_start, now_ts) else now_ts end;
    ends := greatest(cur_end, now_ts) + interval '30 days';
  else
    starts := now_ts;
    ends := now_ts + interval '30 days';
  end if;

  insert into public.billing_subscriptions (
    user_id, plan_id, status, period_start, period_end, provider,
    provider_subscription_id, locked_amount_try, currency, updated_at
  ) values (
    p_user_id, p_plan_id, 'active', starts, ends, p_provider,
    coalesce(nullif(p_subscription_id, ''), p_payment_id), p_amount_try, 'TRY', now_ts
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    locked_amount_try = excluded.locked_amount_try,
    currency = 'TRY',
    updated_at = now_ts;

  if p_checkout_id is not null then
    update public.billing_checkout_sessions
      set status = 'paid', updated_at = now_ts
      where id = p_checkout_id;
  end if;

  update public.profiles
    set
      plan = p_plan_id,
      subscription_status = 'active',
      subscription_started_at = starts,
      subscription_ends_at = ends,
      billing_provider = p_provider,
      provider_subscription_id = coalesce(nullif(p_subscription_id, ''), p_payment_id),
      updated_at = pg_catalog.now()
    where id = p_user_id
      and role = 'student';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicate_payment', false,
    'late_payment', false,
    'period_end', ends
  );
end;
$$;

revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated;

-- ===================== 055_commercial_readiness.sql =====================

-- 055: Ticari açılış öncesi güvenlik + üyelik düzeltmeleri (tek dosya, additive, idempotent).
--
-- 050–054 (içerik denetimi, STT, OAuth niyeti, canlı e-posta hotfix'i, ödeme v2) bu dosyadan
-- önce çalışır. 055 onların kurallarını korur ve aşağıdakileri tek yerde birleştirir.
-- Canlı şema 001–010 + MCP parçaları (prod_*) + 041–049 (+ 053) ile kuruldu; 011–040 zinciri
-- canlıda toplu uygulanmadı. Bu dosya iki durumda da aynı sonucu verir. Satır silmez,
-- tablo/kolon düşürmez.
--
--  1. profiles: istemci yalnızca kendi satırını okuyabilir ve yalnızca ad / hedef alanlarını
--     güncelleyebilir. INSERT, DELETE ve e-posta / rol / plan / üyelik kolonlarına yazma kapalı.
--     (001'deki "profiles_own_upsert" FOR ALL politikası kaldırılır.)
--  2. protect_role / handle_new_user: e-posta ile yönetici atama yok (053 ile aynı kural;
--     istemci rol / durum / e-posta değiştiremez). handle_new_user 052'deki OAuth niyet
--     kuralını korur ve kayıttaki ad-soyad, sınıf, alan ve sınav bilgisini profile yazar.
--     Yeni öğrenci hemen aktif (053 ile aynı). Onaylı koçların profil rolü bir kez 'coach' yapılır.
--  3. apply_verified_payment (054'ün yerine, kurallarını içerir):
--       * aynı ödeme tekrar gelirse (succeeded / refunded) hiçbir şey yazılmaz;
--       * daha eski bir ödeme oturumu, daha yeni aktif farklı paketi düşüremez (late_payment);
--       * süresi bitmemiş ücretli üyelikte yeni 30 gün mevcut bitişin üstüne eklenir; paket
--         değişiminde (Pro → Premium) de kalan gün korunur;
--       * her ödeme kapsadığı aralığı (covers_start / covers_end) kaydeder (iade için).
--  4. apply_payment_refund (yeni, yalnız sunucu): tam iadede o ödemenin kapsadığı süre düşülür,
--     kalan süre yoksa erişim kapanır. Kısmi iade erişimi değiştirmez. Tekrar bildirim etkisiz.
--  5. start_top_plan_trial: e-postası doğrulanmamış hesap deneme başlatamaz.
--  6. Yönetici ödeme listeleri: search_path sabit, yalnız is_admin(); iade/kapsam alanları eklenir.
--
-- Önkoşul: 041–049 (042 caller_account_active, billing_* tabloları), 050–054.
-- Önce `npm run test:pg:commercial` ile throwaway PostgreSQL'de prova edilir.

-- 1) profiles ------------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles_own_upsert" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_own_select'
  ) then
    execute 'create policy "profiles_own_select" on public.profiles for select using (auth.uid() = id)';
  end if;
end
$$;

revoke insert, update, delete, truncate on table public.profiles from public, anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.column_name)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name in ('name', 'target_department', 'target_rank', 'updated_at');
  if cols is not null then
    execute format('grant update (%s) on table public.profiles to authenticated', cols);
  end if;
end
$$;

-- 2) Rol ve kayıt --------------------------------------------------------------------------

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
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- auth.uid() null: Auth tetikleyicisi / service_role. İstemci asla admin/koç açamaz (053).
    if auth.uid() is not null and not public.is_admin() then
      new.role := 'student';
    else
      new.role := coalesce(nullif(new.role, ''), 'student');
      if new.role not in ('student', 'coach') then
        new.role := 'student';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_admin() then
      new.role := old.role;
      new.account_status := old.account_status;
      new.email := old.email;
    elsif new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    elsif old.role = 'admin' and new.role is distinct from 'admin' then
      new.role := 'admin';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_role() from public, anon, authenticated;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute procedure public.protect_role();

alter table public.profiles
  add column if not exists signup_intent text,
  add column if not exists signup_grade text,
  add column if not exists signup_track text,
  add column if not exists signup_exam text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text;
  intent text;
  blocked boolean := false;
begin
  full_name := trim(concat_ws(' ', nullif(trim(meta->>'first_name'), ''), nullif(trim(meta->>'last_name'), '')));
  if full_name = '' then
    full_name := trim(coalesce(meta->>'name', meta->>'full_name', ''));
  end if;
  full_name := left(regexp_replace(full_name, '\s+', ' ', 'g'), 80);
  -- 011'deki ad filtresi canlıda olmayabilir; varsa kullanılır, yoksa kayıt yine çalışır.
  if full_name <> '' and pg_catalog.to_regprocedure('public.person_name_blocked(text)') is not null then
    execute 'select public.person_name_blocked($1)' into blocked using full_name;
    if coalesce(blocked, false) then
      full_name := '';
    end if;
  end if;
  intent := lower(coalesce(nullif(trim(meta->>'intent'), ''), 'student'));
  if intent not in ('student', 'coach') then
    intent := 'student';
  end if;

  insert into public.profiles (
    id, email, name, role, account_status,
    signup_intent, signup_grade, signup_track, signup_exam
  ) values (
    new.id,
    new.email,
    full_name,
    'student',
    'active',
    intent,
    left(coalesce(meta->>'grade', ''), 40),
    left(coalesce(meta->>'track', ''), 40),
    left(coalesce(meta->>'exam', ''), 40)
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case when public.profiles.role = 'admin' then 'admin' else public.profiles.role end,
        name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
        -- 052: niyet yalnız hâlâ varsayılan öğrenci iken ve meta gelmişse güncellenir.
        signup_intent = case
          when public.profiles.role = 'admin' then public.profiles.signup_intent
          when coalesce(public.profiles.signup_intent, '') in ('', 'student')
            and excluded.signup_intent in ('student', 'coach')
            then excluded.signup_intent
          else public.profiles.signup_intent
        end,
        signup_grade = coalesce(nullif(public.profiles.signup_grade, ''), excluded.signup_grade),
        signup_track = coalesce(nullif(public.profiles.signup_track, ''), excluded.signup_track),
        signup_exam = coalesce(nullif(public.profiles.signup_exam, ''), excluded.signup_exam);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Onaylı koçların profil rolü (tek seferlik, tekrar çalıştırmak etkisiz).
update public.profiles p
   set role = 'coach'
  from public.coaches c
 where c.user_id = p.id
   and c.status = 'active'
   and p.role = 'student';

-- 3) Ödeme: yenileme ve paket değişimi ----------------------------------------------------

alter table public.billing_payments
  add column if not exists plan_id text,
  add column if not exists covers_start timestamptz,
  add column if not exists covers_end timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_total_try numeric(12,2);

alter table public.billing_subscriptions
  add column if not exists canceled_at timestamptz;

create or replace function public.apply_verified_payment(
  p_user_id uuid,
  p_plan_id text,
  p_provider text,
  p_payment_id text,
  p_amount_try numeric,
  p_checkout_id uuid default null,
  p_subscription_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := pg_catalog.clock_timestamp();
  prev_status text;
  prev_uid uuid;
  pay_amt numeric;
  pay_cur text;
  chk_amt numeric;
  chk_cur text;
  chk_uid uuid;
  chk_created timestamptz;
  cur_plan text;
  cur_status text;
  cur_start timestamptz;
  cur_end timestamptz;
  cur_provider text;
  cur_sub_id text;
  cur_created timestamptz;
  base timestamptz;
  starts timestamptz;
  ends timestamptz;
  extended boolean := false;
begin
  if p_user_id is null or p_payment_id is null or p_provider is null then
    raise exception 'eksik ödeme kimliği';
  end if;
  if p_plan_id not in ('pro', 'premium') then
    raise exception 'paket_yok';
  end if;
  if p_amount_try is null or p_amount_try <= 0 then
    raise exception 'tutar_gecersiz';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || p_user_id::text));

  if p_checkout_id is not null then
    select s.amount_try, s.currency, s.user_id, s.created_at
      into chk_amt, chk_cur, chk_uid, chk_created
    from public.billing_checkout_sessions s
    where s.id = p_checkout_id;
    if not found then
      raise exception 'oturum_yok';
    end if;
    if chk_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    if upper(coalesce(chk_cur, 'TRY')) is distinct from 'TRY' then
      raise exception 'para_birimi';
    end if;
    if abs(coalesce(chk_amt, 0) - p_amount_try) > 0.009 then
      raise exception 'tutar_uyusmuyor';
    end if;
  end if;

  -- 054: aynı ödeme daha önce işlendiyse (başarılı ya da iade edilmiş) hiçbir şey yazılmaz.
  select p.status, p.user_id, p.amount_try, p.currency
    into prev_status, prev_uid, pay_amt, pay_cur
  from public.billing_payments p
  where p.provider = p_provider and p.provider_payment_id = p_payment_id;
  if found then
    if abs(coalesce(pay_amt, 0) - p_amount_try) > 0.009 or upper(coalesce(pay_cur, '')) is distinct from 'TRY' then
      raise exception 'tutar_uyusmuyor';
    end if;
    if prev_status in ('succeeded', 'refunded') then
      select s.period_end into cur_end
      from public.billing_subscriptions s
      where s.user_id = p_user_id;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', true,
        'late_payment', false,
        'extended', false,
        'period_end', cur_end
      );
    end if;
    if prev_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
  end if;

  select s.plan_id, s.status, s.period_start, s.period_end, s.provider, s.provider_subscription_id
    into cur_plan, cur_status, cur_start, cur_end, cur_provider, cur_sub_id
  from public.billing_subscriptions s
  where s.user_id = p_user_id
  for update;

  -- 054: daha eski bir ödeme oturumu, daha yeni aktif farklı paketi düşüremez.
  -- Ödeme kaydedilir (para alındı), üyelik değişmez; webhook inceleme olayı yazar.
  if cur_plan is not null
     and cur_status = 'active'
     and cur_end is not null and cur_end > now_ts
     and cur_plan is distinct from p_plan_id
     and chk_created is not null
     and coalesce(cur_sub_id, '') <> '' then
    select cs.created_at into cur_created
      from public.billing_payments bp
      join public.billing_checkout_sessions cs on cs.id = bp.checkout_session_id
     where bp.user_id = p_user_id
       and bp.provider = cur_provider
       and bp.provider_payment_id = cur_sub_id;
    if cur_created is not null and chk_created < cur_created then
      insert into public.billing_payments (
        user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id, plan_id
      ) values (
        p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id, p_plan_id
      )
      on conflict (provider, provider_payment_id) do update
        set status = 'succeeded',
            plan_id = excluded.plan_id,
            checkout_session_id = coalesce(public.billing_payments.checkout_session_id, excluded.checkout_session_id);
      if p_checkout_id is not null then
        update public.billing_checkout_sessions
          set status = 'paid', updated_at = now_ts
          where id = p_checkout_id;
      end if;
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'duplicate_payment', false,
        'late_payment', true,
        'extended', false,
        'period_end', cur_end
      );
    end if;
  end if;

  -- Süresi bitmemiş ücretli üyelik varsa yeni 30 gün onun bitişinden başlar; paket değişse de
  -- kalan gün korunur.
  if cur_status = 'active' and cur_end is not null and cur_end > now_ts then
    base := cur_end;
    starts := coalesce(cur_start, now_ts);
    extended := true;
  else
    base := now_ts;
    starts := now_ts;
  end if;
  ends := base + interval '30 days';

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id,
    plan_id, covers_start, covers_end
  ) values (
    p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id,
    p_plan_id, base, ends
  )
  on conflict (provider, provider_payment_id) do update
    -- Yalnız eski pending / failed / canceled kayıt buraya gelir (yukarıda elendi).
    set status = 'succeeded',
        plan_id = excluded.plan_id,
        covers_start = excluded.covers_start,
        covers_end = excluded.covers_end,
        checkout_session_id = coalesce(public.billing_payments.checkout_session_id, excluded.checkout_session_id);

  insert into public.billing_subscriptions (
    user_id, plan_id, status, period_start, period_end, provider,
    provider_subscription_id, locked_amount_try, currency, updated_at
  ) values (
    p_user_id, p_plan_id, 'active', starts, ends, p_provider,
    coalesce(nullif(p_subscription_id, ''), p_payment_id), p_amount_try, 'TRY', now_ts
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    locked_amount_try = excluded.locked_amount_try,
    currency = 'TRY',
    canceled_at = null,
    updated_at = now_ts;

  if p_checkout_id is not null then
    update public.billing_checkout_sessions
      set status = 'paid', updated_at = now_ts
      where id = p_checkout_id;
  end if;

  update public.profiles
    set
      plan = p_plan_id,
      subscription_status = 'active',
      subscription_started_at = starts,
      subscription_ends_at = ends,
      billing_provider = p_provider,
      provider_subscription_id = coalesce(nullif(p_subscription_id, ''), p_payment_id),
      updated_at = pg_catalog.now()
    where id = p_user_id
      and role = 'student';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicate_payment', false,
    'late_payment', false,
    'extended', extended,
    'period_end', ends
  );
end;
$$;
revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated;

-- 4) İade ---------------------------------------------------------------------------------

create or replace function public.apply_payment_refund(
  p_provider text,
  p_payment_id text,
  p_refunded_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
  sub_end timestamptz;
  covered interval;
  new_end timestamptz;
  revoked boolean := false;
  now_ts timestamptz := pg_catalog.clock_timestamp();
begin
  if p_provider is null or p_payment_id is null then
    raise exception 'eksik ödeme kimliği';
  end if;

  select * into pay
  from public.billing_payments p
  where p.provider = p_provider and p.provider_payment_id = p_payment_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'odeme_yok');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || pay.user_id::text));
  select * into pay from public.billing_payments p where p.id = pay.id for update;

  if pay.status = 'refunded' then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'zaten_iade', 'duplicate', true);
  end if;
  if pay.status <> 'succeeded' then
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'odeme_basarili_degil');
  end if;

  if coalesce(p_refunded_total, 0) + 0.009 < pay.amount_try then
    update public.billing_payments
      set refunded_total_try = greatest(coalesce(refunded_total_try, 0), coalesce(p_refunded_total, 0))
      where id = pay.id;
    return pg_catalog.jsonb_build_object('ok', true, 'applied', false, 'reason', 'kismi_iade', 'refunded_total', p_refunded_total);
  end if;

  update public.billing_payments
    set status = 'refunded', refunded_at = now_ts, refunded_total_try = coalesce(p_refunded_total, pay.amount_try)
    where id = pay.id;

  covered := case
    when pay.covers_start is not null and pay.covers_end is not null then pay.covers_end - pay.covers_start
    else interval '30 days'
  end;

  select s.period_end into sub_end from public.billing_subscriptions s where s.user_id = pay.user_id for update;
  if sub_end is not null then
    new_end := sub_end - covered;
    if new_end <= now_ts then
      revoked := true;
      update public.billing_subscriptions
        set status = 'canceled', period_end = now_ts, canceled_at = now_ts, updated_at = now_ts
        where user_id = pay.user_id;
      update public.profiles
        set subscription_status = 'canceled', subscription_ends_at = now_ts, updated_at = pg_catalog.now()
        where id = pay.user_id and role = 'student';
    else
      update public.billing_subscriptions
        set period_end = new_end, updated_at = now_ts
        where user_id = pay.user_id;
      update public.profiles
        set subscription_ends_at = new_end, updated_at = pg_catalog.now()
        where id = pay.user_id and role = 'student' and subscription_status = 'active';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'applied', true,
    'revoked', revoked,
    'period_end', case when revoked then now_ts else new_end end
  );
end;
$$;
revoke all on function public.apply_payment_refund(text, text, numeric) from public, anon, authenticated;

-- 5) Deneme -------------------------------------------------------------------------------
-- Durum makinesi src/lib/trialStart.ts startTopPlanTrialStep ile aynı; ek olarak e-posta doğrulaması.

create or replace function public.start_top_plan_trial()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  started timestamptz;
  ends timestamptz;
  st text;
  sub_ends timestamptz;
  prow text;
  n int;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;

  select p.trial_started_at, p.trial_ends_at, p.subscription_status, p.subscription_ends_at, p.role
    into started, ends, st, sub_ends, prow
  from public.profiles p
  where p.id = uid
  for update;
  if not found then
    raise exception 'profil yok';
  end if;

  -- Yönetici test hesabı: yalnızca mevcut deneme kaydı okunur, yeni deneme yazılmaz.
  if prow = 'admin' then
    if started is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
        'trial_started_at', started,
        'trial_ends_at', ends,
        'message', case when ends is not null and ends > pg_catalog.now() then 'Deneme zaten açık.' else 'Bu hesap denemeyi kullandı.' end
      );
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'deneme yalnızca öğrenci hesabına özel');
  end if;
  if prow is distinct from 'student' then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'deneme yalnızca öğrenci hesabına özel');
  end if;

  if st = 'active' and (sub_ends is null or sub_ends > pg_catalog.now()) then
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'active', 'message', 'Ücretli üyelik açık; deneme gerekmez.');
  end if;

  if started is not null then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', case when ends is not null and ends > pg_catalog.now() then 'Deneme zaten açık.' else 'Bu hesap denemeyi kullandı.' end
    );
  end if;

  if not exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'blocked', 'message', 'Deneme için önce e-posta adresini doğrula.');
  end if;

  update public.profiles
  set
    trial_started_at = pg_catalog.now(),
    trial_ends_at = pg_catalog.now() + interval '14 days',
    subscription_status = 'trialing',
    updated_at = pg_catalog.now()
  where id = uid and trial_started_at is null;
  get diagnostics n = row_count;

  select p.trial_started_at, p.trial_ends_at into started, ends from public.profiles p where p.id = uid;
  if n = 0 then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'status', case when ends is not null and ends > pg_catalog.now() then 'trialing' else 'used' end,
      'trial_started_at', started,
      'trial_ends_at', ends,
      'message', 'Deneme zaten kayıtlı.'
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 'trialing',
    'trial_started_at', started,
    'trial_ends_at', ends,
    'plan', 'premium',
    'message', '14 günlük Premium deneme başladı. Ücret alınmadı.'
  );
end;
$$;
revoke all on function public.start_top_plan_trial() from public, anon;
grant execute on function public.start_top_plan_trial() to authenticated;

-- 6) Yönetici ödeme görünümü --------------------------------------------------------------

drop function if exists public.admin_list_payments();
create function public.admin_list_payments()
returns table (
  id uuid,
  user_id uuid,
  email text,
  amount_try numeric,
  currency text,
  status text,
  provider text,
  provider_payment_id text,
  plan_id text,
  covers_end timestamptz,
  refunded_at timestamptz,
  refunded_total_try numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id, p.user_id, pr.email, p.amount_try, p.currency, p.status, p.provider,
    p.provider_payment_id, p.plan_id, p.covers_end, p.refunded_at, p.refunded_total_try, p.created_at
  from public.billing_payments p
  left join public.profiles pr on pr.id = p.user_id
  order by p.created_at desc
  limit 200;
end;
$$;
revoke all on function public.admin_list_payments() from public, anon;
grant execute on function public.admin_list_payments() to authenticated;

drop function if exists public.admin_list_billing();
create function public.admin_list_billing()
returns table (
  id uuid,
  name text,
  email text,
  plan text,
  subscription_status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  account_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id, p.name, p.email, p.plan, p.subscription_status,
    p.trial_started_at, p.trial_ends_at, p.subscription_ends_at, p.account_status
  from public.profiles p
  where p.role = 'student'
  order by p.updated_at desc;
end;
$$;
revoke all on function public.admin_list_billing() from public, anon;
grant execute on function public.admin_list_billing() to authenticated;

create or replace function public.admin_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_n int;
  trial_n int;
  fail_n int;
  cancel_n int;
  refund_n int;
  verified numeric;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select count(*) into active_n from public.profiles
    where role = 'student' and subscription_status = 'active'
      and (subscription_ends_at is null or subscription_ends_at > pg_catalog.now());
  select count(*) into trial_n from public.profiles
    where role = 'student' and subscription_status = 'trialing'
      and trial_ends_at is not null and trial_ends_at > pg_catalog.now();
  select count(*) into fail_n from public.billing_payments where status = 'failed';
  select count(*) into cancel_n from public.profiles
    where role = 'student' and subscription_status = 'canceled';
  select count(*) into refund_n from public.billing_payments where status = 'refunded';
  select coalesce(sum(amount_try), 0) into verified
    from public.billing_payments where status = 'succeeded';
  return pg_catalog.jsonb_build_object(
    'active', active_n,
    'trialing', trial_n,
    'failed_payments', fail_n,
    'canceled', cancel_n,
    'refunded', refund_n,
    'verified_total_try', verified
  );
end;
$$;
revoke all on function public.admin_billing_overview() from public, anon;
grant execute on function public.admin_billing_overview() to authenticated;

-- Son kontrol: beklenen nesneler oluştu mu?
do $$
begin
  if to_regclass('public.moderation_violations') is null
     or to_regclass('public.moderation_stt_events') is null
     or pg_catalog.to_regprocedure('public.apply_payment_refund(text, text, numeric)') is null
     or not exists (select 1 from pg_proc where proname = 'claim_signup_prefs')
     or not exists (select 1 from pg_proc where proname = 'apply_verified_payment' and prosrc like '%late_payment%' and prosrc like '%covers_end%') then
    raise exception 'SON_KONTROL_BASARISIZ — geri alınıyor';
  end if;
end
$$;

commit;

select 'CANLI_050_055_OK' as sonuc;
