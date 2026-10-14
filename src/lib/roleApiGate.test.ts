import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adminRpcAllowed, examScanReject, studentAiReject, weekPlanReadable } from './roleApiGate';
import { studentFeatureOk } from '../../supabase/functions/_shared/billingEntitled.ts';
import { coerceAppPage } from './roleNav';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('rol ve API sınırları', () => {
  it('öğrenci / koç / yönetici / sahip / askı ayrı kapılardan geçer', () => {
    expect(studentAiReject('student', false)).toBeNull();
    expect(studentAiReject('coach', false)?.status).toBe(403);
    expect(studentAiReject('coach', true)).toBeNull();
    expect(examScanReject('coach', false)?.status).toBe(403);
    expect(adminRpcAllowed('coach', true)).toBe(false);
    expect(adminRpcAllowed('admin', true)).toBe(true);
    expect(adminRpcAllowed('admin', false)).toBe(false);
    expect(studentFeatureOk({
      skip: false, role: 'coach', status: 'active', trialEnds: '', subEnds: '', plan: 'premium',
    }).entitled).toBe(false);
    expect(weekPlanReadable({
      readerId: 'c1', studentId: 's1', readerRole: 'coach', isAdmin: false, assignedCoach: false,
    })).toBe(false);
    expect(weekPlanReadable({
      readerId: 'c1', studentId: 's1', readerRole: 'coach', isAdmin: false, assignedCoach: true,
    })).toBe(true);
    expect(coerceAppPage('admin', 'coach', 'ok', false)).toBe('coaches');
    expect(coerceAppPage('questionbank', 'student', 'suspended', false)).toBe('account');
  });

  it('koç JWT ile yönetici RPC ve öğrenci edge gövdesi kaynakta reddedilir', () => {
    const adminFn = readFileSync(join(root, 'supabase/migrations/029_account_suspend.sql'), 'utf8');
    expect(adminFn).toContain("if actor is null or not public.is_admin() then");
    expect(adminFn).toContain("raise exception 'yetkisiz'");
    const ai = readFileSync(join(root, 'supabase/functions/student-ai/index.ts'), 'utf8');
    const scan = readFileSync(join(root, 'supabase/functions/exam-scan/index.ts'), 'utf8');
    expect(ai).toContain("auth.billing.role === \"coach\"");
    expect(scan).toContain('Bu özellik öğrenci hesabına özel.');
    const week = readFileSync(join(root, 'supabase/migrations/030_owner_trial_weekplan_exam.sql'), 'utf8');
    expect(week).toContain("raise exception 'bu öğrenci sana atanmadı'");
    expect(week).toContain('exam_reports_coach');
  });
});
