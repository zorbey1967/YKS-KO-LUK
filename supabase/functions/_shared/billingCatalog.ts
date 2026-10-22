/** src/lib/plans.ts ile aynı tutarlar. Checkout/webhook istemci fiyatını kabul etmez. */

export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = "TRY";
export type PlanId = "pro" | "premium";

export const CAMPAIGN = {
  active: true as boolean,
  endsAt: null as string | null,
};

const PLANS: Record<PlanId, { listPriceTry: number; campaignPriceTry: number }> = {
  pro: { listPriceTry: 200, campaignPriceTry: 100 },
  premium: { listPriceTry: 400, campaignPriceTry: 200 },
};

/** Eski Go → pro. Eski webhook 'Pro' (400 TL) → premium. Yeni 'pro' → pro. */
export function normalizePlanId(raw: unknown): PlanId | null {
  const orig = String(raw || "").trim();
  const s = orig.toLowerCase();
  if (s === "premium") return "premium";
  if (s === "go") return "pro";
  if (orig === "Pro") return "premium";
  if (s === "pro") return "pro";
  return null;
}

export function chargeAmountTry(plan: PlanId): number {
  const p = PLANS[plan];
  return CAMPAIGN.active ? p.campaignPriceTry : p.listPriceTry;
}

export function amountsMatch(plan: PlanId, amountRaw: unknown): boolean {
  const n = Number(amountRaw);
  if (!Number.isFinite(n)) return false;
  return Math.abs(n - chargeAmountTry(plan)) < 0.009;
}

/**
 * Oturum tutarı bu planın katalog fiyatlarından biri mi (kampanya veya liste)?
 * Ödeme oturumunu yalnız sunucu yazar ve tutarı o anki katalogdan alır (billing-checkout). Kampanya
 * ödeme linki açıkken kapanırsa / açılırsa ödenmiş sipariş reddedilmesin diye iki katalog fiyatı da geçerli.
 * Başka planın fiyatı veya katalog dışı tutar kabul edilmez (ör. Premium için 100 TL).
 */
export function isCatalogPriceTry(plan: PlanId, amountRaw: unknown): boolean {
  const n = Number(amountRaw);
  if (!Number.isFinite(n) || n <= 0) return false;
  const p = PLANS[plan];
  return Math.abs(n - p.campaignPriceTry) < 0.009 || Math.abs(n - p.listPriceTry) < 0.009;
}
