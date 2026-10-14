-- İzole PG. Production URL ile çalıştırılmaz.
-- Beklenen: trial öğrenci-only; 032 skip/koruma; koç is_admin false.

begin;

do $$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  student uuid := '22222222-2222-4222-8222-222222222222';
  coach uuid := '33333333-3333-4333-8333-333333333333';
  admin uuid := '44444444-4444-4444-8444-444444444444';
  other uuid := '55555555-5555-4555-8555-555555555555';
  bogus uuid := '00000000-0000-4000-8000-000000000001';
  preview jsonb;
  dis jsonb;
  trial jsonb;
  n_appt integer;
  n_meet integer;
  n_pay integer;
  n_prof integer;
  got boolean;
  n_sd integer;
  n_er integer;
  n_wp integer;
begin
  insert into auth.users (id) values (owner), (student), (coach), (admin), (other)
    on conflict (id) do nothing;

  insert into public.profiles (id, role, account_status, plan)
  values
    (owner, 'admin', 'active', 'premium'),
    (student, 'student', 'active', 'Ücretsiz'),
    (coach, 'coach', 'active', 'Ücretsiz'),
    (admin, 'admin', 'active', 'Ücretsiz'),
    (other, 'student', 'active', 'Ücretsiz')
  on conflict (id) do update set role = excluded.role, account_status = excluded.account_status;

  insert into public.student_data (user_id, data) values (student, '{"secret":1}'::jsonb)
    on conflict (user_id) do update set data = excluded.data;
  insert into public.coaches (id, user_id, name, status)
  values (coach, coach, 'Koç', 'active')
    on conflict (id) do nothing;
  insert into public.appointments (id, coach_id, student_id, status)
  values ('appt-1', coach, student, 'onay')
    on conflict (id) do nothing;
  insert into public.meeting_rooms (appointment_id, status) values ('appt-1', 'open')
    on conflict (appointment_id) do nothing;
  insert into public.billing_payments (user_id, amount, status) values (student, 200, 'succeeded');

  -- 1) oturumsuz trial
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    trial := public.start_top_plan_trial();
    raise exception 'oturumsuz trial reddedilmeli';
  exception
    when others then
      if sqlerrm not like '%oturum gerekli%' then raise; end if;
  end;

  -- 2) koç trial
  perform set_config('request.jwt.claim.sub', coach::text, true);
  begin
    trial := public.start_top_plan_trial();
    raise exception 'koç trial reddedilmeli';
  exception
    when others then
      if sqlerrm not like '%öğrenci%' then raise; end if;
  end;

  -- 3) askı trial
  update public.profiles set account_status = 'pasif' where id = student;
  perform set_config('request.jwt.claim.sub', student::text, true);
  begin
    trial := public.start_top_plan_trial();
    raise exception 'askı trial reddedilmeli';
  exception
    when others then
      if sqlerrm not like '%askıda%' then raise; end if;
  end;
  update public.profiles set account_status = 'active' where id = student;

  -- 4) öğrenci trial bir kez; tekrar yazmaz
  perform set_config('request.jwt.claim.sub', student::text, true);
  trial := public.start_top_plan_trial();
  if trial->>'status' is distinct from 'trialing' then
    raise exception 'öğrenci trial başlamalı: %', trial;
  end if;
  trial := public.start_top_plan_trial();
  if trial->>'status' is distinct from 'trialing' then
    raise exception 'ikinci trial yazmamalı: %', trial;
  end if;
  if (select count(*) from public.profiles p
      where p.id = student and p.trial_started_at is not null) <> 1 then
    raise exception 'trial satırı tek olmalı';
  end if;

  -- 5) koç is_admin ve yabancı student_data
  perform set_config('request.jwt.claim.sub', coach::text, true);
  select public.is_admin() into got;
  if got is not false then
    raise exception 'koç is_admin olmamalı';
  end if;
  begin
    perform public.admin_set_account_status(student, 'pasif');
    raise exception 'koç admin RPC çalışmamalı';
  exception
    when others then
      if sqlerrm like '%koç admin RPC çalışmamalı%' then raise; end if;
      if sqlerrm not like '%yetkisiz%' then raise; end if;
  end;

  if to_regclass('public.exam_reports') is not null then
    insert into public.exam_reports (user_id, exam_name) values (student, 'gizli');
  end if;
  if to_regclass('public.student_week_plans') is not null then
    insert into public.student_week_plans (student_id, notes) values (other, 'özel')
      on conflict (student_id) do nothing;
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', coach::text, true);
  select count(*)::integer into n_sd from public.student_data where user_id = student;
  if n_sd <> 0 then
    raise exception 'koç yabancı student_data okumamalı: %', n_sd;
  end if;
  n_er := 0;
  n_wp := 0;
  if to_regclass('public.exam_reports') is not null then
    begin
      select count(*)::integer into n_er from public.exam_reports where user_id = student;
    exception
      when insufficient_privilege then n_er := 0;
    end;
    if n_er <> 0 then
      raise exception 'koç atanmamış exam_reports okumamalı';
    end if;
  end if;
  if to_regclass('public.student_week_plans') is not null then
    begin
      select count(*)::integer into n_wp from public.student_week_plans where student_id = other;
    exception
      when insufficient_privilege then n_wp := 0;
    end;
    if n_wp <> 0 then
      raise exception 'koç yabancı haftalık program okumamalı';
    end if;
  end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);

  -- 6) 032 yanlış / boş / pasif
  delete from public.platform_owner;
  preview := public.preview_disable_non_owner_accounts(owner);
  if preview->>'skipped' is distinct from 'true' then
    raise exception 'boş sahip skip etmeli';
  end if;
  if (preview->>'would_suspend_profiles')::int <> 0 then
    raise exception 'boş sahip sıfır kapatma';
  end if;

  insert into public.platform_owner (user_id) values (owner);
  preview := public.preview_disable_non_owner_accounts(bogus);
  if preview->>'reason' not like '%UUID%' then
    raise exception 'yanlış UUID: %', preview;
  end if;

  update public.profiles set account_status = 'pasif' where id = owner;
  preview := public.preview_disable_non_owner_accounts(owner);
  if preview->>'reason' not like '%aktif sahip%' then
    raise exception 'pasif sahip: %', preview;
  end if;
  update public.profiles set account_status = 'active' where id = owner;

  begin
    delete from public.platform_owner;
    update public.profiles set role = 'student' where id = owner;
    insert into public.platform_owner (user_id) values (owner);
    preview := public.preview_disable_non_owner_accounts(owner);
    if (preview->>'keep_profiles')::int < 2 then
      raise exception 'son yönetici korunmalı: %', preview;
    end if;
    perform public.disable_non_owner_accounts(owner, preview);
    if exists (select 1 from public.profiles where id = admin and account_status is distinct from 'active') then
      raise exception 'son yönetici pasife alınmamalı';
    end if;
    raise exception 'last_admin_ok';
  exception
    when others then
      if sqlerrm like 'son yönetici%' then raise; end if;
      if sqlerrm is distinct from 'last_admin_ok' then raise; end if;
  end;

  select count(*)::integer into n_appt from public.appointments;
  select count(*)::integer into n_meet from public.meeting_rooms;
  select count(*)::integer into n_pay from public.billing_payments;
  preview := public.preview_disable_non_owner_accounts(owner);
  if (preview->>'skipped')::boolean then
    raise exception 'doğrulanmış sahip önizleme skip etmemeli: %', preview;
  end if;
  if (preview->>'keep_profiles')::int < 1 then
    raise exception 'korunan profil sayılmalı';
  end if;

  dis := public.disable_non_owner_accounts(owner, preview);
  if (select count(*) from public.appointments) is distinct from n_appt
     or (select count(*) from public.meeting_rooms) is distinct from n_meet
     or (select count(*) from public.billing_payments) is distinct from n_pay then
    raise exception 'randevu/görüşme/ödeme sayısı değişti';
  end if;
  if exists (select 1 from public.profiles where id = owner and account_status is distinct from 'active') then
    raise exception 'sahip kapanmamalı';
  end if;
  if exists (select 1 from public.profiles where id = admin and account_status is distinct from 'active')
     and (select role from public.profiles where id = owner) is distinct from 'admin' then
    raise exception 'son yönetici kapanmamalı';
  end if;
  select count(*)::integer into n_prof from public.profiles where account_status = 'pasif';
  dis := public.disable_non_owner_accounts(owner, preview);
  if (dis->>'updated_profiles')::int <> 0 then
    raise exception 'idempotent ikinci çalıştırma yazmamalı: %', dis;
  end if;
  if (select count(*) from public.profiles where account_status = 'pasif') is distinct from n_prof then
    raise exception 'ikinci çalıştırma ek pasif üretmemeli';
  end if;
end
$$;

rollback;
