import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { studentEntitled, type EntitlementProfile } from './studentEntitled';

const now = new Date('2026-10-10T00:00:00.000Z');
const future = '2026-11-01T00:00:00.000Z';
const past = '2026-09-01T00:00:00.000Z';
const self = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';

function student(partial: Partial<EntitlementProfile> = {}): EntitlementProfile {
  return {
    role: 'student',
    account_status: 'active',
    subscription_status: 'trialing',
    trial_ends_at: future,
    ...partial,
  };
}

describe('studentEntitled (SQL 019/020 mirror)', () => {
  it('başka kullanıcının uuid ile sorgusunu reddeder', () => {
    expect(studentEntitled({
      callerId: self,
      pId: other,
      profile: student({ subscription_status: 'active', subscription_ends_at: future }),
      now,
    })).toBe(false);
  });

  it('çağıran yoksa veya p_id yoksa reddeder', () => {
    expect(studentEntitled({ callerId: null, pId: self, profile: student(), now })).toBe(false);
    expect(studentEntitled({ callerId: self, pId: null, profile: student(), now })).toBe(false);
  });

  it('null ve none üyeliği reddeder', () => {
    expect(studentEntitled({
      callerId: self, pId: self, profile: student({ subscription_status: null }), now,
    })).toBe(false);
    expect(studentEntitled({
      callerId: self, pId: self, profile: student({ subscription_status: 'none' }), now,
    })).toBe(false);
  });

  it('geçerli deneme ve süresiz/gelecek ücretli üyeliği kabul eder', () => {
    expect(studentEntitled({ callerId: self, pId: self, profile: student(), now })).toBe(true);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({
        subscription_status: 'active',
        subscription_ends_at: future,
        trial_ends_at: null,
      }),
      now,
    })).toBe(true);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({
        subscription_status: 'active',
        subscription_ends_at: null,
        trial_ends_at: null,
      }),
      now,
    })).toBe(true);
  });

  it('bitmiş deneme ve bitmiş aboneliği reddeder', () => {
    expect(studentEntitled({
      callerId: self, pId: self, profile: student({ trial_ends_at: past }), now,
    })).toBe(false);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({
        subscription_status: 'active',
        subscription_ends_at: past,
        trial_ends_at: null,
      }),
      now,
    })).toBe(false);
  });

  it('pending_approval ve pasif hesabı reddeder; koç/admin üyeliksiz geçer', () => {
    expect(studentEntitled({
      callerId: self, pId: self, profile: { role: 'admin', subscription_status: null }, now,
    })).toBe(true);
    expect(studentEntitled({
      callerId: self, pId: self, profile: { role: 'coach', subscription_status: 'none' }, now,
    })).toBe(true);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({ account_status: 'pending' }),
      now,
    })).toBe(false);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({ account_status: 'pasif', subscription_status: 'active', subscription_ends_at: future }),
      now,
    })).toBe(false);
    expect(studentEntitled({
      callerId: self,
      pId: self,
      profile: student({ subscription_status: 'pending_approval' }),
      now,
    })).toBe(false);
  });
});

describe('020 migration contract', () => {
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations/020_appointment_entitlement_caller_only.sql'),
    'utf8',
  ).toLowerCase();

  it('üyelik kolonlarını ekler ve randevuda student_entitled(auth.uid()) ister', () => {
    expect(sql).toContain('add column if not exists subscription_status');
    expect(sql).toContain('add column if not exists trial_ends_at');
    expect(sql).toContain('add column if not exists subscription_ends_at');
    expect(sql).toContain('if not public.student_entitled(auth.uid())');
    expect(sql).toContain('p_id is distinct from uid');
    expect(sql).toContain("when p_status = 'rejected' then 'pasif'");
    expect(sql).not.toContain('account_status = p_status');
    expect(sql).toContain('e-posta doğrulanmamış');
    expect(sql).toContain('grant execute on function public.request_appointment');
    expect(sql).toContain('grant execute on function public.admin_review_student');
  });

  it('authenticated execute vermez; can_join_meeting ve webhook tablolarına dokunmaz', () => {
    expect(sql).toContain('revoke all on function public.student_entitled(uuid) from public, anon, authenticated');
    expect(sql).not.toContain('grant execute on function public.student_entitled(uuid) to authenticated');
    expect(sql).not.toMatch(/create or replace function public\.can_join_meeting/);
    expect(sql).not.toContain('billing_webhook');
  });
});
