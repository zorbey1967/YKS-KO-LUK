import { describe, expect, it } from 'vitest';
import type { Profile } from './types';
import {
  billingFromProfile,
  canUseFeature,
  canSeeAnalyticsPage,
  canUseAnalytics,
  canViewAnalytics,
  displayMembershipName,
  entitledPlan,
  paidAccessLocked,
  studyPagesLocked,
} from './subscription';

const now = Date.parse('2026-10-10T00:00:00.000Z');
const future = '2026-11-01T00:00:00.000Z';
const past = '2026-09-01T00:00:00.000Z';

function student(partial: Partial<Profile> & Pick<Profile, 'subscription_status'>): Profile {
  return {
    name: 'Öğrenci',
    email: 'ogrenci@example.com',
    plan: '',
    role: 'student',
    account_status: 'active',
    ...partial,
  };
}

describe('üyelik fail-closed kilitler', () => {
  it('şema yokken ücretli erişim vermez', () => {
    const profile: Profile = { name: 'x', email: 'a@b.c', plan: '' };
    expect(billingFromProfile(profile, now).schemaReady).toBe(false);
    expect(paidAccessLocked(profile, now)).toBe(true);
    expect(canUseFeature(profile, 'core_study', now)).toBe(false);
    expect(displayMembershipName(profile, now)).toBe('Üyelik kaydı sunucuda yok');
  });

  it('üyelik durumu null iken kilitler', () => {
    const profile = student({ subscription_status: null, trial_ends_at: null, plan: 'Ücretsiz' });
    expect(entitledPlan(billingFromProfile(profile, now))).toBeNull();
    expect(paidAccessLocked(profile, now)).toBe(true);
  });

  it('profil hatası şeklini (kolon yok) kilitler', () => {
    const failedLoad: Profile = { name: '', email: 'a@b.c', plan: '' };
    expect(paidAccessLocked(failedLoad, now)).toBe(true);
    expect(canUseFeature(failedLoad, 'zorro_basic', now)).toBe(false);
  });

  it('misafiri çalışma sayfalarında kilitler', () => {
    expect(studyPagesLocked({ isAdmin: false, accessGate: 'guest', profile: null, now })).toBe(true);
    expect(paidAccessLocked(null, now)).toBe(true);
  });

  it('süresi dolmuş aboneliği kilitler', () => {
    const profile = student({
      subscription_status: 'active',
      plan: 'pro',
      subscription_ends_at: past,
    });
    expect(paidAccessLocked(profile, now)).toBe(true);
    expect(canUseFeature(profile, 'core_study', now)).toBe(false);
  });

  it('geçerli denemeyi açık tutar', () => {
    const profile = student({ subscription_status: 'trialing', trial_ends_at: future });
    expect(entitledPlan(billingFromProfile(profile, now))).toBe('trial');
    expect(paidAccessLocked(profile, now)).toBe(false);
    expect(canUseFeature(profile, 'analytics', now)).toBe(true);
    expect(canSeeAnalyticsPage(profile, false, now)).toBe(true);
    expect(canUseAnalytics(profile, false, now)).toBe(true);
    expect(studyPagesLocked({ isAdmin: false, accessGate: 'ok', profile, now })).toBe(false);
  });

  it('ücretsiz öğrenci Analiz sayfasını görür ama kullanamaz; koç ve sahte admin göremez', () => {
    const free = student({ subscription_status: 'none', plan: 'Ücretsiz', trial_ends_at: null });
    expect(canSeeAnalyticsPage(free, false, now)).toBe(true);
    expect(canUseAnalytics(free, false, now)).toBe(false);
    expect(canSeeAnalyticsPage(null, false, now)).toBe(false);
    const coach: Profile = { name: 'K', email: 'k@b.c', plan: 'premium', role: 'coach', subscription_status: 'active' };
    expect(canSeeAnalyticsPage(coach, false, now)).toBe(false);
    expect(canUseAnalytics(coach, false, now)).toBe(false);
    const spoofAdmin: Profile = { name: 'A', email: 'a@b.c', plan: 'premium', role: 'admin', subscription_status: 'active' };
    expect(canSeeAnalyticsPage(spoofAdmin, false, now)).toBe(false);
    expect(canUseAnalytics(spoofAdmin, false, now)).toBe(false);
    expect(canSeeAnalyticsPage(spoofAdmin, true, now)).toBe(true);
    expect(canUseAnalytics(spoofAdmin, true, now)).toBe(true);
  });

  it('geçerli ücretli üyeliği plana göre açar', () => {
    const pro = student({
      subscription_status: 'active',
      plan: 'pro',
      subscription_ends_at: future,
    });
    expect(entitledPlan(billingFromProfile(pro, now))).toBe('pro');
    expect(paidAccessLocked(pro, now)).toBe(false);
    expect(canUseFeature(pro, 'core_study', now)).toBe(true);
    expect(canUseFeature(pro, 'analytics', now)).toBe(false);

    const premium = student({
      subscription_status: 'active',
      plan: 'premium',
      subscription_ends_at: future,
    });
    expect(canUseFeature(premium, 'analytics', now)).toBe(true);
    expect(canViewAnalytics(premium, false, now)).toBe(true);
    expect(canViewAnalytics(pro, false, now)).toBe(false);
    expect(canSeeAnalyticsPage(pro, false, now)).toBe(true);
    expect(canUseAnalytics(pro, false, now)).toBe(false);
    expect(canSeeAnalyticsPage(premium, false, now)).toBe(true);
    expect(canUseAnalytics(premium, false, now)).toBe(true);
    expect(canUseFeature(premium, 'ai_plan', now)).toBe(true);
  });

  it('koçu kilit dışı bırakır; istemci admin rolü paneli/çalışmayı açmaz', () => {
    const admin: Profile = { name: 'A', email: 'a@b.c', plan: '', role: 'admin' };
    const coach: Profile = { name: 'K', email: 'k@b.c', plan: '', role: 'coach' };
    expect(paidAccessLocked(admin, now)).toBe(true);
    expect(paidAccessLocked(coach, now)).toBe(false);
    expect(canUseFeature(admin, 'analytics', now)).toBe(false);
    expect(canViewAnalytics(admin, false, now)).toBe(false);
    expect(canViewAnalytics(admin, true, now)).toBe(true);
    expect(canViewAnalytics(coach, false, now)).toBe(false);
    expect(canViewAnalytics(null, false, now)).toBe(false);
    expect(studyPagesLocked({ isAdmin: false, accessGate: 'ok', profile: admin, now })).toBe(true);
    expect(studyPagesLocked({ isAdmin: true, accessGate: 'ok', profile: { name: '', email: '', plan: '' }, now })).toBe(false);
    expect(displayMembershipName(admin, now, true)).toBe('Premium');
    expect(displayMembershipName(admin, now, false)).not.toBe('Premium');
    const adminTrial: Profile = {
      name: 'A',
      email: 'a@b.c',
      plan: '',
      role: 'admin',
      subscription_status: 'trialing',
      trial_started_at: '2026-10-10T00:00:00.000Z',
      trial_ends_at: future,
    };
    expect(displayMembershipName(adminTrial, now, true)).toBe('14 Günlük Ücretsiz Premium Deneme');
    const adminExpired: Profile = { ...adminTrial, trial_ends_at: past };
    expect(displayMembershipName(adminExpired, now, true)).toBe('Premium');
    expect(canUseFeature(admin, 'analytics', now, true)).toBe(true);
    expect(canUseFeature(admin, 'ai_plan', now, true)).toBe(true);
    expect(paidAccessLocked(admin, now, true)).toBe(false);
  });
});
