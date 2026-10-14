import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coerceAppPage, coercePageForRole } from './roleNav';
import { sidebarNav, commandNav } from './types';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('koç paneli yüzeyleri', () => {
  it('öğrenci ana sayfası, üyelik, analiz ve yönetici hash’i koçluğa düşer', () => {
    for (const page of ['home', 'membership', 'analytics', 'admin', 'questionbank', 'schedule'] as const) {
      expect(coercePageForRole(page, 'coach')).toBe('coaches');
      expect(coerceAppPage(page, 'coach', 'ok', false)).toBe('coaches');
    }
    expect(coerceAppPage('coaches', 'coach', 'ok', false)).toBe('coaches');
    expect(coerceAppPage('account', 'coach', 'ok', false)).toBe('account');
    expect(coerceAppPage('settings', 'coach', 'ok', false)).toBe('settings');
  });

  it('koç menüsünde öğrenci/yönetici sayfaları yoktur; istemci admin iddiası yetmez', () => {
    const ids = sidebarNav('coach', false).map((x) => x.id);
    expect(ids).toEqual(['coaches', 'account', 'settings']);
    expect(coercePageForRole('meetings', 'coach')).toBe('coaches');
    expect(coercePageForRole('library', 'coach')).toBe('coaches');
    expect(ids).not.toContain('home');
    expect(ids).not.toContain('admin');
    expect(ids).not.toContain('analytics');
    expect(ids).not.toContain('membership');
    expect(commandNav('coach', false).map((x) => x.id)).not.toContain('questionbank');
    expect(coerceAppPage('admin', 'coach', 'ok', false)).toBe('coaches');
  });

  it('sunucu isAdmin olan sahip tam paneli görür', () => {
    expect(coerceAppPage('admin', 'student', 'ok', true)).toBe('admin');
    expect(sidebarNav('student', true).map((x) => x.id)).toContain('admin');
    expect(src('src/pages/CoachesPage.tsx')).toContain('isAdmin');
    expect(src('src/pages/CoachesPage.tsx')).toContain('profile?.role === \'coach\' || isAdmin');
  });

  it('RPC/REST/Edge koça yabancı öğrenci verisi ve yönetici yüzeyini vermez', () => {
    const week = src('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    const exam = src('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    const ai = src('supabase/functions/student-ai/index.ts');
    const scan = src('supabase/functions/exam-scan/index.ts');
    expect(week).toContain('own_active_coach_id');
    expect(week).toContain('bu öğrenci sana atanmadı');
    expect(exam).toContain('exam_reports_coach');
    expect(exam).toContain("m.status = 'active'");
    expect(ai).toContain('Bu özellik öğrenci hesabına özel.');
    expect(scan).toContain('Bu özellik öğrenci hesabına özel.');
    expect(coerceAppPage('membership', 'coach', 'ok', false)).toBe('coaches');
    expect(coerceAppPage('questionbank', 'coach', 'ok', false)).toBe('coaches');
  });
});
