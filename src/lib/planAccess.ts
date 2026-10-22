/**
 * Paket yetkisi: TEK KAYNAK.
 *
 *   none    → üyelik yok: yalnız hesap, üyelik, koç listesi, kütüphane (mevcut kapı)
 *   trial   → 14 günlük deneme: tüm özellikler (Premium ile aynı; 060)
 *   pro     → temel e-koçluk
 *   premium → temel e-koçluk + Yapay Zekâ (ZORRO) + gelişmiş analiz
 *   staff   → yönetici / platform sahibi (hepsi)
 *
 * Sunucu eşleri — üçü de aynı tabloyu uygular, testler eşitliği denetler:
 *   supabase/functions/_shared/planAccess.ts            (student-ai, exam-scan)
 *   supabase/migrations/058_plan_access_premium_ai.sql  (caller_access_tier, caller_premium_ai, RLS)
 *   supabase/migrations/060_trial_full_access.sql       (caller_premium_ai: deneme de dahil)
 * Bu dosya yalnızca arayüzün neyi göstereceğini seçer; yetki sunucuda verilir.
 */

export type AccessTier = 'none' | 'trial' | 'pro' | 'premium' | 'staff';
export type Capability = 'core' | 'ai' | 'advanced_analytics';

export const TIER_CAPABILITIES: Record<AccessTier, readonly Capability[]> = {
  none: [],
  trial: ['core', 'ai', 'advanced_analytics'],
  pro: ['core'],
  premium: ['core', 'ai', 'advanced_analytics'],
  staff: ['core', 'ai', 'advanced_analytics'],
};

export function tierCan(tier: AccessTier, cap: Capability): boolean {
  return TIER_CAPABILITIES[tier].includes(cap);
}

/** Paket sayfasında gösterilen özellikler (pazarlama metni yetki değildir). */
export const PRO_FEATURE_LIST = [
  'Ders programı',
  'Takvim ve sınav tarihleri',
  'Hedefler',
  'Görevler ve ödevler',
  'Çalışma Saati ve çalışma takibi',
  'Denemeler ve sınav takibi',
  'Öğrenci merkezi ve Sessiz Kütüphane',
  'Koç randevusu, koç programı ve ödevler',
] as const;

export const PREMIUM_FEATURE_LIST = [
  'Pro’daki her şey',
  'Yapay Zekâ: ZORRO',
  'Gelişmiş analiz',
  'Yapay zekâ destekli çalışma değerlendirmesi',
  'Yapay zekâ destekli öneriler, günlük plan ve program',
] as const;
