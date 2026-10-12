-- Öğrenci onay + ad kilidi + uygunsuz isim.
-- Mevcut active öğrenciler backfill ile pending yapılmaz.
-- PRODUCTION'A otomatik uygulanmaz.

alter table public.profiles
  add column if not exists signup_intent text not null default 'student',
  add column if not exists signup_grade text not null default '',
  add column if not exists signup_track text not null default '',
  add column if not exists signup_exam text not null default '',
  add column if not exists approval_note text not null default '';

alter table public.profiles drop constraint if exists profiles_signup_intent_check;
alter table public.profiles add constraint profiles_signup_intent_check
  check (signup_intent in ('student', 'coach'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'pasif', 'pending', 'rejected'));

create or replace function public.normalize_person_key(p_raw text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(coalesce(p_raw, '')),
      'ıİIğĞüÜşŞöÖçÇâÂîÎûÛéÉ',
      'iiiiigguussooccaaiiuuee'),
    '[^a-z0-9]', '', 'g');
$$;

create or replace function public.person_name_blocked(p_raw text)
returns boolean
language plpgsql
immutable
as $$
declare
  compact text := public.normalize_person_key(p_raw);
  word text;
  exact text[] := array[
    'amk','amq','aq','mk','mq','oc','pic','amcik','yarak','yarrak','sik','sikerim',
    'siktir','siktigim','orospu','orospucocugu','orospuevladi','got','gotveren',
    'aminakoyim','aminakoyayim','amina','ibne','godos','pezevenk','serefsiz',
    'fuck','shit','bitch','asshole'
  ];
  longw text[] := array[
    'aminakoy','orospucocuk','orospuevlad','siktigimin','siktirgit','gotunu','gotveren','yarragi'
  ];
  w text;
begin
  if compact = '' then
    return false;
  end if;
  if compact = any(exact) then
    return true;
  end if;
  foreach w in array longw loop
    if length(w) >= 5 and position(w in compact) > 0 then
      return true;
    end if;
  end loop;
  foreach word in array regexp_split_to_array(lower(coalesce(p_raw, '')), '[\s''._-]+') loop
    if public.normalize_person_key(word) = any(exact) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.person_name_ok(p_raw text)
returns boolean
language sql
immutable
as $$
  select
    length(trim(coalesce(p_raw, ''))) between 3 and 80
    and p_raw ~ '^[[:alpha:]]+([ ''-][[:alpha:]]+)+$'
    and not public.person_name_blocked(p_raw);
$$;

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'yusufbesiroglu357@gmail.com' then
    new.role := 'admin';
    new.account_status := 'active';
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' then
      new.role := 'student';
    end if;
    new.role := coalesce(nullif(new.role, ''), 'student');
    if new.role not in ('student', 'coach') then
      new.role := 'student';
    end if;
    if auth.uid() is not null and not public.is_admin() then
      new.account_status := 'pending';
    elsif new.account_status is null or new.account_status not in ('active', 'pasif', 'pending', 'rejected') then
      new.account_status := 'pending';
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_admin() then
      new.role := old.role;
      new.account_status := old.account_status;
      new.approval_note := old.approval_note;
    elsif new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    elsif old.role = 'admin' and new.role is distinct from 'admin' then
      new.role := 'admin';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if nullif(trim(coalesce(new.name, '')), '') is not null and public.person_name_blocked(new.name) then
      raise exception 'Bu ad veya soyad kullanılamaz. Lütfen gerçek adınızı ve soyadınızı girin.';
    end if;
  elsif tg_op = 'UPDATE' then
    if nullif(trim(coalesce(old.name, '')), '') is not null then
      new.name := old.name;
    elsif nullif(trim(coalesce(new.name, '')), '') is not null then
      if public.person_name_blocked(new.name) then
        raise exception 'Bu ad veya soyad kullanılamaz. Lütfen gerçek adınızı ve soyadınızı girin.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_display_name on public.profiles;
create trigger profiles_protect_display_name
  before insert or update on public.profiles
  for each row execute procedure public.protect_display_name();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := 'student';
  st text := 'pending';
  full_name text;
  intent text;
begin
  if lower(coalesce(new.email, '')) = 'yusufbesiroglu357@gmail.com' then
    r := 'admin';
    st := 'active';
  end if;
  full_name := trim(concat_ws(' ',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'));
  if full_name = '' then
    full_name := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  end if;
  if public.person_name_blocked(full_name) then
    full_name := '';
  end if;
  intent := coalesce(nullif(new.raw_user_meta_data->>'intent', ''), 'student');
  if intent not in ('student', 'coach') then
    intent := 'student';
  end if;
  insert into public.profiles (
    id, email, name, role, account_status,
    signup_intent, signup_grade, signup_track, signup_exam
  )
  values (
    new.id,
    new.email,
    full_name,
    r,
    st,
    intent,
    coalesce(new.raw_user_meta_data->>'grade', ''),
    coalesce(new.raw_user_meta_data->>'track', ''),
    coalesce(new.raw_user_meta_data->>'exam', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when public.profiles.role = 'admin' then 'admin'
          when lower(coalesce(excluded.email, '')) = 'yusufbesiroglu357@gmail.com' then 'admin'
          else public.profiles.role
        end,
        name = case
          when nullif(trim(public.profiles.name), '') is not null then public.profiles.name
          else excluded.name
        end;
  return new;
end;
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
      if public.person_name_blocked(new.name) then
        raise exception 'Bu ad veya soyad kullanılamaz. Lütfen gerçek adınızı ve soyadınızı girin.';
      end if;
    elsif tg_op = 'UPDATE' then
      new.status := old.status;
      new.user_id := old.user_id;
      if nullif(trim(coalesce(old.name, '')), '') is not null then
        new.name := old.name;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.profile_display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.name), ''),
    'Öğrenci'
  )
  from public.profiles p
  where p.id = p_id;
$$;

create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

drop policy if exists "student_data_own_write" on public.student_data;
create policy "student_data_own_write" on public.student_data
  for all using (auth.uid() = user_id and public.account_is_active())
  with check (auth.uid() = user_id and public.account_is_active());

create or replace function public.admin_list_student_applications()
returns table (
  id uuid,
  name text,
  email text,
  registered_at timestamptz,
  account_status text,
  email_confirmed boolean,
  signup_grade text,
  signup_track text,
  signup_exam text,
  approval_note text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id,
    coalesce(nullif(trim(p.name), ''), 'Öğrenci'),
    coalesce(p.email, u.email),
    u.created_at,
    p.account_status,
    (u.email_confirmed_at is not null),
    coalesce(p.signup_grade, ''),
    coalesce(p.signup_track, ''),
    coalesce(p.signup_exam, ''),
    coalesce(p.approval_note, '')
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student'
    and coalesce(p.signup_intent, 'student') <> 'coach'
  order by u.created_at desc;
end;
$$;

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
      updated_at = now()
    where id = p_id
      and role = 'student';
end;
$$;

create or replace function public.admin_set_coach_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('pending', 'active', 'rejected', 'pasif') then
    raise exception 'geçersiz durum';
  end if;
  update public.coaches set status = p_status, updated_at = now() where id = p_id
    returning user_id into uid;
  if uid is not null and p_status = 'active' then
    update public.profiles
      set role = 'coach', account_status = 'active', updated_at = now()
      where id = uid and role <> 'admin';
  end if;
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

revoke all on function public.admin_list_student_applications() from public, anon;
revoke all on function public.admin_review_student(uuid, text, text) from public, anon;
revoke all on function public.account_is_active() from public, anon;
grant execute on function public.admin_list_student_applications() to authenticated;
grant execute on function public.admin_review_student(uuid, text, text) to authenticated;
grant execute on function public.account_is_active() to authenticated;
grant execute on function public.admin_set_coach_status(uuid, text) to authenticated;
