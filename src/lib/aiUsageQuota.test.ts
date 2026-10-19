import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aiQuotaFor, aiQuotaKeys } from '../../supabase/functions/_shared/aiUsageQuota.ts';

const env = (vals: Record<string, string>) => ({ get: (k: string) => vals[k] });

describe('ZORRO kullanım sınırı', () => {
  it('paket bazlı varsayılanlar; yönetici sınırsız; 0 = sınırsız', () => {
    expect(aiQuotaFor('pro', 'student', env({}))).toEqual({ daily: 40, monthly: 800 });
    expect(aiQuotaFor('premium', 'student', env({}))).toEqual({ daily: 150, monthly: 3000 });
    expect(aiQuotaFor('trial', 'student', env({}))).toEqual({ daily: 150, monthly: 3000 });
    expect(aiQuotaFor('premium', 'admin', env({}))).toEqual({ daily: 0, monthly: 0 });
    expect(aiQuotaFor('pro', 'student', env({ AI_DAILY_LIMIT_PRO: '10', AI_MONTHLY_LIMIT_PRO: '0' }))).toEqual({ daily: 10, monthly: 0 });
    expect(aiQuotaFor('pro', 'student', env({ AI_DAILY_LIMIT_PRO: 'abc' })).daily).toBe(40);
  });

  it('sayaç anahtarı İstanbul gününe göre değişir', () => {
    const k = aiQuotaKeys('u1', new Date('2026-10-19T22:30:00Z'));
    expect(k.day).toBe('ai:d:u1:2026-10-20');
    expect(k.month).toBe('ai:m:u1:2026-10');
  });

  it('student-ai kotayı üyelik kontrolünden sonra uygular ve 429 döner', () => {
    const src = readFileSync(join(process.cwd(), 'supabase/functions/student-ai/index.ts'), 'utf8');
    expect(src).toContain('aiQuotaFor(bill.tier, auth.billing.role, Deno.env)');
    expect(src.indexOf('studentFeatureOk(auth.billing)')).toBeLessThan(src.indexOf('aiQuotaFor('));
    expect(src).toContain('"quota_daily" }, 429');
    const client = readFileSync(join(process.cwd(), 'src/lib/coachAi.ts'), 'utf8');
    expect(client).toContain('res.status === 429');
    expect(client).toContain('aiInflight');
  });
});
