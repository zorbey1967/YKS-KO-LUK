/** Tek kaynak: paket, liste/kampanya fiyatı, deneme. İstemci tutarı güvenilir değildir. */

import { PREMIUM_FEATURE_LIST, PRO_FEATURE_LIST, type Capability } from './planAccess';

export const TRIAL_DAYS = 14;
export const BILLING_CURRENCY = 'TRY';
export const BILLING_PERIOD = 'month' as const;

export type PlanId = 'pro' | 'premium';
export type FeatureId =
  | 'core_study'
  | 'zorro_basic'
  | 'zorro_advanced'
  | 'ai_plan'
  | 'analytics'
  | 'appointments';

export type PlanDef = {
  id: PlanId;
  name: string;
  /** Kampanya kapalıyken / kampanya bitince yeni ödemelerde. */
  listPriceTry: number;
  /** Kampanya açıkken sunucunun çekeceği tutar. */
  campaignPriceTry: number;
  currency: typeof BILLING_CURRENCY;
  period: typeof BILLING_PERIOD;
  trialEligible: boolean;
  active: boolean;
  features: FeatureId[];
  bullets: string[];
};

/** Bitiş yok: sahte geri sayım gösterme. Mevcut aboneliğin kilitli tutarı değişmez. */
export const CAMPAIGN = {
  active: true as boolean,
  startsAt: null as string | null,
  endsAt: null as string | null,
  afterEnds: 'list' as const,
};

/** Her özellik bir yetkiye bağlıdır; paket listesi planAccess tablosundan türetilir. */
export const FEATURE_CAPABILITY: Record<FeatureId, Capability> = {
  core_study: 'core',
  appointments: 'core',
  zorro_basic: 'ai',
  zorro_advanced: 'ai',
  ai_plan: 'ai',
  analytics: 'advanced_analytics',
};

const PRO_FEATURES: FeatureId[] = ['core_study', 'appointments'];
const PREMIUM_FEATURES: FeatureId[] = [...PRO_FEATURES, 'zorro_basic', 'zorro_advanced', 'ai_plan', 'analytics'];

export const PLANS: Record<PlanId, PlanDef> = {
  pro: {
    id: 'pro',
    name: 'Pro',
    listPriceTry: 200,
    campaignPriceTry: 100,
    currency: BILLING_CURRENCY,
    period: BILLING_PERIOD,
    trialEligible: true,
    active: true,
    features: PRO_FEATURES,
    bullets: [...PRO_FEATURE_LIST],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    listPriceTry: 400,
    campaignPriceTry: 200,
    currency: BILLING_CURRENCY,
    period: BILLING_PERIOD,
    trialEligible: true,
    active: true,
    features: PREMIUM_FEATURES,
    bullets: [...PREMIUM_FEATURE_LIST],
  },
};

export const PLAN_LIST: PlanDef[] = [PLANS.pro, PLANS.premium];

/** Eski Go → Pro (200’lük paket). Eski webhook 'Pro' (400) → Premium. Yeni 'pro' → Pro. */
export function normalizePlanId(raw: unknown): PlanId | null {
  const orig = String(raw || '').trim();
  const s = orig.toLowerCase();
  if (s === 'premium') return 'premium';
  if (s === 'go') return 'pro';
  if (orig === 'Pro') return 'premium';
  if (s === 'pro') return 'pro';
  return null;
}

/** Kampanya açıkken çekilecek tutar; kapalıysa liste fiyatı. İstemci fiyatı yok. */
export function chargeAmountTry(plan: PlanId): number {
  const p = PLANS[plan];
  return CAMPAIGN.active ? p.campaignPriceTry : p.listPriceTry;
}

export function discountPercent(plan: PlanId): number {
  const p = PLANS[plan];
  if (p.listPriceTry <= 0) return 0;
  return Math.round((1 - p.campaignPriceTry / p.listPriceTry) * 100);
}

export function formatTry(n: number) {
  return `${n} TL`;
}

export function formatPlanPrice(plan: PlanDef) {
  return `${chargeAmountTry(plan.id)} TL / ay`;
}
