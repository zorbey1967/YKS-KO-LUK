-- Yerel Docker. Production’da çalıştırma.

select public.canonicalize_student_json(
  '{"sessions":[{"id":"s1","minutes":10},{"id":"s1","minutes":99},{"id":"s2","minutes":5}]}'::jsonb
) -> 'sessions' as sessions;

do $$
declare
  n int;
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  insert into auth.users (id) values (a), (b) on conflict (id) do nothing;
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.student_data (user_id, data)
    values (a, '{"sessions":[{"id":"s1"},{"id":"s1"}]}'::jsonb)
    on conflict (user_id) do update set data = excluded.data;
  select jsonb_array_length(data->'sessions') into n from public.student_data where user_id = a;
  if n <> 1 then
    raise exception 'duplicate session id kalmamalı: %', n;
  end if;
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.student_data;
  if n <> 0 then
    raise exception 'öğrenci B başkasının student_data satırını görmemeli: %', n;
  end if;
  reset role;
end $$;
