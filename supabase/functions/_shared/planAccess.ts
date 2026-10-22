/**
 * Sunucu paket yetkisi. src/lib/planAccess.ts ile aynı tablo (planAccessContract testi eşitliği denetler).
 *
 *   none    → üyelik yok
 *   trial   → 14 günlük deneme: tüm özellikler (Premium ile aynı; 060)
 *   pro     → temel e-koçluk
 *   premium → temel e-koçluk + Yapay Zekâ (ZORRO) + gelişmiş analiz
 *   staff   → yönetici / platform sahibi
 *
 * Plan yalnız profiles kolonlarından okunur. Bu kolonları istemci yazamaz (protect_plan tetikleyicisi);
 * ödeme ile yalnız apply_verified_payment (054) yazar. İstek gövdesindeki plan hiçbir zaman okunmaz.
 * Veritabanı eşi: public.caller_access_tier() / public.caller_premium_ai() (058; deneme 060 ile dahil).
 */
import { billingOk, type BillingGate } from "./billingEntitled.ts";

export type AccessTier = "none" | "trial" | "pro" | "premium" | "staff";
export type Capability = "core" | "ai" | "advanced_analytics";

export const TIER_CAPABILITIES: Record<AccessTier, readonly Capability[]> = {
  none: [],
  trial: ["core", "ai", "advanced_analytics"],
  pro: ["core"],
  premium: ["core", "ai", "advanced_analytics"],
  staff: ["core", "ai", "advanced_analytics"],
};

export function tierCan(tier: AccessTier, cap: Capability): boolean {
  return TIER_CAPABILITIES[tier].includes(cap);
}

/** Koç öğrenci paketi değildir → none (öğrenci yapay zekâ uçları koça kapalı). Belirsiz şema → none. */
export function accessTierFromBilling(b: BillingGate, privileged: boolean, now = Date.now()): AccessTier {
  if (privileged) return "staff";
  if (b.role === "coach" || b.role === "admin") return "none";
  const r = billingOk(b, now);
  if (!r.entitled) return "none";
  if (r.tier === "premium" || r.tier === "pro" || r.tier === "trial") return r.tier;
  return "none";
}

/**
 * Yapay zekâ isteği kararı. Edge yerel hesap VE veritabanı RPC'si (caller_premium_ai) birlikte evet demeli.
 * RPC hata verirse (058 yoksa, ağ) istek reddedilir: fail-closed.
 */
export function premiumAiDecision(input: {
  tier: AccessTier;
  rpcOk: boolean;
  rpcValue: unknown;
}): { allow: true } | { allow: false; status: 402 | 503; error: string } {
  if (!tierCan(input.tier, "ai")) {
    return { allow: false, status: 402, error: "Yapay Zekâ (ZORRO) ve gelişmiş analiz Premium üyelikte açılır." };
  }
  if (!input.rpcOk) {
    return { allow: false, status: 503, error: "Premium yetkisi doğrulanamadı. İstek reddedildi." };
  }
  if (input.rpcValue !== true) {
    return { allow: false, status: 402, error: "Yapay Zekâ (ZORRO) ve gelişmiş analiz Premium üyelikte açılır." };
  }
  return { allow: true };
}
