-- Throwaway prova testi (060 deneme = tüm özellikler, 061 yeni Google kaydı kapalı). ROLLBACK; veri kalıcı değil.
-- Önkoşul (scripts/run-pg-commercial.mjs): ... → 058 → 059 → 060 → 061 (058/059 testleri 060'tan ÖNCE koşar).
-- Sınar: aktif deneme Yapay Zekâya erişir; süresi biten deneme ve üyeliksiz erişemez; katman tablosu değişmez;
-- Google ile ilk kez gelen kullanıcı eklenmez; e-posta kaydı ve eski (sağlayıcısız) kayıt etkilenmez.
begin;

do $$
begin
  if pg_catalog.to_regprocedure('public.block_new_google_signup()') is null then raise exception '061 yok'; end if;
  if position('''trial''' in pg_catalog.pg_get_functiondef('public.caller_premium_ai()'::regprocedure)) = 0 then
    raise exception '060 yok: caller_premium_ai deneme içermiyor';
  end if;
end
$$;

-- Gerçek Supabase'de bu kolon var; yerel prova şemasında eklenir.
alter table auth.users add column if not exists raw_app_meta_data jsonb not null default '{}'::jsonb;

select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
 ('c6000000-0000-4000-8000-000000000001', 'trial60@example.com', now(), '{"name":"Deneme Öğrenci"}', '{"provider":"email","providers":["email"]}'),
 ('c6000000-0000-4000-8000-000000000002', 'expired60@example.com', now(), '{"name":"Bitmiş Deneme"}', '{"provider":"email","providers":["email"]}'),
 ('c6000000-0000-4000-8000-000000000003', 'free60@example.com', now(), '{"name":"Üyeliksiz Öğrenci"}', '{"provider":"email","providers":["email"]}');
update public.profiles set role = 'student', account_status = 'active'
 where id in ('c6000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000003');
update public.profiles
   set subscription_status = 'trialing', trial_started_at = now() - interval '1 day', trial_ends_at = now() + interval '13 days'
 where id = 'c6000000-0000-4000-8000-000000000001';
update public.profiles
   set subscription_status = 'trialing', trial_started_at = now() - interval '15 days', trial_ends_at = now() - interval '1 day'
 where id = 'c6000000-0000-4000-8000-000000000002';

-- 1) Aktif deneme: katman trial, Yapay Zekâ açık ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'trial' then raise exception 'aktif deneme trial olmalı: %', public.caller_access_tier(); end if;
  if not public.caller_premium_ai() then raise exception 'aktif deneme Yapay Zekâya erişmeli (060)'; end if;
  if pg_catalog.to_regclass('public.zorro_conversations') is not null then
    execute $q$insert into public.zorro_conversations (user_id, title) values ('c6000000-0000-4000-8000-000000000001', 'deneme')$q$;
  end if;
end
$$;
reset role;

-- 2) Süresi biten deneme ve üyeliksiz: Yapay Zekâ kapalı -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' then raise exception 'süresi biten deneme none olmalı: %', public.caller_access_tier(); end if;
  if public.caller_premium_ai() then raise exception 'süresi biten deneme Yapay Zekâya erişmemeli'; end if;
end
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"c6000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if public.caller_premium_ai() then raise exception 'üyeliksiz Yapay Zekâya erişmemeli'; end if;
end
$$;
reset role;

-- 3) 061: Google ile ilk kez gelen kullanıcı eklenmez ---------------------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
    values ('c6000000-0000-4000-8000-000000000010', 'yeni-google60@example.com', now(), '{"provider":"google","providers":["google"]}');
    raise exception 'GOOGLE_KABUL_EDILDI';
  exception when others then
    if sqlerrm not like 'GOOGLE_KAYIT_YOK%' then raise; end if;
  end;
  if exists (select 1 from auth.users where email = 'yeni-google60@example.com') then
    raise exception 'Google kullanıcısı oluşmamalıydı';
  end if;
  if exists (select 1 from public.profiles where email = 'yeni-google60@example.com') then
    raise exception 'Google kullanıcısı için profil oluşmamalıydı';
  end if;
end
$$;

-- 4) E-posta kaydı ve sunucu hesabı (provider email) ile sağlayıcısız eski kayıt etkilenmez --------
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data) values
 ('c6000000-0000-4000-8000-000000000011', 'eposta60@example.com', now(), '{"provider":"email","providers":["email"]}');
insert into auth.users (id, email) values ('c6000000-0000-4000-8000-000000000012', 'metasiz60@example.com');
do $$
begin
  if not exists (select 1 from public.profiles where email = 'eposta60@example.com') then
    raise exception 'e-posta kaydı profil oluşturmalı';
  end if;
  if not exists (select 1 from auth.users where email = 'metasiz60@example.com') then
    raise exception 'sağlayıcısız kayıt eklenebilmeli';
  end if;
end
$$;

select 'OK 060_061_pg' as result;
rollback;
