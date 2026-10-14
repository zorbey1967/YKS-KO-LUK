-- Yerel / staging taslak. Production’a bu turda uygulanmaz.
-- 030 platform_owner gerekir. E-posta yok. Sahip UUID bağımsız onaylanır.
-- Silme yok (randevu, görüşme, ödeme, profil). Idempotent. Toplu kapatma otomatik çalışmaz.

alter table public.coaches
  add column if not exists status_before_suspend text;

drop function if exists public.preview_disable_non_owner_accounts();
drop function if exists public.disable_non_owner_accounts();

create or replace function public.owner_confirm_reason(p_owner uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_n integer := 0;
begin
  if to_regclass('public.platform_owner') is null then
    return 'empty';
  end if;
  select count(*)::integer into owner_n from public.platform_owner;
  if owner_n = 0 then
    return 'empty';
  end if;
  if p_owner is null then
    return 'uuid';
  end if;
  if not exists (select 1 from public.platform_owner o where o.user_id = p_owner) then
    return 'uuid';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_owner and p.account_status = 'active'
  ) then
    return 'passive';
  end if;
  return 'ok';
end;
$$;

create or replace function public.owner_uuid_confirmed(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.owner_confirm_reason(p_owner) = 'ok';
$$;

create or replace function public.keep_ids_for_disable()
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with owners as (
    select o.user_id as id from public.platform_owner o
  ),
  owner_admin as (
    select 1
    from owners k
    join public.profiles p on p.id = k.id
    where p.role = 'admin' and p.account_status = 'active'
  ),
  last_admin as (
    select p.id
    from public.profiles p
    where p.role = 'admin'
      and p.account_status = 'active'
      and p.id not in (select id from owners)
      and not exists (select 1 from owner_admin)
    order by p.id
    limit 1
  )
  select id from owners
  union
  select id from last_admin;
$$;

create or replace function public.preview_disable_non_owner_accounts(p_confirm_owner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_n integer := 0;
  total_n integer := 0;
  appt_n integer := 0;
  meet_n integer := 0;
  coach_rows integer := 0;
  pay_n integer := 0;
  keep_n integer := 0;
  sus_n integer := 0;
  coach_n integer := 0;
  inv jsonb;
begin
  select count(*)::integer into total_n from public.profiles;
  if to_regclass('public.appointments') is not null then
    select count(*)::integer into appt_n from public.appointments;
  end if;
  if to_regclass('public.meeting_rooms') is not null then
    select count(*)::integer into meet_n from public.meeting_rooms;
  end if;
  if to_regclass('public.coaches') is not null then
    select count(*)::integer into coach_rows from public.coaches;
  end if;
  if to_regclass('public.billing_payments') is not null then
    select count(*)::integer into pay_n from public.billing_payments;
  end if;
  inv := jsonb_build_object(
    'total_profiles', total_n,
    'appointment_count', appt_n,
    'meeting_count', meet_n,
    'payment_count', pay_n,
    'coach_rows', coach_rows,
    'appointments_preserved', true,
    'meetings_preserved', true,
    'payments_preserved', true
  );

  if to_regclass('public.platform_owner') is null then
    return inv || jsonb_build_object(
      'ok', false,
      'skipped', true,
      'reason', 'platform_owner tablosu yok; toplu kapatma yok',
      'would_suspend_profiles', 0,
      'would_pasif_coaches', 0,
      'keep_profiles', 0
    );
  end if;
  select count(*)::integer into owner_n from public.platform_owner;

  if public.owner_confirm_reason(p_confirm_owner) is distinct from 'ok' then
    return inv || jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', case public.owner_confirm_reason(p_confirm_owner)
        when 'empty' then 'platform_owner boş; sahip UUID yazılmadan toplu kapatma yok'
        when 'passive' then 'aktif sahip profili yok; toplu kapatma yok'
        else 'sahip UUID doğrulanamadı; toplu kapatma yok'
      end,
      'owners', owner_n,
      'would_suspend_profiles', 0,
      'would_pasif_coaches', 0,
      'keep_profiles', 0
    );
  end if;

  select count(*)::integer into keep_n from public.keep_ids_for_disable();
  select count(*)::integer into sus_n
  from public.profiles p
  where p.account_status is distinct from 'pasif'
    and p.id not in (select k.id from public.keep_ids_for_disable() k);
  select count(*)::integer into coach_n
  from public.coaches c
  where c.status = 'active'
    and c.user_id not in (select k.id from public.keep_ids_for_disable() k);

  return inv || jsonb_build_object(
    'ok', true,
    'skipped', false,
    'reason', 'önizleme; satır yazılmadı',
    'owners', owner_n,
    'keep_profiles', keep_n,
    'would_suspend_profiles', sus_n,
    'would_pasif_coaches', coach_n
  );
end;
$$;

create or replace function public.disable_counts_match(preview jsonb, p_expect jsonb)
returns boolean
language sql
immutable
as $$
  select p_expect is not null
    and (preview->>'total_profiles') is not distinct from (p_expect->>'total_profiles')
    and (preview->>'would_suspend_profiles') is not distinct from (p_expect->>'would_suspend_profiles')
    and (preview->>'would_pasif_coaches') is not distinct from (p_expect->>'would_pasif_coaches')
    and (preview->>'coach_rows') is not distinct from (p_expect->>'coach_rows')
    and (preview->>'appointment_count') is not distinct from (p_expect->>'appointment_count')
    and (preview->>'meeting_count') is not distinct from (p_expect->>'meeting_count')
    and (preview->>'payment_count') is not distinct from (p_expect->>'payment_count');
$$;

drop function if exists public.disable_non_owner_accounts(uuid);

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
begin
  perform pg_advisory_xact_lock(932032);

  preview := public.preview_disable_non_owner_accounts(p_confirm_owner);
  if coalesce((preview->>'skipped')::boolean, true) then
    return preview || jsonb_build_object('updated_profiles', 0, 'updated_coaches', 0);
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
      'updated_coaches', 0
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

  return preview || jsonb_build_object(
    'updated_profiles', n_prof,
    'updated_coaches', n_coach,
    'appointments_preserved', true,
    'meetings_preserved', true,
    'payments_preserved', true
  );
end;
$$;

revoke all on function public.owner_confirm_reason(uuid) from public, anon, authenticated;
revoke all on function public.owner_uuid_confirmed(uuid) from public, anon, authenticated;
revoke all on function public.keep_ids_for_disable() from public, anon, authenticated;
revoke all on function public.preview_disable_non_owner_accounts(uuid) from public, anon, authenticated;
revoke all on function public.disable_counts_match(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.disable_non_owner_accounts(uuid, jsonb) from public, anon, authenticated;

-- SQL Editor (postgres), e-posta yok. disable beklenen önizleme sayıları olmadan yazmaz:
--   select public.preview_disable_non_owner_accounts('<sahip-uuid>'::uuid);
--   select public.disable_non_owner_accounts('<sahip-uuid>'::uuid, '<önizleme-json>'::jsonb);

create or replace view public.coach_directory
with (security_invoker = true) as
  select c.id, c.name, c.photo, c.track, c.focus, c.experience, c.bio, c.student_count, c.created_at
  from public.coaches c
  join public.profiles p on p.id = c.user_id
  where c.status = 'active'
    and p.account_status = 'active';

revoke all on table public.coach_directory from public;
grant select on table public.coach_directory to anon, authenticated;
