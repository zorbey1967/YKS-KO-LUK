-- Yerel / staging. Production’a bu turda uygulanmaz.
-- Sessiz kütüphane (AV yok) ve koç özel oda. Kayıt yok. UUID/e-posta roster’da yok.

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  coach_id uuid,
  voice_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint study_rooms_kind_check check (kind in ('library', 'coach'))
);

insert into public.study_rooms (id, kind)
values ('00000000-0000-0000-0000-000000000001', 'library')
on conflict (id) do nothing;

create table if not exists public.study_presence (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Öğrenci',
  accumulated_ms bigint not null default 0,
  last_seen timestamptz not null default now(),
  share_exams boolean not null default false,
  primary key (room_id, user_id)
);

create table if not exists public.study_kicks (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null,
  by_user uuid not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.study_rooms enable row level security;
alter table public.study_presence enable row level security;
alter table public.study_kicks enable row level security;
alter table public.study_rooms force row level security;
alter table public.study_presence force row level security;
alter table public.study_kicks force row level security;

drop policy if exists "study_rooms_select" on public.study_rooms;
create policy "study_rooms_select" on public.study_rooms
  for select using (
    kind = 'library'
    or public.is_admin()
    or coach_id in (select c.id from public.coaches c where c.user_id = auth.uid())
  );

drop policy if exists "presence_own" on public.study_presence;
create policy "presence_own" on public.study_presence
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "presence_roster" on public.study_presence;
create policy "presence_roster" on public.study_presence
  for select using (
    room_id in (select r.id from public.study_rooms r where r.kind = 'library')
    or public.is_admin()
    or room_id in (
      select r.id from public.study_rooms r
      join public.coaches c on c.id = r.coach_id
      where c.user_id = auth.uid()
    )
  );

drop policy if exists "kicks_coach" on public.study_kicks;
create policy "kicks_coach" on public.study_kicks
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or room_id in (
      select r.id from public.study_rooms r
      join public.coaches c on c.id = r.coach_id
      where c.user_id = auth.uid()
    )
  );

create or replace function public.library_heartbeat(p_display text, p_share boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid := '00000000-0000-0000-0000-000000000001';
  prev timestamptz;
  acc bigint := 0;
  delta bigint := 0;
  name text;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  if not public.caller_account_active() then
    raise exception 'hesap askıda';
  end if;
  name := left(trim(coalesce(nullif(p_display, ''), 'Öğrenci')), 40);
  select last_seen, accumulated_ms into prev, acc
    from public.study_presence
    where room_id = rid and user_id = auth.uid();
  if found then
    delta := floor(extract(epoch from (now() - prev)) * 1000);
    if delta > 0 and delta <= 45000 then
      acc := acc + least(delta, 30000);
    end if;
    update public.study_presence
      set accumulated_ms = acc, last_seen = now(), display_name = name, share_exams = coalesce(p_share, false)
      where room_id = rid and user_id = auth.uid();
  else
    insert into public.study_presence (room_id, user_id, display_name, share_exams)
    values (rid, auth.uid(), name, coalesce(p_share, false));
    acc := 0;
  end if;
  return jsonb_build_object('ok', true, 'accumulated_ms', acc);
end;
$$;

create or replace function public.library_roster()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'display_name', p.display_name,
    'minutes', floor(p.accumulated_ms / 60000.0),
    'share_exams', p.share_exams
  ) order by p.accumulated_ms desc), '[]'::jsonb)
  from public.study_presence p
  where p.room_id = '00000000-0000-0000-0000-000000000001'
    and p.last_seen > now() - interval '2 minutes';
$$;

create or replace function public.coach_ensure_room()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  rid uuid;
begin
  cid := public.own_coach_id();
  if cid is null then
    raise exception 'koç kaydı yok';
  end if;
  select r.id into rid from public.study_rooms r where r.kind = 'coach' and r.coach_id = cid;
  if rid is null then
    insert into public.study_rooms (kind, coach_id) values ('coach', cid) returning id into rid;
  end if;
  return rid;
end;
$$;

create or replace function public.coach_kick_student(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'oturum gerekli';
  end if;
  rid := public.coach_ensure_room();
  if not exists (
    select 1 from public.coach_matches m
    where m.coach_id = public.own_coach_id() and m.student_id = p_student and m.status = 'active'
  ) then
    raise exception 'yetkisiz';
  end if;
  insert into public.study_kicks (room_id, user_id, by_user)
  values (rid, p_student, auth.uid())
  on conflict (room_id, user_id) do update set created_at = now(), by_user = excluded.by_user;
  delete from public.study_presence where room_id = rid and user_id = p_student;
  return jsonb_build_object('ok', true, 'kicked', true, 'room_id', rid);
end;
$$;

revoke all on function public.library_heartbeat(text, boolean) from public, anon;
grant execute on function public.library_heartbeat(text, boolean) to authenticated;
revoke all on function public.library_roster() from public, anon;
grant execute on function public.library_roster() to authenticated;
revoke all on function public.coach_ensure_room() from public, anon;
grant execute on function public.coach_ensure_room() to authenticated;
revoke all on function public.coach_kick_student(uuid) from public, anon;
grant execute on function public.coach_kick_student(uuid) to authenticated;
revoke all on table public.study_rooms from public, anon;
revoke all on table public.study_presence from public, anon;
revoke all on table public.study_kicks from public, anon;
grant select on table public.study_rooms to authenticated;
grant select, insert, update, delete on table public.study_presence to authenticated;
grant select, insert on table public.study_kicks to authenticated;
