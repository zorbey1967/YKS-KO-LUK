import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS } from './plans';
import { startTopPlanTrialStep } from './trialStart';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('deneme süresi 14 gün', () => {
  it('istemci, katalog ve SQL aynı 14 gün; 4 günlük deneme yok', () => {
    expect(TRIAL_DAYS).toBe(14);
    const catalog = readFileSync(join(root, 'supabase/functions/_shared/billingCatalog.ts'), 'utf8');
    expect(catalog).toContain('TRIAL_DAYS = 14');
    const sql = readFileSync(join(root, 'supabase/migrations/030_owner_trial_weekplan_exam.sql'), 'utf8');
    expect(sql).toContain("interval '14 days'");
    expect(sql).not.toContain("interval '4 days'");
    const now = Date.parse('2026-10-10T00:00:00.000Z');
    const step = startTopPlanTrialStep({
      accountActive: true,
      role: 'student',
      trialStartedAt: null,
      trialEndsAt: null,
      subscriptionStatus: null,
      subscriptionEndsAt: null,
    }, now);
    expect(Date.parse(step.row.trialEndsAt || '') - now).toBe(14 * 86400000);
  });
});
