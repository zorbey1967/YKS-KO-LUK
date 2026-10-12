-- Gerçek PostgreSQL. Şartlar: throwaway DB, bootstrap + 020 uygulanmış, YKS_PG_TEST_URL.
-- Üretim URL kullanmayın. Sentetik uuid. ROLLBACK ile biter (DDL 020 hariç).
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/020_entitlement_pg.sql

begin;

do $$
declare
  self_id uuid := '11111111-1111-4111-8111-111111111111';
  other_id uuid := '22222222-2222-4222-8222-222222222222';
  coach_id uuid := '33333333-3333-4333-8333-333333333333';
  admin_id uuid := '44444444-4444-4444-8444-444444444444';
  entitled boolean;
  anon_ok boolean;
  auth_ok boolean;
  join_ok boolean;
  appt jsonb;
  appt_err text;
begin
  if to_regprocedure('public.student_entitled(uuid)') is null then
    raise exception '020 yok: public.student_entitled(uuid) tanımlı değil';
  end if;

  insert into auth.users (id, email_confirmed_at) values (self_id, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into auth.users (id, email_confirmed_at) values (other_id, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into public.profiles (id, role, account_status, plan)
    values (self_id, 'student', 'active', 'Ücretsiz')
    on conflict (id) do update set account_status = 'active';
  insert into public.profiles (id, role, account_status, plan, subscription_status, trial_ends_at)
    values (other_id, 'student', 'active', 'Ücretsiz', 'trialing', now() + interval '7 days')
    on conflict (id) do update set subscription_status = 'trialing', trial_ends_at = now() + interval '7 days';

  perform set_config('request.jwt.claim.sub', self_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', self_id::text)::text, true);

  entitled := public.student_entitled(other_id);
  if entitled is distinct from false then
    raise exception 'oracle: başka uuid true döndü';
  end if;

  entitled := public.student_entitled(self_id);
  if entitled is distinct from false then
    raise exception 'NULL üyelik false olmalı, got %', entitled;
  end if;

  begin
    select public.request_appointment(null) into appt;
    raise exception 'üyeliksiz randevu istisna üretmeli';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%üyelik gerekli%' then
        raise exception 'beklenen üyelik gerekli, got %', appt_err;
      end if;
  end;

  update public.profiles
    set subscription_status = 'trialing', trial_ends_at = now() + interval '7 days'
    where id = self_id;

  entitled := public.student_entitled(self_id);
  if entitled is distinct from true then
    raise exception 'geçerli deneme true olmalı';
  end if;

  begin
    select public.request_appointment(null) into appt;
    raise exception 'slot yok istisnası beklenirdi';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%slot yok%' then
        raise exception 'denemeli randevu slot yok demeli, got %', appt_err;
      end if;
  end;

  entitled := public.student_entitled(other_id);
  if entitled is distinct from false then
    raise exception 'çağıran self iken other uuid true olmamalı';
  end if;

  update public.profiles
    set subscription_status = 'active', trial_ends_at = null, subscription_ends_at = now() - interval '1 day'
    where id = self_id;
  entitled := public.student_entitled(self_id);
  if entitled is distinct from false then
    raise exception 'süresi dolmuş üyelik false olmalı';
  end if;
  begin
    select public.request_appointment(null) into appt;
    raise exception 'dolmuş üyelikte randevu istisna üretmeli';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%üyelik gerekli%' then
        raise exception 'dolmuş üyelik: üyelik gerekli beklenirdi, got %', appt_err;
      end if;
  end;

  update public.profiles
    set subscription_status = 'trialing', trial_ends_at = now() + interval '7 days', subscription_ends_at = null,
        account_status = 'pasif'
    where id = self_id;
  entitled := public.student_entitled(self_id);
  if entitled is distinct from false then
    raise exception 'pasif hesap false olmalı';
  end if;

  update public.profiles set account_status = 'active' where id = self_id;
  update auth.users set email_confirmed_at = null where id = self_id;
  entitled := public.student_entitled(self_id);
  if entitled is distinct from true then
    raise exception 'doğrulanmamış e-posta student_entitled true (e-posta kapısı randevuda)';
  end if;
  begin
    select public.request_appointment(null) into appt;
    raise exception 'doğrulanmamış e-posta randevu istisna üretmeli';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%e-posta doğrulanmamış%' then
        raise exception 'beklenen e-posta doğrulanmamış, got %', appt_err;
      end if;
  end;
  update auth.users set email_confirmed_at = now() where id = self_id;

  insert into auth.users (id, email_confirmed_at) values (coach_id, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into auth.users (id, email_confirmed_at) values (admin_id, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into public.profiles (id, role, account_status, plan)
    values (coach_id, 'coach', 'active', 'Ücretsiz')
    on conflict (id) do update set role = 'coach', account_status = 'active';
  insert into public.profiles (id, role, account_status, plan)
    values (admin_id, 'admin', 'active', 'Ücretsiz')
    on conflict (id) do update set role = 'admin', account_status = 'active';

  perform set_config('request.jwt.claim.sub', coach_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', coach_id::text)::text, true);
  entitled := public.student_entitled(coach_id);
  if entitled is distinct from true then
    raise exception 'koç üyeliksiz student_entitled true olmalı';
  end if;
  begin
    select public.request_appointment(null) into appt;
    raise exception 'koç randevu slot yok demeli';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%slot yok%' then
        raise exception 'koç: slot yok beklenirdi, got %', appt_err;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id::text)::text, true);
  entitled := public.student_entitled(admin_id);
  if entitled is distinct from true then
    raise exception 'yönetici üyeliksiz student_entitled true olmalı';
  end if;
  begin
    select public.request_appointment(null) into appt;
    raise exception 'yönetici randevu slot yok demeli';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%slot yok%' then
        raise exception 'yönetici: slot yok beklenirdi, got %', appt_err;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', self_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', self_id::text)::text, true);
  begin
    perform public.admin_review_student(other_id, 'active', '');
    raise exception 'admin_review succeeded';
  exception
    when others then
      appt_err := sqlerrm;
      if appt_err not like '%yetkisiz%' then
        raise exception 'admin_review yetkisiz beklenirdi, got %', appt_err;
      end if;
  end;

  insert into public.appointments (id, coach_id, student_id, status)
    values ('ap_join_ok', coach_id, self_id, 'onay')
    on conflict (id) do update set student_id = excluded.student_id, status = 'onay';
  join_ok := public.can_join_meeting('ap_join_ok');
  if join_ok is distinct from true then
    raise exception 'taraf öğrenci onaylı randevuya girebilmeli (009 üyelik yok)';
  end if;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other_id::text)::text, true);
  join_ok := public.can_join_meeting('ap_join_ok');
  if join_ok is distinct from false then
    raise exception 'yabancı can_join_meeting false olmalı';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  join_ok := public.can_join_meeting('ap_join_ok');
  if join_ok is distinct from false then
    raise exception 'oturumsuz can_join_meeting false olmalı';
  end if;

  select has_function_privilege('anon', 'public.student_entitled(uuid)', 'EXECUTE') into anon_ok;
  select has_function_privilege('authenticated', 'public.student_entitled(uuid)', 'EXECUTE') into auth_ok;
  if anon_ok then
    raise exception 'anon EXECUTE olmamalı';
  end if;
  if auth_ok then
    raise exception 'authenticated EXECUTE olmamalı';
  end if;
  select has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') into anon_ok;
  if anon_ok then
    raise exception 'anon is_admin EXECUTE olmamalı';
  end if;
end
$$;

rollback;
