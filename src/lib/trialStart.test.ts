import { describe, expect, it } from 'vitest';
import { startTopPlanTrialSerialized, startTopPlanTrialStep, type TrialProfile } from './trialStart';

const now = Date.parse('2026-10-13T00:00:00.000Z');

function base(partial: Partial<TrialProfile> = {}): TrialProfile {
  return {
    accountActive: true,
    trialStartedAt: null,
    trialEndsAt: null,
    subscriptionStatus: null,
    subscriptionEndsAt: null,
    ...partial,
  };
}

describe('start_top_plan_trial durum makinesi', () => {
  it('askıdaki hesap yazamaz', () => {
    const r = startTopPlanTrialStep(base({ accountActive: false }), now);
    expect(r.result.wrote).toBe(false);
    expect(r.result.status).toBe('blocked');
    expect(r.row.trialStartedAt).toBeNull();
  });

  it('koç, yönetici ve oturumsuz hesap deneme açamaz', () => {
    expect(startTopPlanTrialStep(base({ role: 'coach' }), now).result.wrote).toBe(false);
    expect(startTopPlanTrialStep(base({ role: 'admin' }), now).result.wrote).toBe(false);
    expect(startTopPlanTrialStep(base({ signedIn: false }), now).result.message).toBe('oturum gerekli');
    expect(startTopPlanTrialStep(base({ role: 'student' }), now).result.wrote).toBe(true);
  });

  it('yönetici mevcut denemeyi korur; ikinci yazım olmaz', () => {
    const adminOpen = startTopPlanTrialStep(base({
      role: 'admin',
      trialStartedAt: '2026-10-14T23:01:08.602Z',
      trialEndsAt: '2026-10-28T23:01:08.602Z',
      subscriptionStatus: 'trialing',
    }), now);
    expect(adminOpen.result.wrote).toBe(false);
    expect(adminOpen.result.status).toBe('trialing');
    expect(adminOpen.row.trialStartedAt).toBe('2026-10-14T23:01:08.602Z');
    expect(adminOpen.row.trialEndsAt).toBe('2026-10-28T23:01:08.602Z');
  });

  it('ilk çağrı 14 gün yazar; tekrar ve eşzamanlı ikinci yazmaz', () => {
    const first = startTopPlanTrialStep(base(), now);
    expect(first.result.wrote).toBe(true);
    expect(first.result.status).toBe('trialing');
    expect(Date.parse(first.row.trialEndsAt || '') - now).toBe(14 * 86400000);

    const second = startTopPlanTrialStep(first.row, now + 1000);
    expect(second.result.wrote).toBe(false);
    expect(second.result.status).toBe('trialing');

    const ended = startTopPlanTrialStep({
      ...first.row,
      trialEndsAt: new Date(now - 1000).toISOString(),
    }, now);
    expect(ended.result.wrote).toBe(false);
    expect(ended.result.status).toBe('used');

    const shared = base();
    const conc = startTopPlanTrialSerialized(shared, now, 5);
    expect(conc.filter((x) => x.wrote)).toHaveLength(1);
    expect(conc.filter((x) => !x.wrote)).toHaveLength(4);
  });

  it('ücretli açıkken deneme yazmaz', () => {
    const r = startTopPlanTrialStep(base({
      subscriptionStatus: 'active',
      subscriptionEndsAt: '2026-11-01T00:00:00.000Z',
    }), now);
    expect(r.result.wrote).toBe(false);
    expect(r.result.status).toBe('active');
  });
});
