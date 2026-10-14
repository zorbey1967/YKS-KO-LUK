import type { AccessGate } from './accessGate';
import type { Profile } from './types';
import { PLANS, TRIAL_DAYS, normalizePlanId, type FeatureId, type PlanId } from './plans';

export type SubscriptionStatus =
  | 'none'
  | 'legacy'
  | 'pending_approval'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'blocked';

export type BillingSnapshot = {
  status: SubscriptionStatus;
  planId: PlanId | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  /** Faturalama kolonları profilde yok / okunamadı. Yetki verilmez. */
  schemaReady: boolean;
};

function asStatus(raw: unknown): SubscriptionStatus | null {
  const s = String(raw || '');
  if (
    s === 'trialing' || s === 'active' || s === 'past_due' || s === 'canceled'
    || s === 'expired' || s === 'blocked' || s === 'pending_approval' || s === 'none'
  ) return s;
  return null;
}

function asPlanId(raw: unknown): PlanId | null {
  return normalizePlanId(raw);
}

function futureOrOpen(iso: string | null, now: number, openIfMissing: boolean) {
  if (!iso) return openIfMissing;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t > now;
}

export function billingFromProfile(profile: Profile | null | undefined, now = Date.now()): BillingSnapshot {
  if (!profile) {
    return { status: 'none', planId: null, trialEndsAt: null, subscriptionEndsAt: null, schemaReady: false };
  }
  if (profile.role === 'coach') {
    return { status: 'active', planId: 'premium', trialEndsAt: null, subscriptionEndsAt: null, schemaReady: true };
  }
  const schemaReady = profile.subscription_status !== undefined || profile.trial_ends_at !== undefined;
  if (!schemaReady) {
    return { status: 'legacy', planId: null, trialEndsAt: null, subscriptionEndsAt: null, schemaReady: false };
  }
  const trialEndsAt = profile.trial_ends_at || null;
  const subscriptionEndsAt = profile.subscription_ends_at || null;
  let status = asStatus(profile.subscription_status);
  const planId = asPlanId(profile.plan);

  if (!status) {
    return { status: 'none', planId, trialEndsAt, subscriptionEndsAt, schemaReady: true };
  }

  if (status === 'trialing' && !futureOrOpen(trialEndsAt, now, false)) {
    status = 'expired';
  }
  if (status === 'active' && !futureOrOpen(subscriptionEndsAt, now, true)) {
    status = 'expired';
  }
  if (profile.account_status === 'pending') status = 'pending_approval';
  if (profile.account_status === 'rejected' || profile.account_status === 'pasif') status = 'blocked';

  return { status, planId, trialEndsAt, subscriptionEndsAt, schemaReady };
}

export function trialDaysLeft(snap: BillingSnapshot, now = Date.now()) {
  if (snap.status !== 'trialing' || !snap.trialEndsAt) return 0;
  const ms = new Date(snap.trialEndsAt).getTime() - now;
  return Math.max(0, Math.ceil(ms / 86400000));
}

/**
 * Yetki yalnızca açıkça tanımlı deneme veya ücretli planda.
 * Bilinmeyen şema, null status, tarihi bitmiş deneme/abonelik → null.
 */
export function entitledPlan(snap: BillingSnapshot): PlanId | 'trial' | null {
  if (!snap.schemaReady || snap.status === 'legacy') return null;
  if (snap.status === 'trialing') return 'trial';
  if (snap.status === 'active' && snap.planId) return snap.planId;
  return null;
}

/** Kullanıcıya gösterilen ad. DB’deki 'Ücretsiz' değeri ekrana yazılmaz. */
export function displayMembershipName(profile: Profile | null | undefined, now = Date.now(), isAdmin = false) {
  if (isAdmin) return 'Premium';
  if (profile?.role === 'coach') return '—';
  const snap = billingFromProfile(profile, now);
  const tier = entitledPlan(snap);
  if (!snap.schemaReady || snap.status === 'legacy') return 'Üyelik kaydı sunucuda yok';
  if (tier === 'trial') return '14 Günlük Deneme';
  if (tier === 'pro') return 'Pro';
  if (tier === 'premium') return 'Premium';
  if (snap.status === 'pending_approval') return 'Onay bekliyor';
  if (snap.status === 'blocked') return 'Kapalı';
  if (snap.status === 'expired' || snap.status === 'canceled' || snap.status === 'past_due') return 'Üyelik gerekli';
  return 'Üyelik yok';
}

/** Admin/listelerde ham plan kolonunu etiketler. */
export function labelStoredPlan(raw: unknown) {
  const s = String(raw || '').trim();
  if (!s || /^ücretsiz$/i.test(s) || /^free$/i.test(s)) return '—';
  const id = normalizePlanId(raw);
  if (id === 'premium') return 'Premium';
  if (id === 'pro') return 'Pro';
  if (/^go$/i.test(s)) return 'Pro';
  return s;
}

export function canUseFeature(
  profile: Profile | null | undefined,
  feature: FeatureId,
  now = Date.now(),
  isAdmin = false,
) {
  if (isAdmin) return true;
  if (profile?.role === 'coach') return true;
  const snap = billingFromProfile(profile, now);
  const tier = entitledPlan(snap);
  if (tier === 'trial') return true;
  if (tier === 'premium') return PLANS.premium.features.includes(feature);
  if (tier === 'pro') return PLANS.pro.features.includes(feature);
  return false;
}

/** Analiz kullanımı: Premium / deneme / sunucu isAdmin. Pro görür, çalıştırmaz. */
export function canUseAnalytics(
  profile: Profile | null | undefined,
  isAdmin: boolean,
  now = Date.now(),
) {
  if (isAdmin) return true;
  if (profile?.role === 'coach' || profile?.role === 'admin') return false;
  return canUseFeature(profile, 'analytics', now, false);
}

/** Analiz sayfası: öğrenci görür (ücretsiz/Pro kilitli ekran). Kullanım ayrı. Koç göremez. */
export function canSeeAnalyticsPage(
  profile: Profile | null | undefined,
  isAdmin: boolean,
  _now = Date.now(),
) {
  if (isAdmin) return true;
  if (!profile) return false;
  if (profile.role === 'coach') return false;
  if (profile.role === 'admin') return false;
  return true;
}

/** Eski ad: kullanım kapısı. */
export function canViewAnalytics(
  profile: Profile | null | undefined,
  isAdmin: boolean,
  now = Date.now(),
) {
  return canUseAnalytics(profile, isAdmin, now);
}

export function paidAccessLocked(profile: Profile | null | undefined, now = Date.now(), isAdmin = false) {
  if (isAdmin) return false;
  if (profile?.role === 'coach') return false;
  return !entitledPlan(billingFromProfile(profile, now));
}

/** Çalışma sayfası kilidi (App.tsx). Misafir her zaman kilitli; admin muaf. */
export function studyPagesLocked(input: {
  isAdmin: boolean;
  accessGate: AccessGate;
  profile: Profile | null | undefined;
  now?: number;
}) {
  if (input.isAdmin) return false;
  if (input.accessGate === 'boot' || input.accessGate === 'guest') return true;
  if (input.accessGate === 'ok') return paidAccessLocked(input.profile, input.now, false);
  return false;
}

export { TRIAL_DAYS };
