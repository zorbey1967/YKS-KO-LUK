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
