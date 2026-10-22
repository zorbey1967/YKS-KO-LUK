-- 060: 14 günlük deneme süresince tüm özellikler açık (Yapay Zekâ / ZORRO ve gelişmiş analiz dahil).
--
-- 058'deki katman tablosu değişmez (caller_access_tier aynı kalır); yalnız Yapay Zekâ yetkisi
-- (caller_premium_ai) artık aktif denemeyi de kapsar. ZORRO kayıt politikaları (058) bu fonksiyonu
-- kullandığından ayrıca değişmez. Ödeme, deneme başlatma ve plan yazımı değişmez.
-- Eşler: src/lib/planAccess.ts ve supabase/functions/_shared/planAccess.ts (trial = tüm yetenekler).

create or replace function public.caller_premium_ai()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.caller_access_tier() in ('premium', 'staff', 'trial');
$$;

revoke all on function public.caller_premium_ai() from public, anon;
grant execute on function public.caller_premium_ai() to authenticated;

comment on function public.caller_premium_ai() is
  'Yapay Zekâ (ZORRO) ve gelişmiş analiz yetkisi: aktif Premium, aktif 14 günlük deneme ve yönetici.';
