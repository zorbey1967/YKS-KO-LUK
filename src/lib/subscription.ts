import type { AccessGate } from './accessGate';
import type { Profile } from './types';
import { FEATURE_CAPABILITY, TRIAL_DAYS, normalizePlanId, type FeatureId, type PlanId } from './plans';
import { tierCan, type AccessTier } from './planAccess';

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
  const trialStartedAt = profile.trial_started_at || null;
  const subscriptionEndsAt = profile.subscription_ends_at || null;
  let status = asStatus(profile.subscription_status);
  const planId = asPlanId(profile.plan);

  if (!status) {
    return { status: 'none', planId, trialEndsAt, subscriptionEndsAt, schemaReady: true };
  }

  const trialWindowOpen = futureOrOpen(trialEndsAt, now, false)
    && (!trialStartedAt || !Number.isFinite(new Date(trialStartedAt).getTime()) || new Date(trialStartedAt).getTime() <= now);
  if (status === 'trialing' && !trialWindowOpen) {
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
  const snap = billingFromProfile(profile, now);
  const tier = entitledPlan(snap);
  if (tier === 'trial') return '14 Günlük Ücretsiz Deneme';
  if (isAdmin) return 'Premium';
  if (profile?.role === 'coach') return '—';
  if (!snap.schemaReady || snap.status === 'legacy') return 'Üyelik kaydı sunucuda yok';
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

/**
 * Öğrencinin erişim katmanı (planAccess tablosu). Yönetici → staff.
 * Koç bu katmana girmez: öğrenci paketi değildir (aşağıda canUseFeature koç araçlarını ayrı tutar).
 */
export function accessTier(profile: Profile | null | undefined, now = Date.now(), isAdmin = false): AccessTier {
  if (isAdmin) return 'staff';
  const tier = entitledPlan(billingFromProfile(profile, now));
  if (tier === 'premium') return 'premium';
  if (tier === 'pro') return 'pro';
  if (tier === 'trial') return 'trial';
  return 'none';
}

export function canUseFeature(
  profile: Profile | null | undefined,
  feature: FeatureId,
  now = Date.now(),
  isAdmin = false,
) {
  if (isAdmin) return true;
  /** Koç paneli kendi araçlarını kullanır; öğrenci ZORRO'su sunucuda koça 403 döner. */
  if (profile?.role === 'coach') return true;
  return tierCan(accessTier(profile, now, false), FEATURE_CAPABILITY[feature]);
}

/** ZORRO ve diğer yapay zekâ işlemleri: yalnız aktif Premium (ve yönetici). Koç: öğrenci ZORRO'su yok. */
export function canUseAi(profile: Profile | null | undefined, isAdmin: boolean, now = Date.now()) {
  if (isAdmin) return true;
  if (profile?.role === 'coach' || profile?.role === 'admin') return false;
  return tierCan(accessTier(profile, now, false), 'ai');
}

/** Gelişmiş analiz: yalnız aktif Premium ve yönetici. Pro ve deneme sayfayı görür, kilitli. */
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

/** Öğrenci kendi denemesini başlatabilir. Koç/admin/aktif üyelik/kullanılmış deneme hayır. */
export function canStartMembershipTrial(
  profile: Profile | null | undefined,
  isAdmin = false,
  now = Date.now(),
) {
  if (!profile || isAdmin) return false;
  if (profile.role === 'coach' || profile.role === 'admin') return false;
  const snap = billingFromProfile(profile, now);
  if (snap.status === 'trialing' || snap.status === 'active') return false;
  if (profile.trial_started_at) return false;
  return true;
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
