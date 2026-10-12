-- 42702: log_meeting_token_ok plpgsql "role" vs meeting_audit.role.
-- 001–009 değişmez. Davranış aynı; yalnız değişken adı actor_role.

create or replace function public.log_meeting_token_ok(p_appointment_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
begin
  if auth.uid() is null or not public.can_join_meeting(p_appointment_id) then
    return;
  end if;
  if exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.student_id = auth.uid()
  ) then
    actor_role := 'student';
  else
    actor_role := 'coach';
  end if;
  insert into public.meeting_audit (appointment_id, actor_id, role, event)
  values (p_appointment_id, auth.uid(), actor_role, 'token_ok')
  on conflict (appointment_id, role, event) do nothing;
end;
$$;

revoke all on function public.log_meeting_token_ok(text) from public, anon;
grant execute on function public.log_meeting_token_ok(text) to authenticated;
