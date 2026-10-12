-- Yerel Docker. Production’da çalıştırma.

do $$
declare
  stu uuid := '11111111-1111-4111-8111-111111111111';
  oth uuid := '22222222-2222-4222-8222-222222222222';
  cch uuid := '33333333-3333-4333-8333-333333333333';
  cid uuid := '44444444-4444-4444-8444-444444444444';
  stray uuid := '55555555-5555-4555-8555-555555555555';
  r jsonb;
  hid uuid;
  hid2 uuid;
  n int;
begin
  insert into auth.users (id) values (stu), (oth), (cch), (stray) on conflict (id) do nothing;
  insert into public.coaches (id, user_id, status) values (cid, cch, 'active') on conflict (id) do update set user_id = excluded.user_id, status = 'active';
  insert into public.appointments (id, coach_id, student_id, status)
    values ('appt-1', cid, stu, 'onay') on conflict (id) do update set coach_id = excluded.coach_id, student_id = excluded.student_id;

  perform set_config('request.jwt.claim.sub', stu::text, true);
  set local role authenticated;
  r := public.push_student_data(0, '{"sessions":[{"id":"s1","minutes":10},{"id":"s1","minutes":99}]}'::jsonb);
  if r->>'ok' <> 'true' or (r->>'rev')::int <> 1 then
    raise exception 'ilk push ok/rev=1 olmalı: %', r;
  end if;
  if jsonb_array_length(r->'data'->'sessions') <> 1 then
    raise exception 'push canonicalize etmeli';
  end if;
  r := public.push_student_data(0, '{"sessions":[{"id":"s2"}]}'::jsonb);
  if r->>'ok' <> 'false' then
    raise exception 'eski rev kayıp güncellemeyi reddetmeli: %', r;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', oth::text, true);
  set local role authenticated;
  begin
    r := public.push_student_data(0, '{"dept":"hack"}'::jsonb);
  exception when others then
    r := '{"ok":false}'::jsonb;
  end;
  perform set_config('request.jwt.claim.sub', oth::text, true);
  select count(*) into n from public.student_data where user_id = stu;
  if n <> 0 then
    raise exception 'öğrenci B başkasının satırını görmemeli: %', n;
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', cch::text, true);
  set local role authenticated;
  r := public.coach_student_brief(stu);
  if r->>'ok' <> 'true' then
    raise exception 'bağlı koç özet okumalı: %', r;
  end if;
  hid := public.assign_coach_homework(stu, 'Paragraf 20', '2026-10-20');
  hid2 := public.assign_coach_homework(stu, 'Paragraf 20', '2026-10-20');
  if hid is distinct from hid2 then
    raise exception 'aynı ödev ikinci id almamalı';
  end if;
  begin
    perform public.coach_student_brief(oth);
    raise exception 'bağlı olmayan öğrenci özeti kaçmamalı';
  exception when others then
    if sqlerrm not like '%yetkisiz%' then
      raise;
    end if;
  end;
  reset role;

  perform set_config('request.jwt.claim.sub', stray::text, true);
  set local role authenticated;
  begin
    perform public.coach_student_brief(stu);
    raise exception 'koç olmayan özet okumamalı';
  exception when others then
    if sqlerrm not like '%yetkisiz%' then
      raise;
    end if;
  end;
  reset role;
end $$;
