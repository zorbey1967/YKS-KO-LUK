-- İzole PG. respond_appointment yok. Canlı URL yok. ROLLBACK.
begin;

do $$
declare
  student uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  other uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
  coach_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
  coach_row uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  admin_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';
  out jsonb;
  st text;
  dup boolean;
  ev int;
begin
  if to_regprocedure('public.request_cancel_approved_appointment(text)') is null then
    raise exception '040 yok';
  end if;

  insert into auth.users (id) values (student), (other), (coach_user), (admin_id)
    on conflict (id) do nothing;
  insert into public.profiles (id, role, account_status)
  values
    (student, 'student', 'active'),
    (other, 'student', 'active'),
    (coach_user, 'coach', 'active'),
    (admin_id, 'admin', 'active')
  on conflict (id) do update set role = excluded.role, account_status = 'active';
  insert into public.coaches (id, user_id, status)
  values (coach_row, coach_user, 'active')
  on conflict (id) do update set user_id = excluded.user_id, status = 'active';
  insert into public.appointments (id, coach_id, student_id, status)
  values ('appt-onay-1', coach_row, student, 'onay')
  on conflict (id) do update set coach_id = excluded.coach_id, student_id = excluded.student_id, status = 'onay';

  perform set_config('request.jwt.claim.sub', other::text, true);
  begin
    perform public.request_cancel_approved_appointment('appt-onay-1');
    raise exception 'yabancı öğrenci talep açamamalı';
  exception
    when others then
      if sqlerrm like '%yabancı öğrenci talep açamamalı%' then raise; end if;
      if sqlerrm not like '%yetkisiz%' then raise exception 'beklenen yetkisiz, got %', sqlerrm; end if;
  end;

  perform set_config('request.jwt.claim.sub', student::text, true);
  out := public.request_cancel_approved_appointment('appt-onay-1');
  if coalesce((out->>'duplicate')::boolean, true) is not false then
    raise exception 'ilk talep duplicate olmamalı';
  end if;
  out := public.request_cancel_approved_appointment('appt-onay-1');
  dup := coalesce((out->>'duplicate')::boolean, false);
  if dup is not true then
    raise exception 'ikinci talep duplicate olmalı';
  end if;

  begin
    perform public.decide_approved_appointment_cancel('appt-onay-1', true);
    raise exception 'öğrenci karar verememeli';
  exception
    when others then
      if sqlerrm like '%öğrenci karar verememeli%' then raise; end if;
      if sqlerrm not like '%koç veya yönetici%' then raise exception 'beklenen koç/yönetici, got %', sqlerrm; end if;
  end;

  perform set_config('request.jwt.claim.sub', other::text, true);
  begin
    perform public.decide_approved_appointment_cancel('appt-onay-1', true);
    raise exception 'yabancı karar verememeli';
  exception
    when others then
      if sqlerrm like '%yabancı karar verememeli%' then raise; end if;
      if sqlerrm not like '%koç veya yönetici%' and sqlerrm not like '%yetkisiz%' then
        raise exception 'beklenen yetkisiz karar, got %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', coach_user::text, true);
  out := public.decide_approved_appointment_cancel('appt-onay-1', false);
  select status into st from public.appointments where id = 'appt-onay-1';
  if st is distinct from 'onay' then
    raise exception 'red sonra onay kalmalı, got %', st;
  end if;

  perform set_config('request.jwt.claim.sub', student::text, true);
  out := public.request_cancel_approved_appointment('appt-onay-1');
  perform set_config('request.jwt.claim.sub', coach_user::text, true);
  out := public.decide_approved_appointment_cancel('appt-onay-1', true);
  select status into st from public.appointments where id = 'appt-onay-1';
  if st is distinct from 'iptal' then
    raise exception 'kabul sonrası iptal olmalı, got %', st;
  end if;
  if exists (select 1 from public.appointments where id = 'appt-onay-1') is not true then
    raise exception 'satır silinmemeli';
  end if;
  select count(*)::int into ev from public.appointment_cancel_events where appointment_id = 'appt-onay-1';
  if ev < 3 then
    raise exception 'denetim olayları eksik, got %', ev;
  end if;
end
$$;

rollback;
