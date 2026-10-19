-- Throwaway prova testi (050). ROLLBACK; veri kalıcı değil. Üretim/staging URL kullanmayın.
-- Önkoşul (scripts/run-pg-commercial.mjs): supabase_like_bootstrap → 001–010 → live010_seed
--   → (senaryoya göre 011–040 zinciri) → 041–049 → 050 (iki kez: idempotent).
-- Senaryo A (canlıya yakın) ve B (tam zincir) için aynı dosya çalışır.
begin;

-- 1) profiles: katalog --------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_own_upsert';
  if n <> 0 then raise exception 'profiles_own_upsert kalmamalı'; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'profiles' and cmd in ('ALL', 'INSERT', 'DELETE');
  if n <> 0 then raise exception 'profiles için ALL/INSERT/DELETE politikası olmamalı (%)', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_own_select';
  if n <> 1 then raise exception 'profiles_own_select korunmalı'; end if;

  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     or has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
     or has_table_privilege('anon', 'public.profiles', 'INSERT')
     or has_table_privilege('anon', 'public.profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.profiles', 'DELETE') then
    raise exception 'anon/authenticated tablo düzeyinde INSERT/UPDATE/DELETE olmamalı';
  end if;
  if not (has_column_privilege('authenticated', 'public.profiles', 'target_department', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'target_rank', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'name', 'UPDATE')) then
    raise exception 'hedef kolonları güncellenebilmeli';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'plan', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'subscription_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'trial_ends_at', 'UPDATE') then
    raise exception 'email/role/plan/üyelik kolonları istemciden yazılamamalı';
  end if;

  -- Kritik fonksiyonlarda search_path sabit
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('is_admin', 'protect_role', 'handle_new_user', 'apply_verified_payment',
                      'apply_payment_refund', 'start_top_plan_trial', 'admin_list_payments',
                      'admin_list_billing', 'admin_billing_overview')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if n <> 0 then raise exception 'search_path sabitlenmemiş % fonksiyon var', n; end if;

  -- E-posta ile admin atama kodu kalmamalı
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('protect_role', 'handle_new_user')
    and p.prosrc ~* '@[a-z0-9.-]+\.(com|net|org)';
  if n <> 0 then raise exception 'protect_role/handle_new_user içinde e-posta sabiti var'; end if;
end
$$;

-- 2) Öğrenci istemci yetkileri ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  n int;
begin
  begin
    update public.profiles set email = 'owner@example.com' where id = 'a0000000-0000-4000-8000-000000000002';
    raise exception 'öğrenci e-postasını değiştirememeli';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000002';
    raise exception 'öğrenci rol yazamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set plan = 'premium', subscription_status = 'active' where id = 'a0000000-0000-4000-8000-000000000002';
    raise exception 'öğrenci paket yazamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000002';
    raise exception 'öğrenci profilini silememeli';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, email) values ('a0000000-0000-4000-8000-000000000002', 'x@example.com');
    raise exception 'öğrenci profil ekleyememeli';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set target_department = 'Tıp', target_rank = 1500, updated_at = now()
   where id = 'a0000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'öğrenci hedefini güncelleyebilmeli'; end if;

  update public.profiles set target_rank = 1 where id = 'a0000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'başkasının profili güncellenmemeli'; end if;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'öğrenci yalnız kendi profilini görmeli (%)', n; end if;
end
$$;
reset role;

-- 3) Kayıt ve rol -------------------------------------------------------------------------
do $$
declare
  r record;
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('b0000000-0000-4000-8000-000000000002', 'yeniogr@example.com', now(),
     '{"first_name":"Ece","last_name":"Su","intent":"student","grade":"12. Sınıf","track":"Sayısal","exam":"YKS"}');
  select * into r from public.profiles where id = 'b0000000-0000-4000-8000-000000000002';
  if r.role <> 'student' or r.account_status <> 'active' or r.signup_intent <> 'student'
     or r.signup_grade <> '12. Sınıf' or r.signup_track <> 'Sayısal' or r.signup_exam <> 'YKS' or r.name <> 'Ece Su' then
    raise exception 'öğrenci kaydı beklenmedik: %', row_to_json(r);
  end if;

  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('b0000000-0000-4000-8000-000000000001', 'yenikoc@example.com', now(),
     '{"first_name":"Can","last_name":"Demir","intent":"coach"}');
  select * into r from public.profiles where id = 'b0000000-0000-4000-8000-000000000001';
  if r.role <> 'student' or r.signup_intent <> 'coach' then
    raise exception 'koç adayı kaydı beklenmedik: %', row_to_json(r);
  end if;

  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('b0000000-0000-4000-8000-000000000003', 'owner-lookalike@example.com', now(), '{"intent":"admin","role":"admin"}');
  select * into r from public.profiles where id = 'b0000000-0000-4000-8000-000000000003';
  if r.role <> 'student' or r.signup_intent <> 'student' then raise exception 'kayıt admin açılmamalı: %', r.role; end if;

  select count(*) into n from public.profiles where id = 'a0000000-0000-4000-8000-000000000004' and role = 'coach';
  if n <> 1 then raise exception 'onaylı koç coach olmalı'; end if;
  select count(*) into n from public.profiles where id = 'a0000000-0000-4000-8000-000000000005' and role = 'student';
  if n <> 1 then raise exception 'bekleyen koç öğrenci kalmalı'; end if;
  select count(*) into n from public.profiles where id = 'a0000000-0000-4000-8000-000000000001' and role = 'admin';
  if n <> 1 then raise exception 'sahip admin kalmalı'; end if;
end
$$;

-- 4) Ödeme, yenileme, yükseltme, iade -----------------------------------------------------
do $$
declare
  u uuid := 'a0000000-0000-4000-8000-000000000002';
  r jsonb;
  e1 timestamptz;
  e2 timestamptz;
  e3 timestamptz;
  e4 timestamptz;
  st text;
  pl text;
  near interval := interval '5 minutes';
begin
  r := public.apply_verified_payment(u, 'pro', 'shopier', 'O-1', 100, null, 'O-1');
  e1 := (r->>'period_end')::timestamptz;
  if abs(extract(epoch from (e1 - (now() + interval '30 days')))) > extract(epoch from near) then
    raise exception 'ilk ödeme 30 gün olmalı: %', r;
  end if;
  if (r->>'extended')::boolean then raise exception 'ilk ödeme uzatma sayılmamalı'; end if;

  update public.billing_subscriptions set period_end = now() + interval '20 days' where user_id = u;
  r := public.apply_verified_payment(u, 'pro', 'shopier', 'O-2', 100, null, 'O-2');
  e2 := (r->>'period_end')::timestamptz;
  if abs(extract(epoch from (e2 - (now() + interval '50 days')))) > extract(epoch from near) then
    raise exception 'yenileme kalan 20 günü korumalı (beklenen +50 gün): %', r;
  end if;
  if not (r->>'extended')::boolean then raise exception 'yenileme extended=true olmalı'; end if;

  r := public.apply_verified_payment(u, 'pro', 'shopier', 'O-2', 100, null, 'O-2');
  if not (r->>'duplicate_payment')::boolean or (r->>'period_end')::timestamptz <> e2 then
    raise exception 'tekrar eden ödeme süreyi değiştirmemeli: %', r;
  end if;

  r := public.apply_verified_payment(u, 'premium', 'shopier', 'O-3', 200, null, 'O-3');
  e3 := (r->>'period_end')::timestamptz;
  if abs(extract(epoch from (e3 - (e2 + interval '30 days')))) > 1 then
    raise exception 'Pro → Premium kalan süreyi korumalı: % (önceki %)', r, e2;
  end if;
  select plan, subscription_status into pl, st from public.profiles where id = u;
  if pl <> 'premium' or st <> 'active' then raise exception 'profil premium/active olmalı: % %', pl, st; end if;

  r := public.apply_payment_refund('shopier', 'O-3', 50);
  if (r->>'applied')::boolean or r->>'reason' <> 'kismi_iade' then raise exception 'kısmi iade erişimi değiştirmemeli: %', r; end if;
  select subscription_ends_at into e4 from public.profiles where id = u;
  if e4 <> e3 then raise exception 'kısmi iade bitişi değiştirmemeli'; end if;

  r := public.apply_payment_refund('shopier', 'O-3', 200);
  if not (r->>'applied')::boolean or (r->>'revoked')::boolean then raise exception 'tam iade süreyi düşmeli: %', r; end if;
  select subscription_ends_at, subscription_status into e4, st from public.profiles where id = u;
  if abs(extract(epoch from (e4 - e2))) > 1 or st <> 'active' then
    raise exception 'iade sonrası bitiş önceki bitiş olmalı: % (beklenen %) %', e4, e2, st;
  end if;

  r := public.apply_payment_refund('shopier', 'O-3', 200);
  if not (r->>'duplicate')::boolean then raise exception 'tekrar eden iade etkisiz olmalı: %', r; end if;

  perform public.apply_payment_refund('shopier', 'O-2', 100);
  r := public.apply_payment_refund('shopier', 'O-1', 100);
  select subscription_status into st from public.profiles where id = u;
  if not (r->>'revoked')::boolean or st <> 'canceled' then raise exception 'tüm ödemeler iade → erişim kapanmalı: % %', r, st; end if;

  r := public.apply_verified_payment(u, 'pro', 'shopier', 'O-4', 100, null, 'O-4');
  if abs(extract(epoch from ((r->>'period_end')::timestamptz - (now() + interval '30 days')))) > extract(epoch from near) then
    raise exception 'kapalı üyelikten sonra yeni ödeme şimdi + 30 gün olmalı: %', r;
  end if;

  r := public.apply_payment_refund('shopier', 'YOK', 100);
  if r->>'reason' <> 'odeme_yok' then raise exception 'bilinmeyen ödeme iadesi etkisiz olmalı: %', r; end if;

  if has_function_privilege('authenticated', 'public.apply_payment_refund(text, text, numeric)', 'EXECUTE')
     or has_function_privilege('anon', 'public.apply_payment_refund(text, text, numeric)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text)', 'EXECUTE') then
    raise exception 'ödeme/iade fonksiyonları istemciye kapalı olmalı';
  end if;
end
$$;

-- 5) Deneme -------------------------------------------------------------------------------
do $$
declare
  r jsonb;
begin
  -- e-postası doğrulanmamış öğrenci
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
  r := public.start_top_plan_trial();
  if (r->>'ok')::boolean or r->>'status' <> 'blocked' then raise exception 'doğrulanmamış e-posta deneme başlatmamalı: %', r; end if;
  update auth.users set email_confirmed_at = now() where id = 'a0000000-0000-4000-8000-000000000003';
  r := public.start_top_plan_trial();
  if r->>'status' <> 'trialing' then raise exception 'doğrulanmış öğrenci deneme başlatabilmeli: %', r; end if;
  r := public.start_top_plan_trial();
  if r->>'status' <> 'trialing' or r->>'message' <> 'Deneme zaten açık.' then raise exception 'ikinci çağrı yeni deneme yazmamalı: %', r; end if;

  -- koç
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  r := public.start_top_plan_trial();
  if (r->>'ok')::boolean then raise exception 'koç deneme başlatamamalı: %', r; end if;

  -- askıdaki öğrenci
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000006', true);
  begin
    r := public.start_top_plan_trial();
    raise exception 'askıdaki hesap deneme başlatamamalı: %', r;
  exception when others then
    if sqlerrm not like '%askıda%' then raise; end if;
  end;
end
$$;

-- 6) Yönetici listeleri -------------------------------------------------------------------
do $$
declare
  n int;
  denied boolean := false;
  ov jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  select count(*) into n from public.admin_list_payments() where status = 'refunded' and refunded_at is not null;
  if n <> 3 then raise exception 'admin iade edilen 3 ödemeyi görmeli (%)', n; end if;
  select count(*) into n from public.admin_list_billing();
  if n < 1 then raise exception 'admin_list_billing boş olmamalı'; end if;
  ov := public.admin_billing_overview();
  if (ov->>'refunded')::int <> 3 then raise exception 'özet iade sayısı 3 olmalı: %', ov; end if;

  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  begin
    perform * from public.admin_list_payments();
  exception when others then denied := true;
  end;
  if not denied then raise exception 'öğrenci admin_list_payments çağıramamalı'; end if;
end
$$;

select 'OK 050_commercial_pg' as result;
rollback;
