-- CANLI UYGULAMA: 058 (paket yetkisi: Yapay Zekâ ve gelişmiş analiz yalnız Premium).
-- Önkoşul: 054 ve 055 canlıda (apply_050_055_live.sql). Tek işlem: hata olursa hiçbir değişiklik kalmaz.
-- Tekrar çalıştırmak güvenlidir. 043/054/055 tanımlarına dokunmaz.
-- SIRA: önce bu dosya, SONRA student-ai ve exam-scan edge fonksiyonları yayınlanır. Fonksiyonlar
-- caller_premium_ai yoksa isteği reddeder (fail-closed); ters sırada Premium kullanıcı da ZORRO'yu kullanamaz.

begin;

do $$
declare
  missing text := '';
begin
  if pg_catalog.to_regprocedure('public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text)') is null then missing := missing || ' 054'; end if;
  if pg_catalog.to_regprocedure('public.apply_payment_refund(text, text, numeric)') is null then missing := missing || ' 055'; end if;
  if pg_catalog.to_regprocedure('public.is_admin()') is null then missing := missing || ' is_admin'; end if;
  if pg_catalog.to_regprocedure('public.is_platform_owner()') is null then missing := missing || ' is_platform_owner'; end if;
  if to_regclass('public.profiles') is null then missing := missing || ' profiles'; end if;
  if missing <> '' then
    raise exception 'ONKOSUL_EKSIK:% — hiçbir değişiklik yapılmadı', missing;
  end if;
end
$$;

-- ===================== 058_plan_access_premium_ai.sql =====================

-- 058: Paket yetkisi veritabanında tek yerde. 043 ve 054 değiştirilmez; ödeme yazımı aynı kalır.
--
--   none    → üyelik yok
--   trial   → temel e-koçluk (Yapay Zekâ ve gelişmiş analiz yok)
--   pro     → temel e-koçluk
--   premium → temel e-koçluk + Yapay Zekâ (ZORRO) + gelişmiş analiz
--   staff   → yönetici / platform sahibi
--
-- Eşleri: src/lib/planAccess.ts (arayüz), supabase/functions/_shared/planAccess.ts (edge).
-- Plan yalnız profiles kolonlarından okunur; bu kolonları istemci yazamaz (protect_plan, 041),
-- ödemede yalnız apply_verified_payment (054) yazar. Fonksiyonlar parametre almaz: başkasının
-- katmanı sorgulanamaz. Satır verisi değişmez, tablo silinmez. Tekrar çalıştırılabilir.

create or replace function public.caller_access_tier()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  now_ts timestamptz := pg_catalog.now();
  v_role text;
  v_status text;
  v_plan text;
  v_sub text;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_sub_end timestamptz;
begin
  if uid is null then
    return 'none';
  end if;
  if public.is_admin() or public.is_platform_owner() then
    return 'staff';
  end if;

  select p.role, p.account_status, p.plan, p.subscription_status,
         p.trial_started_at, p.trial_ends_at, p.subscription_ends_at
    into v_role, v_status, v_plan, v_sub, v_trial_start, v_trial_end, v_sub_end
    from public.profiles p
   where p.id = uid;
  if not found then
    return 'none';
  end if;

  -- Koç öğrenci paketi değildir; admin rolü is_admin ile yukarıda karşılanır.
  if v_role in ('coach', 'admin') then
    return 'none';
  end if;
  if v_status is distinct from 'active' then
    return 'none';
  end if;

  if v_sub = 'trialing' then
    if v_trial_end is not null and v_trial_end > now_ts
       and (v_trial_start is null or v_trial_start <= now_ts) then
      return 'trial';
    end if;
    return 'none';
  end if;

  if v_sub = 'active' then
    if v_sub_end is not null and v_sub_end <= now_ts then
      return 'none';
    end if;
    -- normalizePlanId ile aynı: 'premium' → premium; eski webhook 'Pro' (400 TL) → premium; 'pro'/'go' → pro.
    if pg_catalog.lower(pg_catalog.btrim(coalesce(v_plan, ''))) = 'premium'
       or pg_catalog.btrim(coalesce(v_plan, '')) = 'Pro' then
      return 'premium';
    end if;
    if pg_catalog.lower(pg_catalog.btrim(coalesce(v_plan, ''))) in ('pro', 'go') then
      return 'pro';
    end if;
    return 'none';
  end if;

  return 'none';
end;
$$;

create or replace function public.caller_premium_ai()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.caller_access_tier() in ('premium', 'staff');
$$;

revoke all on function public.caller_access_tier() from public, anon;
revoke all on function public.caller_premium_ai() from public, anon;
grant execute on function public.caller_access_tier() to authenticated;
grant execute on function public.caller_premium_ai() to authenticated;

comment on function public.caller_access_tier() is
  'Çağıranın paket katmanı: none | trial | pro | premium | staff. src/lib/planAccess.ts ile aynı tablo.';
comment on function public.caller_premium_ai() is
  'Yapay Zekâ (ZORRO) ve gelişmiş analiz yetkisi: yalnız aktif Premium ve yönetici.';

-- ZORRO sohbet geçmişine yeni kayıt yalnız Premium yazar. Mevcut (isimleri ortama göre değişebilen)
-- izin politikalarına dokunulmaz: RESTRICTIVE politika onlarla AND'lenir. Okuma, başlık güncelleme ve
-- silme değişmez; Premium'dan Pro'ya düşen öğrenci eski geçmişini görür ve silebilir.
-- Tablo bu ortamda yoksa atlanır.
do $$
begin
  if pg_catalog.to_regclass('public.zorro_conversations') is not null then
    execute 'drop policy if exists zorro_conversations_premium_insert on public.zorro_conversations';
    execute 'create policy zorro_conversations_premium_insert on public.zorro_conversations
               as restrictive for insert to authenticated, anon
               with check (public.caller_premium_ai())';
  end if;
  if pg_catalog.to_regclass('public.zorro_messages') is not null then
    execute 'drop policy if exists zorro_messages_premium_insert on public.zorro_messages';
    execute 'create policy zorro_messages_premium_insert on public.zorro_messages
               as restrictive for insert to authenticated, anon
               with check (public.caller_premium_ai())';
  end if;
end
$$;


do $$
begin
  if pg_catalog.to_regprocedure('public.caller_access_tier()') is null
     or pg_catalog.to_regprocedure('public.caller_premium_ai()') is null then
    raise exception 'SON_KONTROL_BASARISIZ — geri alınıyor';
  end if;
end
$$;

commit;

select 'CANLI_058_OK' as sonuc;
