import { describe, expect, it } from 'vitest';
import type { Profile } from './types';
import { NAV, commandNav, sidebarNav } from './types';
import { QUESTION_BANK_ENABLED } from './features';
import {
  billingFromProfile,
  canStartMembershipTrial,
  canUseFeature,
  displayMembershipName,
  entitledPlan,
  paidAccessLocked,
} from './subscription';
import { applyTrialRpcToProfile, interpretStartTopPlanTrialRpc, publicTrialStartMessage, startTopPlanTrialStep } from './trialStart';
import { googleOAuthOptions } from './googleOAuth';
import { SITE_ORIGIN } from './site';

const now = Date.parse('2026-10-15T12:00:00.000Z');
const future = '2026-10-29T12:00:00.000Z';
const past = '2026-10-01T12:00:00.000Z';
const started = '2026-10-15T00:00:00.000Z';

function student(partial: Partial<Profile> = {}): Profile {
  return {
    name: 'Ö',
    email: 'o@example.com',
    plan: '',
    role: 'student',
    account_status: 'active',
    subscription_status: null,
    trial_started_at: null,
    trial_ends_at: null,
    ...partial,
  };
}

describe('üyelik trial + Net Hesapla menü', () => {
  it('aktif trial Premium erişim verir', () => {
    const profile = student({
      subscription_status: 'trialing',
      trial_started_at: started,
      trial_ends_at: future,
    });
    expect(entitledPlan(billingFromProfile(profile, now))).toBe('trial');
    expect(displayMembershipName(profile, now)).toBe('14 Günlük Ücretsiz Premium Deneme');
    expect(canUseFeature(profile, 'analytics', now)).toBe(true);
    expect(canUseFeature(profile, 'ai_plan', now)).toBe(true);
    expect(paidAccessLocked(profile, now)).toBe(false);
    expect(canStartMembershipTrial(profile, false, now)).toBe(false);
  });

  it('süresi dolmuş trial Premium değildir', () => {
    const profile = student({
      subscription_status: 'trialing',
      trial_started_at: past,
      trial_ends_at: past,
    });
    expect(entitledPlan(billingFromProfile(profile, now))).toBeNull();
    expect(displayMembershipName(profile, now)).not.toMatch(/Premium Deneme/);
    expect(canUseFeature(profile, 'analytics', now)).toBe(false);
    expect(paidAccessLocked(profile, now)).toBe(true);
  });

  it('trial olmayan öğrenci denemeyi başlatabilir', () => {
    const profile = student();
    expect(canStartMembershipTrial(profile, false, now)).toBe(true);
    expect(displayMembershipName(profile, now)).toBe('Üyelik yok');
  });

  it('başarılı RPC trialing döner; istemci start_top_plan_trial çağırır', () => {
    const ok = interpretStartTopPlanTrialRpc(null, {
      ok: true,
      status: 'trialing',
      trial_started_at: started,
      trial_ends_at: future,
      message: '14 günlük Premium deneme başladı. Ücret alınmadı.',
    });
    expect(ok.ok).toBe(true);
    expect(ok.status).toBe('trialing');
    expect(ok.trialStartedAt).toBe(started);
    expect(ok.trialEndsAt).toBe(future);
  });

  it('başarılı RPC sonrası profil trialing ise aktif trial', () => {
    const after = student({
      subscription_status: 'trialing',
      trial_started_at: started,
      trial_ends_at: future,
    });
    expect(entitledPlan(billingFromProfile(after, now))).toBe('trial');
  });

  it('ikinci trial yazılmaz', () => {
    const first = startTopPlanTrialStep({
      accountActive: true,
      role: 'student',
      trialStartedAt: null,
      trialEndsAt: null,
      subscriptionStatus: null,
      subscriptionEndsAt: null,
    }, now);
    expect(first.result.wrote).toBe(true);
    const second = startTopPlanTrialStep(first.row, now + 1000);
    expect(second.result.wrote).toBe(false);
    expect(second.result.status).toBe('trialing');
  });

  it('koç trial başlatamaz', () => {
    expect(canStartMembershipTrial({
      name: 'K', email: 'k@b.c', plan: '', role: 'coach', subscription_status: 'active',
    }, false, now)).toBe(false);
    expect(startTopPlanTrialStep({
      accountActive: true,
      role: 'coach',
      trialStartedAt: null,
      trialEndsAt: null,
      subscriptionStatus: null,
      subscriptionEndsAt: null,
    }, now).result.wrote).toBe(false);
  });

  it('admin mevcut trial korunur', () => {
    const admin: Profile = {
      name: 'A',
      email: 'yusufbesiroglu357@gmail.com',
      plan: '',
      role: 'admin',
      subscription_status: 'trialing',
      trial_started_at: '2026-10-14T23:01:08.602Z',
      trial_ends_at: '2026-10-28T23:01:08.602Z',
    };
    expect(entitledPlan(billingFromProfile(admin, now))).toBe('trial');
    expect(canStartMembershipTrial(admin, true, now)).toBe(false);
    const step = startTopPlanTrialStep({
      accountActive: true,
      role: 'admin',
      trialStartedAt: admin.trial_started_at || null,
      trialEndsAt: admin.trial_ends_at || null,
      subscriptionStatus: 'trialing',
      subscriptionEndsAt: null,
    }, now);
    expect(step.result.wrote).toBe(false);
    expect(step.row.trialStartedAt).toBe(admin.trial_started_at);
    expect(step.row.trialEndsAt).toBe(admin.trial_ends_at);
  });

  it('Net Hesapla öğrenci menüsünde Denemeler’den sonra görünür', () => {
    const ids = sidebarNav('student', false).map((x) => x.id);
    const labels = sidebarNav('student', false).map((x) => x.label);
    expect(ids).toContain('calculator');
    expect(ids.indexOf('exams')).toBeLessThan(ids.indexOf('calculator'));
    expect(labels[ids.indexOf('calculator')]).toBe('Net Hesapla');
    expect(ids).toEqual(expect.arrayContaining([
      'home', 'coaches', 'meetings', 'library', 'analytics',
      'schedule', 'calendar', 'tasks', 'goal', 'exams', 'calculator',
      'topics', 'questions', 'timer', 'membership', 'account',
    ]));
    expect(ids).not.toContain('questionbank');
    expect(NAV.some((n) => n.id === 'questionbank')).toBe(true);
    expect(QUESTION_BANK_ENABLED).toBe(false);
  });

  it('sidebar eski çalışma sırasını korur', () => {
    const ids = sidebarNav('student', false).map((x) => x.id);
    expect(ids).toEqual([
      'home', 'coaches', 'meetings', 'library', 'analytics',
      'schedule', 'calendar', 'tasks', 'goal', 'plan', 'exams', 'calculator',
      'topics', 'questions', 'timer', 'membership', 'account',
    ]);
    expect(ids.indexOf('home')).toBe(0);
    expect(ids.indexOf('coaches')).toBe(1);
    expect(ids.indexOf('library')).toBeLessThan(ids.indexOf('analytics'));
    expect(ids.indexOf('analytics')).toBeLessThan(ids.indexOf('schedule'));
    expect(commandNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    expect(ids.indexOf('calculator')).toBeGreaterThan(ids.indexOf('exams'));
    expect(ids).not.toContain('admin');
    expect(sidebarNav('coach', false).map((x) => x.id)).toEqual(['coaches', 'account', 'settings']);
  });

  it('Google OAuth production redirectTo değişmez', () => {
    expect(googleOAuthOptions().provider).toBe('google');
    expect(googleOAuthOptions().options.redirectTo).toBe(`${SITE_ORIGIN}/`);
    expect(googleOAuthOptions().options.skipBrowserRedirect).toBe(false);
  });

  it('RPC trialing profili hemen günceller; 14 gün biterse kilitlenir', () => {
    const after = applyTrialRpcToProfile(student(), {
      ok: true,
      status: 'trialing',
      trialStartedAt: started,
      trialEndsAt: future,
    });
    expect(after.subscription_status).toBe('trialing');
    expect(after.trial_ends_at).toBe(future);
    expect(entitledPlan(billingFromProfile(after, now))).toBe('trial');
    expect(entitledPlan(billingFromProfile(after, Date.parse(future) + 1))).toBeNull();
  });

  it('RPC hata metni 030 / yönetici onayı debug göstermez', () => {
    expect(publicTrialStartMessage('Could not find the function public.start_top_plan_trial (030)')).not.toMatch(/030|yönetici onay|sunucuya işlenmedi/);
    expect(publicTrialStartMessage('oturum gerekli')).toBe('Deneme için giriş yap.');
  });

  it('RPC eksikse debug 030 metni göstermez', () => {
    const res = interpretStartTopPlanTrialRpc({ message: 'Could not find the function public.start_top_plan_trial' }, null);
    expect(res.ok).toBe(false);
    expect(res.message).not.toMatch(/030/);
    expect(res.message).not.toMatch(/henüz sunucuya işlenmedi/);
  });
});
