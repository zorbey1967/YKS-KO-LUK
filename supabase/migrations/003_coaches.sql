-- Aşama 3: Koç profilleri, başvuru, eşleşme, randevu temeli.
-- Ödeme ve görüntülü görüşme yok. 002 is_admin() gerekir; 001/002 değiştirilmez.
-- Otomatik uygulanmaz; onay sonrası SQL Editor.

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  photo text not null default '',
  track text not null default 'YKS Sayısal',
  focus text not null default '',
  experience text not null default '',
  bio text not null default '',
  student_count integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaches_status_check check (status in ('pending', 'active', 'rejected', 'pasif')),
  constraint coaches_student_count_check check (student_count >= 0 and student_count <= 500)
);

create table if not exists public.coach_matches (
  id text primary key default gen_random_uuid()::text,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_id uuid references auth.users(id) on delete set null,
  student_name text not null,
  grade text not null default '',
  note text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint coach_matches_status_check check (status in ('active', 'ended'))
);

create table if not exists public.appointments (
  id text primary key default gen_random_uuid()::text,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  date date not null,
  time text not null,
  minutes integer not null default 40,
  status text not null default 'bekliyor',
  created_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('bekliyor', 'onay', 'iptal', 'tamamlandi')),
  constraint appointments_minutes_check check (minutes > 0 and minutes <= 240)
);

create index if not exists coaches_status_idx on public.coaches (status);
create index if not exists coaches_user_id_idx on public.coaches (user_id);
create index if not exists coach_matches_coach_idx on public.coach_matches (coach_id);
create index if not exists coach_matches_student_idx on public.coach_matches (student_id);
create index if not exists appointments_coach_idx on public.appointments (coach_id, date);
create index if not exists appointments_student_idx on public.appointments (student_id);

create or replace function public.own_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.coaches c where c.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_active_coach(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coaches c
    where c.id = p_id and c.status = 'active'
  );
$$;

create or replace function public.force_coach_pending()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.user_id := auth.uid();
    elsif tg_op = 'UPDATE' then
      new.status := old.status;
      new.user_id := old.user_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists coaches_force_pending on public.coaches;
create trigger coaches_force_pending
  before insert or update on public.coaches
  for each row execute procedure public.force_coach_pending();

create or replace function public.profile_display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.name), ''), 'Öğrenci')
  from public.profiles p
  where p.id = p_id;
$$;

create or replace function public.protect_student_id()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.student_id is not null and new.student_id is distinct from auth.uid() then
        raise exception 'student_id yalnızca kendi hesabın olabilir';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.student_id is distinct from old.student_id
        and new.student_id is not null
        and new.student_id is distinct from auth.uid() then
        raise exception 'student_id yalnızca kendi hesabın olabilir';
      end if;
    end if;
  end if;
  if new.student_id is not null then
    new.student_name := public.profile_display_name(new.student_id);
    if new.student_name is null then
      raise exception 'öğrenci profili yok';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists matches_protect_student_id on public.coach_matches;
create trigger matches_protect_student_id
  before insert or update on public.coach_matches
  for each row execute procedure public.protect_student_id();

create or replace function public.appointment_bind_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      if new.student_id is null then
        raise exception 'student_id zorunlu';
      end if;
      if new.student_id is distinct from auth.uid() then
        raise exception 'student_id yalnızca kendi hesabın olabilir';
      end if;
      new.student_id := auth.uid();
    elsif new.student_id is null then
      raise exception 'student_id zorunlu';
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.student_id := old.student_id;
    elsif new.student_id is null then
      raise exception 'student_id zorunlu';
    end if;
  end if;
  new.student_name := public.profile_display_name(new.student_id);
  if new.student_name is null then
    raise exception 'öğrenci profili yok';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_protect_student_id on public.appointments;
drop trigger if exists appointments_bind_student on public.appointments;
create trigger appointments_bind_student
  before insert or update on public.appointments
  for each row execute procedure public.appointment_bind_student();

create or replace function public.force_appointment_insert()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and not public.is_admin() and new.coach_id is distinct from public.own_coach_id() then
    new.status := 'bekliyor';
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() and old.coach_id is distinct from public.own_coach_id() then
    new.status := old.status;
    new.coach_id := old.coach_id;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_force_status on public.appointments;
create trigger appointments_force_status
  before insert or update on public.appointments
  for each row execute procedure public.force_appointment_insert();

alter table public.coaches enable row level security;
alter table public.coach_matches enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "coaches_select" on public.coaches;
drop policy if exists "coaches_select_own_admin" on public.coaches;
create policy "coaches_select_own_admin" on public.coaches
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "coaches_insert_own" on public.coaches;
create policy "coaches_insert_own" on public.coaches
  for insert with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "coaches_update" on public.coaches;
create policy "coaches_update" on public.coaches
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "coaches_delete_admin" on public.coaches;
create policy "coaches_delete_admin" on public.coaches
  for delete using (public.is_admin());

create or replace view public.coach_directory as
  select id, name, photo, track, focus, experience, bio, student_count, created_at
  from public.coaches
  where status = 'active';

drop policy if exists "matches_select" on public.coach_matches;
create policy "matches_select" on public.coach_matches
  for select using (
    public.is_admin()
    or coach_id = public.own_coach_id()
    or student_id = auth.uid()
  );

drop policy if exists "matches_write" on public.coach_matches;
drop policy if exists "matches_insert" on public.coach_matches;
drop policy if exists "matches_update" on public.coach_matches;
drop policy if exists "matches_delete" on public.coach_matches;
create policy "matches_insert" on public.coach_matches
  for insert with check (
    (public.is_admin() or coach_id = public.own_coach_id())
    and (public.is_admin() or student_id is null or student_id = auth.uid())
  );
create policy "matches_update" on public.coach_matches
  for update using (public.is_admin() or coach_id = public.own_coach_id())
  with check (public.is_admin() or coach_id = public.own_coach_id());
create policy "matches_delete" on public.coach_matches
  for delete using (public.is_admin() or coach_id = public.own_coach_id());

drop policy if exists "appt_select" on public.appointments;
create policy "appt_select" on public.appointments
  for select using (
    public.is_admin()
    or coach_id = public.own_coach_id()
    or student_id = auth.uid()
  );

drop policy if exists "appt_insert" on public.appointments;
create policy "appt_insert" on public.appointments
  for insert with check (
    auth.uid() is not null
    and student_id is not null
    and (public.is_admin() or student_id = auth.uid())
    and (
      public.is_admin()
      or coach_id = public.own_coach_id()
      or public.is_active_coach(coach_id)
    )
  );

drop policy if exists "appt_update" on public.appointments;
create policy "appt_update" on public.appointments
  for update using (public.is_admin() or coach_id = public.own_coach_id())
  with check (public.is_admin() or coach_id = public.own_coach_id());

drop policy if exists "appt_delete" on public.appointments;
create policy "appt_delete" on public.appointments
  for delete using (public.is_admin() or coach_id = public.own_coach_id());

create or replace function public.admin_set_coach_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('pending', 'active', 'rejected', 'pasif') then
    raise exception 'geçersiz durum';
  end if;
  update public.coaches set status = p_status, updated_at = now() where id = p_id;
end;
$$;

revoke all on function public.own_coach_id() from public, anon, authenticated;
revoke all on function public.is_active_coach(uuid) from public, anon, authenticated;
revoke all on function public.profile_display_name(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_coach_status(uuid, text) from public, anon, authenticated;
grant execute on function public.own_coach_id() to authenticated;
grant execute on function public.is_active_coach(uuid) to authenticated;
grant execute on function public.admin_set_coach_status(uuid, text) to authenticated;

revoke all on table public.coaches from public, anon, authenticated;
revoke all on table public.coach_matches from public, anon, authenticated;
revoke all on table public.appointments from public, anon, authenticated;
revoke all on table public.coach_directory from public, anon, authenticated;

grant select, insert, update on table public.coaches to authenticated;
grant delete on table public.coaches to authenticated;
grant select, insert, update, delete on table public.coach_matches to authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;
grant select on table public.coach_directory to anon, authenticated;
