-- Yerel / throwaway PostgreSQL. Production’a bu turda uygulanmaz.
-- student_data.rev ile kayıp güncelleme koruması; bağlı koça özet; ödev tekilleştirme.

alter table public.student_data add column if not exists rev bigint not null default 0;

create table if not exists public.coaches (
  id uuid primary key,
  user_id uuid,
  status text not null default 'active'
);

create table if not exists public.appointments (
  id text primary key,
  coach_id uuid,
  student_id uuid,
  status text
);

create table if not exists public.coach_matches (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid,
  student_id uuid,
  status text
);

create table if not exists public.coach_homeworks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  student_id uuid not null,
  title text not null,
  due date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.push_student_data(p_expected_rev bigint, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur_rev bigint;
  cur_data jsonb;
  new_rev bigint;
  body jsonb;
begin
  if uid is null then
    raise exception 'oturum gerekli';
  end if;
  body := public.canonicalize_student_json(coalesce(p_data, '{}'::jsonb));
  select sd.rev, sd.data into cur_rev, cur_data
    from public.student_data sd where sd.user_id = uid;
  if not found then
    insert into public.student_data (user_id, data, rev, updated_at)
    values (uid, body, 1, now());
    return jsonb_build_object('ok', true, 'rev', 1, 'data', body);
  end if;
  if coalesce(p_expected_rev, -1) is distinct from cur_rev then
    return jsonb_build_object('ok', false, 'rev', cur_rev, 'data', cur_data);
  end if;
  new_rev := cur_rev + 1;
  update public.student_data
    set data = body, rev = new_rev, updated_at = now()
    where user_id = uid;
  return jsonb_build_object('ok', true, 'rev', new_rev, 'data', body);
end;
$$;

create or replace function public.coach_student_brief(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  cid := public.own_coach_id();
  if cid is null or not public.is_active_coach(cid) then
    raise exception 'yetkisiz';
  end if;
  if p_student is null or not public.coach_linked_to_student(cid, p_student) then
    raise exception 'yetkisiz';
  end if;
  select sd.data into payload from public.student_data sd where sd.user_id = p_student;
  return jsonb_build_object('ok', true, 'payload', coalesce(payload, '{}'::jsonb));
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
  title_n text := trim(coalesce(p_title, ''));
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  cid := public.own_coach_id();
  if cid is null or not public.is_active_coach(cid) then
    raise exception 'yetkisiz';
  end if;
  if p_student_id is null or length(title_n) < 2 then
    raise exception 'öğrenci ve ödev gerekli';
  end if;
  if not public.coach_linked_to_student(cid, p_student_id) then
    raise exception 'bu öğrenci randevu veya eşleşme ile bağlı değil';
  end if;
  select h.id into hid
    from public.coach_homeworks h
    where h.coach_id = cid
      and h.student_id = p_student_id
      and lower(h.title) = lower(title_n)
      and h.due is not distinct from p_due
      and h.done = false
    limit 1;
  if hid is not null then
    return hid;
  end if;
  insert into public.coach_homeworks (coach_id, student_id, title, due)
  values (cid, p_student_id, title_n, p_due)
  returning id into hid;
  return hid;
end;
$$;

revoke all on function public.push_student_data(bigint, jsonb) from public, anon;
revoke all on function public.coach_student_brief(uuid) from public, anon;
revoke all on function public.assign_coach_homework(uuid, text, date) from public, anon;
revoke all on function public.own_coach_id() from public, anon;
revoke all on function public.is_active_coach(uuid) from public, anon;
revoke all on function public.coach_linked_to_student(uuid, uuid) from public, anon;
grant execute on function public.push_student_data(bigint, jsonb) to authenticated;
grant execute on function public.coach_student_brief(uuid) to authenticated;
grant execute on function public.assign_coach_homework(uuid, text, date) to authenticated;
grant execute on function public.own_coach_id() to authenticated;
grant execute on function public.is_active_coach(uuid) to authenticated;
grant execute on function public.coach_linked_to_student(uuid, uuid) to authenticated;
