-- Koç ödevi: öğrenci hesabına düşer. 001–013’e dokunulmaz.
-- PRODUCTION otomatik uygulanmaz.
-- Frontend zaten coach_homeworks okumaya çalışıyordu; tablo yoktu.

create table if not exists public.coach_homeworks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_homeworks_coach_idx on public.coach_homeworks (coach_id, created_at desc);
create index if not exists coach_homeworks_student_idx on public.coach_homeworks (student_id, done, due);

alter table public.coach_homeworks enable row level security;
revoke all on public.coach_homeworks from anon, public;
grant select, insert, update on public.coach_homeworks to authenticated;

create or replace function public.coach_linked_to_student(p_coach uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.appointments a
    where a.coach_id = p_coach and a.student_id = p_student
  ) or exists (
    select 1 from public.coach_matches m
    where m.coach_id = p_coach and m.student_id = p_student and m.status = 'active'
  );
$$;

revoke all on function public.coach_linked_to_student(uuid, uuid) from public, anon;

drop policy if exists "coach_hw_select" on public.coach_homeworks;
create policy "coach_hw_select" on public.coach_homeworks
  for select using (
    student_id = auth.uid()
    or coach_id = public.own_coach_id()
  );

drop policy if exists "coach_hw_insert" on public.coach_homeworks;
create policy "coach_hw_insert" on public.coach_homeworks
  for insert with check (
    coach_id = public.own_coach_id()
    and public.is_active_coach(coach_id)
    and public.coach_linked_to_student(coach_id, student_id)
  );

drop policy if exists "coach_hw_update" on public.coach_homeworks;
create policy "coach_hw_update" on public.coach_homeworks
  for update using (
    student_id = auth.uid() or coach_id = public.own_coach_id()
  ) with check (
    student_id = auth.uid() or coach_id = public.own_coach_id()
  );

create or replace function public.coach_linked_students()
returns table (
  student_id uuid,
  name text,
  grade text,
  dept text,
  exam_date text,
  week_hours numeric,
  open_tasks int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  cid := public.own_coach_id();
  if cid is null or not public.is_active_coach(cid) then
    raise exception 'yetkisiz';
  end if;
  return query
  with ids as (
    select distinct a.student_id as sid from public.appointments a where a.coach_id = cid
    union
    select distinct m.student_id from public.coach_matches m
    where m.coach_id = cid and m.student_id is not null and m.status = 'active'
  )
  select
    i.sid,
    public.profile_display_name(i.sid),
    coalesce(nullif(sd.data->>'grade', ''), ''),
    coalesce(nullif(p.target_department, ''), nullif(sd.data->>'dept', ''), ''),
    coalesce(nullif(sd.data->>'examDate', ''), ''),
    coalesce(nullif(sd.data->>'weekHours', '')::numeric, 0),
    coalesce((
      select count(*)::int from jsonb_array_elements(coalesce(sd.data->'tasks', '[]'::jsonb)) t
      where (t->>'done') is distinct from 'true'
    ), 0)
  from ids i
  left join public.profiles p on p.id = i.sid
  left join public.student_data sd on sd.user_id = i.sid;
end;
$$;

create or replace function public.assign_coach_homework(p_student_id uuid, p_title text, p_due date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  cid := public.own_coach_id();
  if cid is null or not public.is_active_coach(cid) then
    raise exception 'yetkisiz';
  end if;
  if p_student_id is null or length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'öğrenci ve ödev gerekli';
  end if;
  if not public.coach_linked_to_student(cid, p_student_id) then
    raise exception 'bu öğrenci randevu veya eşleşme ile bağlı değil';
  end if;
  insert into public.coach_homeworks (coach_id, student_id, title, due)
  values (cid, p_student_id, trim(p_title), p_due)
  returning id into hid;
  return hid;
end;
$$;

create or replace function public.set_coach_homework_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  update public.coach_homeworks
    set done = p_done, updated_at = now()
    where id = p_id
      and (student_id = auth.uid() or coach_id = public.own_coach_id());
  if not found then
    raise exception 'ödev yok';
  end if;
end;
$$;

revoke all on function public.coach_linked_students() from public, anon;
revoke all on function public.assign_coach_homework(uuid, text, date) from public, anon;
revoke all on function public.set_coach_homework_done(uuid, boolean) from public, anon;
grant execute on function public.coach_linked_students() to authenticated;
grant execute on function public.assign_coach_homework(uuid, text, date) to authenticated;
grant execute on function public.set_coach_homework_done(uuid, boolean) to authenticated;
