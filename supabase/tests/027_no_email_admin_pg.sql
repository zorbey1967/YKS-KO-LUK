-- Yerel / throwaway PostgreSQL. Üretim URL kullanmayın. ROLLBACK.
-- Önkoşul: 020_local_pg_bootstrap.sql + 027_live010_no_email_admin.sql
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/020_local_pg_bootstrap.sql
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/027_live010_no_email_admin.sql
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/027_no_email_admin_pg.sql

begin;

alter table if exists auth.users add column if not exists email text;
alter table if exists auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;

do $$
declare
  student_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  admin_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  signup_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  role_got text;
  status_got text;
  admin_ok boolean;
  student_ok boolean;
  anon_admin boolean;
  anon_protect boolean;
  anon_handle boolean;
begin
  if to_regprocedure('public.protect_role()') is null then
    raise exception '027 yok: public.protect_role()';
  end if;

  insert into auth.users (id, email_confirmed_at, email)
    values (student_id, now(), 'student@example.com')
    on conflict (id) do update set email = excluded.email;
  insert into auth.users (id, email_confirmed_at, email)
    values (admin_id, now(), 'admin-keep@example.com')
    on conflict (id) do update set email = excluded.email;

  delete from public.profiles where id in (student_id, admin_id, signup_id);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.profiles (id, email, role, account_status, plan)
    values (admin_id, 'admin-keep@example.com', 'admin', 'active', 'Ücretsiz');

  perform set_config('request.jwt.claim.sub', student_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', student_id::text, 'role', 'authenticated')::text, true);

  insert into public.profiles (id, email, role, account_status, plan)
    values (student_id, 'student@example.com', 'admin', 'active', 'Ücretsiz');
  select role into role_got from public.profiles where id = student_id;
  if role_got is distinct from 'student' then
    raise exception 'oturumlu insert admin yazamamalı, got %', role_got;
  end if;

  update public.profiles
    set email = 'attacker@example.com', role = 'admin', account_status = 'active'
    where id = student_id;
  select role, account_status into role_got, status_got from public.profiles where id = student_id;
  if role_got is distinct from 'student' then
    raise exception 'profil e-posta değişimi rol yükseltmemeli, got %', role_got;
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role', 'authenticated')::text, true);
  admin_ok := public.is_admin();
  if admin_ok is distinct from true then
    raise exception 'aktif yönetici is_admin true olmalı';
  end if;

  update public.profiles set role = 'student' where id = student_id;
  select role into role_got from public.profiles where id = student_id;
  if role_got is distinct from 'student' then
    raise exception 'yönetici başkasını admin yapamamalı (zaten student)';
  end if;

  update public.profiles set role = 'admin' where id = student_id;
  select role into role_got from public.profiles where id = student_id;
  if role_got is distinct from 'student' then
    raise exception 'yönetici başka kullanıcıyı admin yapamamalı, got %', role_got;
  end if;

  update public.profiles set role = 'student' where id = admin_id;
  select role into role_got from public.profiles where id = admin_id;
  if role_got is distinct from 'admin' then
    raise exception 'oturumlu yönetici kendini düşüremez, got %', role_got;
  end if;

  perform set_config('request.jwt.claim.sub', student_id::text, true);
  student_ok := public.is_admin();
  if student_ok is distinct from false then
    raise exception 'öğrenci is_admin false olmalı';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.profiles (id, email, role, account_status, plan)
    values (signup_id, 'new-admin-claim@example.com', 'admin', 'active', 'Ücretsiz');
  select role into role_got from public.profiles where id = signup_id;
  if role_got is distinct from 'admin' then
    raise exception 'auth.uid null SQL Editor admin atayabilmeli, got %', role_got;
  end if;

  select has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') into anon_admin;
  select has_function_privilege('anon', 'public.protect_role()', 'EXECUTE') into anon_protect;
  select has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') into anon_handle;
  if anon_admin or anon_protect or anon_handle then
    raise exception 'anon tetikleyici/RPC EXECUTE olmamalı admin=% protect=% handle=%', anon_admin, anon_protect, anon_handle;
  end if;
end
$$;

rollback;
