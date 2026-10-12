begin;

do $$
declare
  u uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  role_got text;
  anon_ok boolean;
begin
  insert into auth.users (id, email_confirmed_at) values (u, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  delete from public.profiles where id = u;

  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u::text)::text, true);
  insert into public.profiles (id, email, role, account_status, plan)
    values (u, 'yusufbesiroglu357@gmail.com', 'admin', 'active', 'Ücretsiz');
  select role into role_got from public.profiles where id = u;
  if role_got is distinct from 'student' then
    raise exception 'oturumlu insert e-posta ile admin olmamalı, got %', role_got;
  end if;

  delete from public.profiles where id = u;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.profiles (id, email, role, account_status, plan)
    values (u, 'anyone@example.com', 'admin', 'active', 'Ücretsiz');
  select role into role_got from public.profiles where id = u;
  if role_got is distinct from 'admin' then
    raise exception 'auth.uid null (SQL Editor) admin atayabilmeli, got %', role_got;
  end if;

  select has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') into anon_ok;
  if anon_ok then
    raise exception 'anon is_admin EXECUTE olmamalı';
  end if;
end
$$;

rollback;
