import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { billingOk, examAnalyticsAllowed, studentFeatureOk } from '../../supabase/functions/_shared/billingEntitled.ts';

const now = Date.parse('2026-10-10T00:00:00.000Z');
const future = '2026-11-01T00:00:00.000Z';
const past = '2026-09-01T00:00:00.000Z';

describe('student-ai billingOk fail-closed', () => {
  it('şema okunamazsa (skip) erişimi reddeder', () => {
    const r = billingOk({
      skip: true,
      role: 'student',
      status: '',
      trialEnds: '',
      subEnds: '',
      plan: '',
    }, now);
    expect(r.entitled).toBe(false);
    expect(r.tier).toBe('none');
  });

  it('boş üyelik durumunda erişimi reddeder', () => {
    const r = billingOk({
      skip: false,
      role: 'student',
      status: '',
      trialEnds: '',
      subEnds: '',
      plan: 'pro',
    }, now);
    expect(r.entitled).toBe(false);
  });

  it('süresi dolmuş deneme ve aboneliği reddeder', () => {
    expect(billingOk({
      skip: false,
      role: 'student',
      status: 'trialing',
      trialEnds: past,
      subEnds: '',
      plan: '',
    }, now).entitled).toBe(false);
    expect(billingOk({
      skip: false,
      role: 'student',
      status: 'active',
      trialEnds: '',
      subEnds: past,
      plan: 'premium',
    }, now).entitled).toBe(false);
  });

  it('geçerli deneme ve ücretli üyeliği kabul eder', () => {
    expect(billingOk({
      skip: false,
      role: 'student',
      status: 'trialing',
      trialEnds: future,
      subEnds: '',
      plan: '',
    }, now)).toEqual({ entitled: true, tier: 'trial' });
    expect(billingOk({
      skip: false,
      role: 'student',
      status: 'active',
      trialEnds: '',
      subEnds: future,
      plan: 'pro',
    }, now)).toEqual({ entitled: true, tier: 'pro' });
  });

  it('admin/koç skip olsa bile erişir; öğrenci skip ile erişemez', () => {
    expect(billingOk({
      skip: true,
      role: 'admin',
      status: '',
      trialEnds: '',
      subEnds: '',
      plan: '',
    }, now).entitled).toBe(true);
    expect(billingOk({
      skip: true,
      role: 'coach',
      status: '',
      trialEnds: '',
      subEnds: '',
      plan: '',
    }, now).tier).toBe('premium');
    expect(billingOk({
      skip: true,
      role: 'student',
      status: 'trialing',
      trialEnds: future,
      subEnds: '',
      plan: '',
    }, now).entitled).toBe(false);
  });

  it('studentFeatureOk koça öğrenci Zorro’sunu açmaz; student-ai kaynakta rol ayrılır', () => {
    expect(studentFeatureOk({
      skip: true,
      role: 'coach',
      status: '',
      trialEnds: '',
      subEnds: '',
      plan: '',
    }, now).entitled).toBe(false);
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/student-ai/index.ts'),
      'utf8',
    );
    const scan = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/exam-scan/index.ts'),
      'utf8',
    );
    expect(src).toContain('studentFeatureOk');
    expect(src).toContain('Bu özellik öğrenci hesabına özel.');
    expect(src).toContain('is_admin');
    expect(src).toContain('is_platform_owner');
    expect(scan).toContain('studentFeatureOk');
    expect(scan).toContain('Bu özellik öğrenci hesabına özel.');
    const authAt = src.indexOf('const auth = await requireUser(req)');
    const billAt = src.indexOf('const bill = studentFeatureOk(auth.billing)');
    const jsonAt = src.indexOf('body = await req.json()');
    expect(authAt).toBeGreaterThan(0);
    expect(billAt).toBeGreaterThan(authAt);
    expect(jsonAt).toBeGreaterThan(billAt);
  });

  it('exam-scan analiz: ücretsiz/Pro/koç kapalı; Premium ve deneme açık', () => {
    const pro = studentFeatureOk({
      skip: false, role: 'student', status: 'active', trialEnds: '', subEnds: future, plan: 'pro',
    }, now);
    const premium = studentFeatureOk({
      skip: false, role: 'student', status: 'active', trialEnds: '', subEnds: future, plan: 'premium',
    }, now);
    const trial = studentFeatureOk({
      skip: false, role: 'student', status: 'trialing', trialEnds: future, subEnds: '', plan: '',
    }, now);
    const free = studentFeatureOk({
      skip: false, role: 'student', status: 'none', trialEnds: '', subEnds: '', plan: 'Ücretsiz',
    }, now);
    const coach = studentFeatureOk({
      skip: false, role: 'coach', status: 'active', trialEnds: '', subEnds: future, plan: 'premium',
    }, now);
    expect(examAnalyticsAllowed(false, free)).toBe(false);
    expect(examAnalyticsAllowed(false, pro)).toBe(false);
    expect(examAnalyticsAllowed(false, premium)).toBe(true);
    expect(examAnalyticsAllowed(false, trial)).toBe(true);
    expect(examAnalyticsAllowed(false, coach)).toBe(false);
    expect(examAnalyticsAllowed(true, pro)).toBe(true);
    const scan = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/exam-scan/index.ts'), 'utf8');
    expect(scan).toContain('examAnalyticsAllowed');
  });

  it('active ama plansız kaydı reddeder', () => {
    expect(billingOk({
      skip: false,
      role: 'student',
      status: 'active',
      trialEnds: '',
      subEnds: future,
      plan: 'Ücretsiz',
    }, now).entitled).toBe(false);
  });
});
