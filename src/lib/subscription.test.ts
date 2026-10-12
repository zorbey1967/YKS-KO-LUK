import { describe, expect, it } from 'vitest';
import type { Profile } from './types';
import {
  billingFromProfile,
  canUseFeature,
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
    expect(studyPagesLocked({ isAdmin: false, accessGate: 'ok', profile, now })).toBe(false);
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
    expect(canUseFeature(premium, 'ai_plan', now)).toBe(true);
  });

  it('koçu kilit dışı bırakır; istemci admin rolü paneli/çalışmayı açmaz', () => {
    const admin: Profile = { name: 'A', email: 'a@b.c', plan: '', role: 'admin' };
    const coach: Profile = { name: 'K', email: 'k@b.c', plan: '', role: 'coach' };
    expect(paidAccessLocked(admin, now)).toBe(true);
    expect(paidAccessLocked(coach, now)).toBe(false);
    expect(canUseFeature(admin, 'analytics', now)).toBe(false);
    expect(studyPagesLocked({ isAdmin: false, accessGate: 'ok', profile: admin, now })).toBe(true);
    expect(studyPagesLocked({ isAdmin: true, accessGate: 'ok', profile: { name: '', email: '', plan: '' }, now })).toBe(false);
  });
});
