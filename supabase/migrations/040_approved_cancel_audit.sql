-- Yerel taslak. Production’a bu turda uygulanmaz.
-- 039 fonksiyonlarını denetim + idempotent kilit ile değiştirir.
-- respond_appointment değişmez. Silme yok.

alter table public.appointments
  add column if not exists cancel_reason text,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by uuid,
  add column if not exists cancel_decision text;

alter table public.appointments drop constraint if exists appointments_cancel_reason_check;
alter table public.appointments add constraint appointments_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in (
      'student_no_show',
      'sibling_accepted',
      'coach_rejected',
      'expired',
      'approved_cancel_request',
      'approved_cancel_accepted'
    )
  );

alter table public.appointments drop constraint if exists appointments_cancel_decision_check;
alter table public.appointments add constraint appointments_cancel_decision_check
  check (
    cancel_decision is null
    or cancel_decision in ('pending', 'accepted', 'denied')
  );

create table if not exists public.appointment_cancel_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null,
  actor uuid not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint appointment_cancel_events_action_check check (
    action in ('request', 'duplicate', 'accept', 'deny')
  )
);

alter table public.appointment_cancel_events enable row level security;
alter table public.appointment_cancel_events force row level security;

drop policy if exists "cancel_events_select" on public.appointment_cancel_events;
create policy "cancel_events_select" on public.appointment_cancel_events
  for select using (
    public.is_admin()
    or actor = auth.uid()
    or appointment_id in (
      select a.id from public.appointments a
      where a.student_id = auth.uid()
         or a.coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
    )
  );

revoke all on table public.appointment_cancel_events from public, anon;
grant select on table public.appointment_cancel_events to authenticated;

drop policy if exists "cancel_events_insert_definer" on public.appointment_cancel_events;
create policy "cancel_events_insert_definer" on public.appointment_cancel_events
  for insert to postgres with check (true);

create or replace function public.request_cancel_approved_appointment(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt public.appointments%rowtype;
  is_party boolean := false;
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  select * into appt from public.appointments a where a.id = p_id for update;
  if not found then
    raise exception 'randevu yok';
  end if;
  if appt.status is distinct from 'onay' then
    raise exception 'yalnız onaylı randevu için iptal talebi';
  end if;
  is_party := appt.student_id = auth.uid()
    or exists (
      select 1 from public.coaches c
      where c.id = appt.coach_id and c.user_id = auth.uid()
    );
  if not is_party then
    raise exception 'yetkisiz';
  end if;
  if appt.cancel_requested_at is not null and coalesce(appt.cancel_decision, 'pending') = 'pending' then
    insert into public.appointment_cancel_events (appointment_id, actor, action)
    values (appt.id, auth.uid(), 'duplicate');
    return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', true);
  end if;
  update public.appointments
    set cancel_requested_at = now(),
        cancel_requested_by = auth.uid(),
        cancel_reason = 'approved_cancel_request',
        cancel_decision = 'pending'
    where id = appt.id
      and status = 'onay'
      and (
        cancel_requested_at is null
        or cancel_decision is distinct from 'pending'
      );
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.appointment_cancel_events (appointment_id, actor, action)
    values (appt.id, auth.uid(), 'duplicate');
    return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', true);
  end if;
  insert into public.appointment_cancel_events (appointment_id, actor, action)
  values (appt.id, auth.uid(), 'request');
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true, 'duplicate', false);
end;
$$;

create or replace function public.decide_approved_appointment_cancel(p_id text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt public.appointments%rowtype;
  allowed boolean := false;
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  select * into appt from public.appointments a where a.id = p_id for update;
  if not found then
    raise exception 'randevu yok';
  end if;
  if appt.status is distinct from 'onay' then
    raise exception 'yalnız onaylı randevu';
  end if;
  if appt.cancel_requested_at is null or coalesce(appt.cancel_decision, 'pending') is distinct from 'pending' then
    raise exception 'iptal talebi yok';
  end if;
  allowed := public.is_admin()
    or exists (
      select 1 from public.coaches c
      where c.id = appt.coach_id and c.user_id = auth.uid()
    );
  if not allowed then
    raise exception 'karar yalnız koç veya yönetici';
  end if;
  if appt.student_id = auth.uid() and not public.is_admin() then
    raise exception 'karar yalnız koç veya yönetici';
  end if;
  if p_accept then
    update public.appointments
      set status = 'iptal',
          cancel_reason = 'approved_cancel_accepted',
          cancel_decision = 'accepted'
      where id = appt.id and status = 'onay' and cancel_decision = 'pending';
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'iptal talebi yok';
    end if;
    insert into public.appointment_cancel_events (appointment_id, actor, action)
    values (appt.id, auth.uid(), 'accept');
    return jsonb_build_object('ok', true, 'status', 'iptal', 'deleted', false);
  end if;
  update public.appointments
    set cancel_decision = 'denied'
    where id = appt.id and status = 'onay' and cancel_decision = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'iptal talebi yok';
  end if;
  insert into public.appointment_cancel_events (appointment_id, actor, action)
  values (appt.id, auth.uid(), 'deny');
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', false, 'decision', 'denied');
end;
$$;

revoke all on function public.request_cancel_approved_appointment(text) from public, anon;
grant execute on function public.request_cancel_approved_appointment(text) to authenticated;
revoke all on function public.decide_approved_appointment_cancel(text, boolean) from public, anon;
grant execute on function public.decide_approved_appointment_cancel(text, boolean) to authenticated;
