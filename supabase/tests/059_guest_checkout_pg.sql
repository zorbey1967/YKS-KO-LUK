-- Throwaway prova testi (059 hesapsız ödeme). ROLLBACK; veri kalıcı değil.
-- Önkoşul: ... → 055 → 058 → 059 (iki kez).
begin;

-- 0) İstemci erişimi yok -----------------------------------------------------------------------
do $$
begin
  if has_table_privilege('anon', 'public.billing_guest_checkouts', 'SELECT')
     or has_table_privilege('authenticated', 'public.billing_guest_checkouts', 'SELECT')
     or has_table_privilege('authenticated', 'public.billing_guest_checkouts', 'INSERT')
     or has_table_privilege('authenticated', 'public.billing_guest_checkouts', 'UPDATE') then
    raise exception 'misafir ödeme tablosu istemciye kapalı olmalı';
  end if;
  if has_function_privilege('anon', 'public.guest_checkout_attach(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guest_checkout_attach(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'guest_checkout_attach istemciye kapalı olmalı';
  end if;
  if not exists (select 1 from pg_class where relname = 'billing_guest_checkouts' and relrowsecurity and relforcerowsecurity) then
    raise exception 'RLS açık ve zorunlu olmalı';
  end if;
end
$$;

-- 1) Doğrulanmış ödeme: hesap (Auth tetikleyicisi) + oturum + paket ---------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('c5900000-0000-4000-8000-000000000001', 'rk-11111111-1111-4111-8111-111111111111@misafir.rubikkocluk.invalid', now(), '{"intent":"student","source":"shopier_guest"}'),
 ('c5900000-0000-4000-8000-000000000002', 'baska59@example.com', now(), '{}');

do $$
declare
  u uuid := 'c5900000-0000-4000-8000-000000000001';
  other uuid := 'c5900000-0000-4000-8000-000000000002';
  g uuid := '11111111-1111-4111-8111-111111111111';
  sid uuid;
  sid2 uuid;
  r jsonb;
  pl text;
  st text;
  acc text;
  e1 timestamptz;
  e2 timestamptz;
  n int;
begin
  select account_status, role into acc, st from public.profiles where id = u;
  if acc is distinct from 'active' or st is distinct from 'student' then
    raise exception 'otomatik açılan hesap aktif öğrenci olmalı: % %', acc, st;
  end if;

  insert into public.billing_guest_checkouts (id, plan_id, amount_try, status, provider, provider_session_id, claim_token_hash)
  values (g, 'pro', 100, 'redirected', 'shopier', 'prodG59', repeat('a', 64));

  sid := public.guest_checkout_attach(g, u, 'ordG59');
  sid2 := public.guest_checkout_attach(g, u, 'ordG59');
  if sid is null or sid is distinct from sid2 then raise exception 'tekrar çağrı aynı oturumu dönmeli: % %', sid, sid2; end if;
  select count(*) into n from public.billing_checkout_sessions where provider = 'shopier' and provider_session_id = 'prodG59';
  if n <> 1 then raise exception 'tek ödeme oturumu olmalı (%)', n; end if;
  if (select user_id from public.billing_checkout_sessions where id = sid) is distinct from u then
    raise exception 'oturum doğru öğrenciye ait olmalı';
  end if;

  begin
    perform public.guest_checkout_attach(g, other, 'ordG59');
    raise exception 'başka öğrenciye bağlanmamalı';
  exception when others then
    if sqlerrm not like '%kullanici_uyusmuyor%' then raise; end if;
  end;
  begin
    perform public.guest_checkout_attach(g, u, 'baska-siparis');
    raise exception 'başka sipariş bağlanmamalı';
  exception when others then
    if sqlerrm not like '%siparis_uyusmuyor%' then raise; end if;
  end;

  r := public.apply_verified_payment(u, 'pro', 'shopier', 'ordG59', 100, sid, 'ordG59');
  select plan, subscription_status, subscription_ends_at into pl, st, e1 from public.profiles where id = u;
  if pl <> 'pro' or st <> 'active' then raise exception 'paket anında tanımlanmalı: % % %', pl, st, r; end if;

  r := public.apply_verified_payment(u, 'pro', 'shopier', 'ordG59', 100, sid, 'ordG59');
  select subscription_ends_at into e2 from public.profiles where id = u;
  if not (r->>'duplicate_payment')::boolean or e2 is distinct from e1 then
    raise exception 'aynı sipariş ikinci paket/süre yazmamalı: %', r;
  end if;
  select count(*) into n from public.billing_payments where provider = 'shopier' and provider_payment_id = 'ordG59';
  if n <> 1 then raise exception 'tek ödeme kaydı olmalı (%)', n; end if;

  -- Tutarı farklı oturumla ödeme reddedilir (054 tutar kontrolü)
  begin
    perform public.apply_verified_payment(u, 'pro', 'shopier', 'ordG59-b', 50, sid, 'ordG59-b');
    raise exception 'oturum tutarından farklı ödeme kabul edilmemeli';
  exception when others then
    if sqlerrm not like '%tutar_uyusmuyor%' then raise; end if;
  end;
end
$$;

-- 2) Öğrenci kendi oturumuyla tabloyu göremez ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c5900000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c5900000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.billing_guest_checkouts limit 1;
    raise exception 'öğrenci misafir ödeme tablosunu okuyamamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.guest_checkout_attach('11111111-1111-4111-8111-111111111111', 'c5900000-0000-4000-8000-000000000001', 'x');
    raise exception 'öğrenci bağlama fonksiyonunu çağıramamalı';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

select 'OK 059_guest_checkout_pg' as result;
rollback;
