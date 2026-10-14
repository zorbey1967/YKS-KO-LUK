-- Yerel taslak. Production’a bu turda uygulanmaz.
-- respond_appointment değişmez (yalnız bekliyor).
-- Onaylı satır: öğrenci/koç iptal TALEBİ; koç veya yönetici karar verir. Silme yok.

alter table public.appointments
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by uuid;

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

create or replace function public.request_cancel_approved_appointment(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt public.appointments%rowtype;
  is_party boolean := false;
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
    )
    or public.is_admin();
  if not is_party then
    raise exception 'yetkisiz';
  end if;
  update public.appointments
    set cancel_requested_at = now(),
        cancel_requested_by = auth.uid(),
        cancel_reason = 'approved_cancel_request'
    where id = appt.id and status = 'onay';
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', true);
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
  if appt.cancel_requested_at is null then
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
  if p_accept then
    update public.appointments
      set status = 'iptal',
          cancel_reason = 'approved_cancel_accepted'
      where id = appt.id and status = 'onay';
    return jsonb_build_object('ok', true, 'status', 'iptal', 'deleted', false);
  end if;
  update public.appointments
    set cancel_requested_at = null,
        cancel_requested_by = null,
        cancel_reason = null
    where id = appt.id and status = 'onay';
  return jsonb_build_object('ok', true, 'status', 'onay', 'cancel_requested', false);
end;
$$;

revoke all on function public.request_cancel_approved_appointment(text) from public, anon;
grant execute on function public.request_cancel_approved_appointment(text) to authenticated;
revoke all on function public.decide_approved_appointment_cancel(text, boolean) from public, anon;
grant execute on function public.decide_approved_appointment_cancel(text, boolean) to authenticated;
