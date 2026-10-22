-- Throwaway prova testi (058 paket yetkisi). ROLLBACK; veri kalıcı değil. Üretim/staging URL kullanmayın.
-- Önkoşul (scripts/run-pg-commercial.mjs): ... → 054 → 055 → 058 (iki kez).
-- Sınar: Shopier Pro/Premium ödemesi doğru üyeliği açar, tekrar eden ödeme bozmaz, istemci plan yazamaz,
-- caller_access_tier / caller_premium_ai katmanları, ZORRO yazma kapısı, 043/054 tanımları değişmedi.
begin;

-- 0) Katalog ---------------------------------------------------------------------------------
do $$
declare
  n int;
begin
  if has_function_privilege('anon', 'public.caller_access_tier()', 'EXECUTE')
     or has_function_privilege('anon', 'public.caller_premium_ai()', 'EXECUTE') then
    raise exception 'anon katman fonksiyonlarını çağıramamalı';
  end if;
  if not has_function_privilege('authenticated', 'public.caller_premium_ai()', 'EXECUTE') then
    raise exception 'authenticated caller_premium_ai çağırabilmeli';
  end if;
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('caller_access_tier', 'caller_premium_ai')
     and p.prosecdef
     and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""');
  if n <> 2 then raise exception 'katman fonksiyonları security definer + search_path sabit olmalı (%)', n; end if;
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'caller_access_tier' and p.pronargs <> 0;
  if n <> 0 then raise exception 'caller_access_tier parametre almamalı (başkasının katmanı sorgulanamaz)'; end if;
  -- 054 tanımı yerinde: tekrar ödeme / gecikmiş ödeme dalları
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'apply_verified_payment'
     and p.prosrc like '%duplicate_payment%' and p.prosrc like '%late_payment%';
  if n <> 1 then raise exception 'apply_verified_payment (054) değişmemeli'; end if;
end
$$;

-- 0b) İstemcinin çağırabildiği ve üyelik/plan yazan fonksiyon yalnız bilinen ikisi olmalı ----------
do $$
declare
  extra text;
begin
  select string_agg(p.proname, ', ') into extra
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and pg_catalog.format_type(p.prorettype, null) <> 'trigger'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.prosrc ~* '(subscription_status|subscription_ends_at|trial_ends_at|billing_subscriptions|billing_payments|plan_id|\mplan\M\s*=)'
     and p.prosrc ~* '\m(update|insert)\M'
     and p.proname not in ('admin_review_student', 'start_top_plan_trial');
  if extra is not null then raise exception 'istemciye açık üyelik yazan fonksiyon: %', extra; end if;
end
$$;

-- 1) Kullanıcılar (migration çalıştırıcısı gibi; auth.uid() boş) -------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('b0000000-0000-4000-8000-000000000001', 'pro58@example.com', now(), '{"name":"Pro Öğrenci"}'),
 ('b0000000-0000-4000-8000-000000000002', 'premium58@example.com', now(), '{"name":"Premium Öğrenci"}'),
 ('b0000000-0000-4000-8000-000000000003', 'trial58@example.com', now(), '{"name":"Deneme Öğrenci"}'),
 ('b0000000-0000-4000-8000-000000000004', 'free58@example.com', now(), '{"name":"Üyeliksiz Öğrenci"}');
update public.profiles set role = 'student', account_status = 'active'
 where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
              'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004');
update public.profiles
   set subscription_status = 'trialing', trial_started_at = now() - interval '1 day', trial_ends_at = now() + interval '13 days'
 where id = 'b0000000-0000-4000-8000-000000000003';

-- 2) Shopier ödemesi (webhook ile aynı çağrı: plan sunucudaki ödeme oturumundan gelir) ------------
create temp table t58 (k text primary key, v text) on commit drop;
grant all on t58 to authenticated;
do $$
declare
  p uuid := 'b0000000-0000-4000-8000-000000000001';
  m uuid := 'b0000000-0000-4000-8000-000000000002';
  s_pro uuid;
  s_prem uuid;
  r jsonb;
  pl text;
  st text;
  e1 timestamptz;
  e2 timestamptz;
begin
  insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, status, provider)
    values (p, 'pro', 100, 'pending', 'shopier') returning id into s_pro;
  insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, status, provider)
    values (m, 'premium', 200, 'pending', 'shopier') returning id into s_prem;

  -- 9) Pro ödeme → Pro üyelik
  r := public.apply_verified_payment(p, 'pro', 'shopier', 'S58-PRO', 100, s_pro, 'S58-PRO');
  select plan, subscription_status into pl, st from public.profiles where id = p;
  if pl <> 'pro' or st <> 'active' then raise exception 'Pro ödeme Pro açmalı: % % %', pl, st, r; end if;

  -- 10) Premium ödeme → Premium üyelik
  r := public.apply_verified_payment(m, 'premium', 'shopier', 'S58-PREM', 200, s_prem, 'S58-PREM');
  select plan, subscription_status, subscription_ends_at into pl, st, e1 from public.profiles where id = m;
  if pl <> 'premium' or st <> 'active' then raise exception 'Premium ödeme Premium açmalı: % % %', pl, st, r; end if;

  -- 11) Aynı Premium bildirimi tekrar gelir: duplicate, süre ve plan değişmez
  r := public.apply_verified_payment(m, 'premium', 'shopier', 'S58-PREM', 200, s_prem, 'S58-PREM');
  select plan, subscription_ends_at into pl, e2 from public.profiles where id = m;
  if not (r->>'duplicate_payment')::boolean or pl <> 'premium' or e2 is distinct from e1 then
    raise exception 'tekrar eden ödeme üyeliği değiştirmemeli: % % % → %', r, pl, e1, e2;
  end if;

  -- Yenileme: aktif Premium'a yeni Premium ödemesi kalan süreyi korur (greatest(bitiş, now) + 30 gün)
  insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, status, provider)
    values (m, 'premium', 200, 'pending', 'shopier') returning id into s_prem;
  r := public.apply_verified_payment(m, 'premium', 'shopier', 'S58-PREM2', 200, s_prem, 'S58-PREM2');
  select plan, subscription_ends_at into pl, e2 from public.profiles where id = m;
  if pl <> 'premium' or abs(extract(epoch from (e2 - (e1 + interval '30 days')))) > 1 then
    raise exception 'Premium yenileme kalan süreyi korumalı: % → % (%)', e1, e2, r;
  end if;
  -- Aynı yenileme bildirimi tekrar: değişiklik yok
  r := public.apply_verified_payment(m, 'premium', 'shopier', 'S58-PREM2', 200, s_prem, 'S58-PREM2');
  select subscription_ends_at into e1 from public.profiles where id = m;
  if not (r->>'duplicate_payment')::boolean or e1 is distinct from e2 then
    raise exception 'tekrar eden yenileme süreyi değiştirmemeli: %', r;
  end if;
  if (select count(*) from public.billing_payments where provider = 'shopier' and provider_payment_id like 'S58-PREM%') <> 2 then
    raise exception 'tekrar eden bildirim ikinci ödeme kaydı açmamalı';
  end if;

  -- 11b) Pro ödemesinin kimliği 'premium' plan adıyla yeniden gelse bile Pro kalır (yükseltme yok)
  select subscription_ends_at into e1 from public.profiles where id = p;
  r := public.apply_verified_payment(p, 'premium', 'shopier', 'S58-PRO', 100, s_pro, 'S58-PRO');
  select plan, subscription_ends_at into pl, e2 from public.profiles where id = p;
  if not (r->>'duplicate_payment')::boolean or pl <> 'pro' or e2 is distinct from e1 then
    raise exception 'tekrar eden Pro ödemesi Premium açmamalı: % % % → %', r, pl, e1, e2;
  end if;

  -- Farklı kullanıcının ödeme oturumu ile ödeme işlenemez
  begin
    perform public.apply_verified_payment(p, 'premium', 'shopier', 'S58-X', 200, s_prem, 'S58-X');
    raise exception 'başkasının oturumu kabul edilmemeli';
  exception when others then
    if sqlerrm not like '%siparis_uyusmuyor%' then raise; end if;
  end;
end
$$;

-- 3) Katmanlar: her kullanıcı kendi oturumuyla ---------------------------------------------------
-- Pro
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'pro' then raise exception 'Pro katmanı pro olmalı: %', public.caller_access_tier(); end if;
  if public.caller_premium_ai() then raise exception 'Pro yapay zekâya erişmemeli'; end if;
  -- 7) İstemciden plan yazarak Premium olunamaz
  begin
    update public.profiles set plan = 'premium' where id = 'b0000000-0000-4000-8000-000000000001';
    raise exception 'öğrenci plan yazamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set subscription_status = 'active', subscription_ends_at = null
     where id = 'b0000000-0000-4000-8000-000000000001';
    raise exception 'öğrenci üyelik kolonu yazamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, status, provider)
      values ('b0000000-0000-4000-8000-000000000001', 'premium', 100, 'pending', 'shopier');
    raise exception 'öğrenci ödeme oturumu yazamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.apply_verified_payment('b0000000-0000-4000-8000-000000000001', 'premium', 'shopier', 'S58-SELF', 200, null, 'S58-SELF');
    raise exception 'öğrenci ödeme fonksiyonunu çağıramamalı';
  exception when insufficient_privilege then null;
  end;
  if public.caller_access_tier() <> 'pro' then raise exception 'denemelerden sonra Pro kalmalı'; end if;
  -- 1) Temel özellik: kendi hedefini güncelleyebilir
  update public.profiles set target_rank = 1234 where id = 'b0000000-0000-4000-8000-000000000001';
  if not found then raise exception 'Pro temel profil işlemini yapabilmeli'; end if;
  -- 2) ZORRO geçmişine yeni kayıt yazamaz (tablo varsa)
  if pg_catalog.to_regclass('public.zorro_conversations') is not null then
    begin
      execute $q$insert into public.zorro_conversations (user_id, title) values ('b0000000-0000-4000-8000-000000000001', 'x')$q$;
      raise exception 'Pro ZORRO sohbeti açamamalı';
    exception when insufficient_privilege then null;
    end;
    insert into t58 values ('zorro', 'var') on conflict do nothing;
  end if;
end
$$;
reset role;

-- Premium
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'premium' then raise exception 'Premium katmanı premium olmalı: %', public.caller_access_tier(); end if;
  if not public.caller_premium_ai() then raise exception 'Premium yapay zekâya erişmeli'; end if;
  update public.profiles set target_rank = 4321 where id = 'b0000000-0000-4000-8000-000000000002';
  if not found then raise exception 'Premium temel profil işlemini yapabilmeli'; end if;
  if pg_catalog.to_regclass('public.zorro_conversations') is not null then
    execute $q$insert into public.zorro_conversations (user_id, title) values ('b0000000-0000-4000-8000-000000000002', 'ilk')$q$;
  end if;
end
$$;
reset role;

-- Deneme (temel erişim; yapay zekâ yok)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'trial' then raise exception 'deneme katmanı trial olmalı: %', public.caller_access_tier(); end if;
  if public.caller_premium_ai() then raise exception 'deneme yapay zekâya erişmemeli'; end if;
end
$$;
reset role;

-- Deneme RPC'si öğrenciyi Premium yapmaz (yalnız deneme = temel erişim)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare
  r jsonb;
begin
  if pg_catalog.to_regprocedure('public.start_top_plan_trial()') is not null then
    execute 'select public.start_top_plan_trial()' into r;
    if public.caller_access_tier() not in ('trial', 'none') or public.caller_premium_ai() then
      raise exception 'deneme RPC yapay zekâ açmamalı: % %', public.caller_access_tier(), r;
    end if;
    insert into t58 values ('trial_rpc', public.caller_access_tier()) on conflict do nothing;
  end if;
end
$$;
reset role;
-- deneme sonrası sınamalar için üyeliksiz hâle geri al (migration çalıştırıcısı)
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set subscription_status = 'none', trial_started_at = null, trial_ends_at = null
 where id = 'b0000000-0000-4000-8000-000000000004';

-- Üyeliksiz
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' then raise exception 'üyeliksiz none olmalı: %', public.caller_access_tier(); end if;
  if public.caller_premium_ai() then raise exception 'üyeliksiz yapay zekâya erişmemeli'; end if;
end
$$;
reset role;

-- Koç (öğrenci paketi değil) ve sahip (staff)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' then raise exception 'koç öğrenci yapay zekâ katmanı almamalı: %', public.caller_access_tier(); end if;
end
$$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'staff' or not public.caller_premium_ai() then
    raise exception 'sahip staff olmalı: %', public.caller_access_tier();
  end if;
end
$$;
reset role;

-- 4) Süre ve eski plan adları (migration çalıştırıcısı olarak profili değiştir, öğrenci olarak sor) ------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set subscription_ends_at = now() - interval '1 minute' where id = 'b0000000-0000-4000-8000-000000000002';
update public.profiles set plan = 'Pro' where id = 'b0000000-0000-4000-8000-000000000001';
update public.profiles set trial_ends_at = now() - interval '1 minute' where id = 'b0000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' or public.caller_premium_ai() then raise exception 'süresi biten Premium kapanmalı'; end if;
  if pg_catalog.to_regclass('public.zorro_conversations') is not null then
    begin
      execute $q$insert into public.zorro_conversations (user_id, title) values ('b0000000-0000-4000-8000-000000000002', 'iki')$q$;
      raise exception 'süresi biten Premium ZORRO yazamamalı';
    exception when insufficient_privilege then null;
    end;
    -- Eski geçmiş okunur
    if (select count(*) from public.zorro_conversations) <> 1 then raise exception 'eski ZORRO geçmişi okunabilmeli'; end if;
  end if;
end
$$;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  -- normalizePlanId: eski webhook 'Pro' (400 TL) → premium
  if public.caller_access_tier() <> 'premium' then raise exception 'eski ''Pro'' kaydı premium sayılmalı: %', public.caller_access_tier(); end if;
end
$$;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' then raise exception 'süresi biten deneme none olmalı'; end if;
end
$$;
reset role;

select 'OK 058_plan_access_pg' || case when exists (select 1 from t58 where k = 'zorro') then ' (zorro_rls)' else '' end as result;
rollback;
