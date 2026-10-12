-- Abonelik / deneme. 001–012’ye dokunulmaz.
-- PRODUCTION'A otomatik uygulanmaz.
-- TEK BAŞINA CANLI 010 ŞEMASINA UYGULANMAZ: bu dosyadaki student_entitled authenticated
-- EXECUTE verir (oracle). Canlı 010 yolu: 020. Tam fatura sırası: 013 → 016 → 017 → 018 → 019.
-- 020 ile kolonlar IF NOT EXISTS çakışır; 013+020 birlikte replay edilmemeli.
-- Mevcut öğrenciler: subscription_status null → 013’te legacy (kilit yok); 018/019/020 fail-closed.

alter table public.profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text,
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists billing_provider text not null default '',
  add column if not exists provider_customer_id text not null default '',
  add column if not exists provider_subscription_id text not null default '';

alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (
    subscription_status is null
    or subscription_status in (
      'none', 'pending_approval', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'blocked'
    )
  );

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, public, authenticated;

create or replace function public.protect_plan()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    new.plan := coalesce(old.plan, new.plan, 'Ücretsiz');
    new.trial_started_at := old.trial_started_at;
    new.trial_ends_at := old.trial_ends_at;
    new.subscription_status := old.subscription_status;
    new.subscription_started_at := old.subscription_started_at;
    new.subscription_ends_at := old.subscription_ends_at;
    new.billing_provider := coalesce(old.billing_provider, '');
    new.provider_customer_id := coalesce(old.provider_customer_id, '');
    new.provider_subscription_id := coalesce(old.provider_subscription_id, '');
  end if;
  return new;
end;
$$;

create or replace function public.student_entitled(p_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.profiles%rowtype;
begin
  if p_id is null then
    return false;
  end if;
  select * into r from public.profiles where id = p_id;
  if not found then
    return false;
  end if;
  if r.role in ('admin', 'coach') then
    return true;
  end if;
  if r.account_status is distinct from 'active' then
    return false;
  end if;
  if r.subscription_status is null then
    return true;
  end if;
  if r.subscription_status = 'trialing' then
    return r.trial_ends_at is not null and r.trial_ends_at > now();
  end if;
  if r.subscription_status = 'active' then
    return r.subscription_ends_at is null or r.subscription_ends_at > now();
  end if;
  return false;
end;
$$;

revoke all on function public.student_entitled(uuid) from public, anon;
grant execute on function public.student_entitled(uuid) to authenticated;

create or replace function public.admin_review_student(p_id uuid, p_status text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_id is null or p_id = auth.uid() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('active', 'rejected', 'pending') then
    raise exception 'geçersiz durum';
  end if;
  update public.profiles
    set
      account_status = p_status,
      approval_note = case when p_status = 'rejected' then coalesce(p_note, '') else '' end,
      trial_started_at = case
        when p_status = 'active' and trial_started_at is null then now()
        else trial_started_at
      end,
      trial_ends_at = case
        when p_status = 'active' and trial_ends_at is null then now() + interval '14 days'
        else trial_ends_at
      end,
      subscription_status = case
        when p_status = 'active' and coalesce(subscription_status, '') in ('', 'none', 'pending_approval') then 'trialing'
        when p_status = 'rejected' then 'blocked'
        else subscription_status
      end,
      updated_at = now()
    where id = p_id
      and role = 'student';
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
  st text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  select p.account_status into st from public.profiles p where p.id = auth.uid();
  if st is distinct from 'active' then
    raise exception 'hesap onay bekliyor';
  end if;
  if not public.student_entitled(auth.uid()) then
    raise exception 'üyelik gerekli';
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

create or replace function public.admin_list_billing()
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
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id,
    p.name,
    p.email,
    p.plan,
    p.subscription_status,
    p.trial_started_at,
    p.trial_ends_at,
    p.subscription_ends_at,
    p.account_status
  from public.profiles p
  where p.role = 'student'
  order by p.updated_at desc;
end;
$$;

revoke all on function public.admin_list_billing() from public, anon;
revoke all on function public.student_entitled(uuid) from public, anon;
grant execute on function public.admin_list_billing() to authenticated;
grant execute on function public.student_entitled(uuid) to authenticated;
grant execute on function public.admin_review_student(uuid, text, text) to authenticated;
grant execute on function public.request_appointment(uuid) to authenticated;
