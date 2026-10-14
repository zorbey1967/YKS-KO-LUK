-- Yerel / staging taslak. Production’a bu turda uygulanmaz.
-- Askıya alma silme değildir. 027/028 dosyaları değişmez.
-- Auth ban Edge Function (admin-account-status) ile; JWT anında düşmez, RLS burada keser.

create table if not exists public.admin_account_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_id uuid not null,
  action text not null check (action in ('suspend', 'reactivate')),
  created_at timestamptz not null default now()
);

create index if not exists admin_account_events_target_idx
  on public.admin_account_events (target_id, created_at desc);

alter table public.admin_account_events enable row level security;
alter table public.admin_account_events force row level security;

drop policy if exists "admin_account_events_select" on public.admin_account_events;
create policy "admin_account_events_select" on public.admin_account_events
  for select using (public.is_admin());

revoke all on table public.admin_account_events from public, anon, authenticated;
grant select on table public.admin_account_events to authenticated;

alter table public.coaches
  add column if not exists status_before_suspend text;

alter table public.coaches drop constraint if exists coaches_status_before_suspend_check;
alter table public.coaches add constraint coaches_status_before_suspend_check
  check (
    status_before_suspend is null
    or status_before_suspend in ('pending', 'active', 'rejected', 'pasif')
  );

create or replace function public.caller_account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

revoke all on function public.caller_account_active() from public, anon;
grant execute on function public.caller_account_active() to authenticated;

drop policy if exists "student_data_own_select" on public.student_data;
create policy "student_data_own_select" on public.student_data
  for select using (auth.uid() = user_id and public.caller_account_active());

drop policy if exists "student_data_own_write" on public.student_data;
create policy "student_data_own_write" on public.student_data
  for all using (auth.uid() = user_id and public.caller_account_active())
  with check (auth.uid() = user_id and public.caller_account_active());

drop policy if exists "appt_select" on public.appointments;
create policy "appt_select" on public.appointments
  for select using (
    public.caller_account_active()
    and (
      public.is_admin()
      or student_id = auth.uid()
      or coach_id = public.own_coach_id()
    )
  );

drop policy if exists "appt_insert" on public.appointments;
create policy "appt_insert" on public.appointments
  for insert with check (
    auth.uid() is not null
    and student_id is not null
    and public.caller_account_active()
    and (public.is_admin() or student_id = auth.uid())
    and (
      public.is_admin()
      or coach_id = public.own_coach_id()
      or public.is_active_coach(coach_id)
    )
  );

drop policy if exists "appt_update" on public.appointments;
create policy "appt_update" on public.appointments
  for update using (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  )
  with check (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  );

drop policy if exists "appt_delete" on public.appointments;
create policy "appt_delete" on public.appointments
  for delete using (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  );

create or replace function public.admin_set_account_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_role text;
  target_status text;
  admin_n integer;
  owner_n integer := 0;
begin
  if actor is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('active', 'pasif') then
    raise exception 'geçersiz durum';
  end if;
  if p_id is null then
    raise exception 'kimlik gerekli';
  end if;

  select p.role, p.account_status into target_role, target_status
  from public.profiles p
  where p.id = p_id
  for update;

  if not found then
    raise exception 'hesap yok';
  end if;

  if to_regclass('public.platform_owner') is not null then
    execute
      'select count(*)::integer from public.platform_owner o where o.user_id = $1'
      into owner_n
      using p_id;
    if owner_n > 0 then
      raise exception 'platform sahibi askıya alınamaz';
    end if;
  end if;

  if p_status = 'pasif' then
    if p_id = actor then
      raise exception 'kendi hesabını askıya alamazsın';
    end if;
    select count(*)::integer into admin_n
    from public.profiles p
    where p.role = 'admin' and p.account_status = 'active';
    if target_role = 'admin' and admin_n <= 1 then
      raise exception 'son aktif yönetici askıya alınamaz';
    end if;
  end if;

  update public.profiles
  set account_status = p_status, updated_at = now()
  where id = p_id;

  if p_status = 'pasif' then
    update public.coaches
    set
      status_before_suspend = status,
      status = 'pasif',
      updated_at = now()
    where user_id = p_id
      and status = 'active'
      and status_before_suspend is null;
  else
    update public.coaches
    set
      status = coalesce(status_before_suspend, status),
      status_before_suspend = null,
      updated_at = now()
    where user_id = p_id
      and status_before_suspend is not null;
  end if;

  insert into public.admin_account_events (actor_id, target_id, action)
  values (actor, p_id, case when p_status = 'pasif' then 'suspend' else 'reactivate' end);
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text) from public, anon;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;

create or replace function public.require_caller_account_active()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
end;
$$;

revoke all on function public.require_caller_account_active() from public, anon, authenticated;

grant select on table public.coach_matches to authenticated;

drop policy if exists "matches_select" on public.coach_matches;
create policy "matches_select" on public.coach_matches
  for select using (
    public.caller_account_active()
    and (
      public.is_admin()
      or coach_id = public.own_coach_id()
      or student_id = auth.uid()
    )
  );

drop policy if exists "matches_insert" on public.coach_matches;
create policy "matches_insert" on public.coach_matches
  for insert with check (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
    and (public.is_admin() or student_id is null or student_id = auth.uid())
  );

drop policy if exists "matches_update" on public.coach_matches;
create policy "matches_update" on public.coach_matches
  for update using (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  )
  with check (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  );

drop policy if exists "matches_delete" on public.coach_matches;
create policy "matches_delete" on public.coach_matches
  for delete using (
    public.caller_account_active()
    and (public.is_admin() or coach_id = public.own_coach_id())
  );

-- 008/020 SECURITY DEFINER RPC RLS’i aşar. Gövdeyi kopyalamadan sarmala.
do $wrap$
begin
  if to_regprocedure('public.request_appointment_unguarded(uuid)') is null
     and to_regprocedure('public.request_appointment(uuid)') is not null then
    alter function public.request_appointment(uuid) rename to request_appointment_unguarded;
  end if;
  if to_regprocedure('public.request_appointment_unguarded(uuid)') is not null then
    execute $fn$
      create or replace function public.request_appointment(p_availability_id uuid)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.request_appointment_unguarded(p_availability_id);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.request_appointment_unguarded(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.request_appointment(uuid) to authenticated';
  end if;

  if to_regprocedure('public.respond_appointment_unguarded(text, boolean)') is null
     and to_regprocedure('public.respond_appointment(text, boolean)') is not null then
    alter function public.respond_appointment(text, boolean) rename to respond_appointment_unguarded;
  end if;
  if to_regprocedure('public.respond_appointment_unguarded(text, boolean)') is not null then
    execute $fn$
      create or replace function public.respond_appointment(p_id text, p_accept boolean)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.respond_appointment_unguarded(p_id, p_accept);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.respond_appointment_unguarded(text, boolean) from public, anon, authenticated';
    execute 'grant execute on function public.respond_appointment(text, boolean) to authenticated';
  end if;

  if to_regprocedure('public.apply_my_lesson_outcomes_unguarded()') is null
     and to_regprocedure('public.apply_my_lesson_outcomes()') is not null then
    alter function public.apply_my_lesson_outcomes() rename to apply_my_lesson_outcomes_unguarded;
  end if;
  if to_regprocedure('public.apply_my_lesson_outcomes_unguarded()') is not null then
    execute $fn$
      create or replace function public.apply_my_lesson_outcomes()
      returns integer
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.apply_my_lesson_outcomes_unguarded();
      end;
      $$
    $fn$;
    execute 'revoke all on function public.apply_my_lesson_outcomes_unguarded() from public, anon, authenticated';
    execute 'grant execute on function public.apply_my_lesson_outcomes() to authenticated';
  end if;

  if to_regprocedure('public.expire_my_pending_appointments_unguarded()') is null
     and to_regprocedure('public.expire_my_pending_appointments()') is not null then
    alter function public.expire_my_pending_appointments() rename to expire_my_pending_appointments_unguarded;
  end if;
  if to_regprocedure('public.expire_my_pending_appointments_unguarded()') is not null then
    execute $fn$
      create or replace function public.expire_my_pending_appointments()
      returns integer
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.expire_my_pending_appointments_unguarded();
      end;
      $$
    $fn$;
    execute 'revoke all on function public.expire_my_pending_appointments_unguarded() from public, anon, authenticated';
    execute 'grant execute on function public.expire_my_pending_appointments() to authenticated';
  end if;

  if to_regprocedure('public.ensure_meeting_room_unguarded(text)') is null
     and to_regprocedure('public.ensure_meeting_room(text)') is not null then
    alter function public.ensure_meeting_room(text) rename to ensure_meeting_room_unguarded;
  end if;
  if to_regprocedure('public.ensure_meeting_room_unguarded(text)') is not null then
    execute $fn$
      create or replace function public.ensure_meeting_room(p_appointment_id text)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.ensure_meeting_room_unguarded(p_appointment_id);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.ensure_meeting_room_unguarded(text) from public, anon, authenticated';
    execute 'grant execute on function public.ensure_meeting_room(text) to authenticated';
  end if;

  if to_regprocedure('public.push_student_data_unguarded(bigint, jsonb)') is null
     and to_regprocedure('public.push_student_data(bigint, jsonb)') is not null then
    alter function public.push_student_data(bigint, jsonb) rename to push_student_data_unguarded;
  end if;
  if to_regprocedure('public.push_student_data_unguarded(bigint, jsonb)') is not null then
    execute $fn$
      create or replace function public.push_student_data(p_expected_rev bigint, p_data jsonb)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.push_student_data_unguarded(p_expected_rev, p_data);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.push_student_data_unguarded(bigint, jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.push_student_data(bigint, jsonb) to authenticated';
  end if;

  if to_regprocedure('public.coach_student_brief_unguarded(uuid)') is null
     and to_regprocedure('public.coach_student_brief(uuid)') is not null then
    alter function public.coach_student_brief(uuid) rename to coach_student_brief_unguarded;
  end if;
  if to_regprocedure('public.coach_student_brief_unguarded(uuid)') is not null then
    execute $fn$
      create or replace function public.coach_student_brief(p_student uuid)
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.coach_student_brief_unguarded(p_student);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.coach_student_brief_unguarded(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.coach_student_brief(uuid) to authenticated';
  end if;

  if to_regprocedure('public.assign_coach_homework_unguarded(uuid, text, date)') is null
     and to_regprocedure('public.assign_coach_homework(uuid, text, date)') is not null then
    alter function public.assign_coach_homework(uuid, text, date) rename to assign_coach_homework_unguarded;
  end if;
  if to_regprocedure('public.assign_coach_homework_unguarded(uuid, text, date)') is not null then
    execute $fn$
      create or replace function public.assign_coach_homework(p_student_id uuid, p_title text, p_due date)
      returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        perform public.require_caller_account_active();
        return public.assign_coach_homework_unguarded(p_student_id, p_title, p_due);
      end;
      $$
    $fn$;
    execute 'revoke all on function public.assign_coach_homework_unguarded(uuid, text, date) from public, anon, authenticated';
    execute 'grant execute on function public.assign_coach_homework(uuid, text, date) to authenticated';
  end if;

  if to_regclass('public.coach_homeworks') is not null then
    execute $pol$
      drop policy if exists "coach_hw_select" on public.coach_homeworks;
      create policy "coach_hw_select" on public.coach_homeworks
        for select using (
          public.caller_account_active()
          and (student_id = auth.uid() or coach_id = public.own_coach_id())
        );
    $pol$;
  end if;
end
$wrap$;
