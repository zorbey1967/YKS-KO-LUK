import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveAccessGate } from './accessGate';
import {
  applyLoginMode,
  coachModeAvailable,
  loginModeNotice,
  needsCoachApplication,
  parseLoginMode,
  resolveLoginMode,
  studentModeAvailable,
} from './roleMode';
import { postLoginPageForRole } from './roleNav';
import type { Profile } from './types';

const root = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const user = { email_confirmed_at: '2026-10-01T00:00:00Z' };
const base = (over: Partial<Profile> = {}): Profile => ({
  name: 'Ali Veli', email: 'ali@example.com', plan: '', role: 'student', account_status: 'active', ...over,
});
const gate = (p: Profile | null) => resolveAccessGate({ user, profile: p, isAdmin: false, authReady: true });

describe('giriş modu: tek hesap öğrenci + koç', () => {
  it('onaylı koç kaydı olan öğrenci iki moda da girebilir', () => {
    const p = base({ coach_status: 'active' });
    expect(coachModeAvailable(p)).toBe(true);
    expect(studentModeAvailable(p)).toBe(true);
    const asCoach = applyLoginMode(p, 'coach');
    expect(asCoach?.role).toBe('coach');
    expect(gate(asCoach)).toBe('ok');
    expect(postLoginPageForRole(asCoach?.role)).toBe('coaches');
    const asStudent = applyLoginMode(p, 'student');
    expect(asStudent?.role).toBe('student');
    expect(asStudent?.signup_intent).toBe('student');
    expect(gate(asStudent)).toBe('ok');
    expect(postLoginPageForRole(asStudent?.role)).toBe('membership');
  });

  it('koç başvurusu beklerken öğrenci modu kilitlenmez; koç modu bekleme ekranında kalır', () => {
    const p = base({ coach_status: 'pending' });
    expect(gate(applyLoginMode(p, 'student'))).toBe('ok');
    const asCoach = applyLoginMode(p, 'coach');
    expect(asCoach?.role).toBe('student');
    expect(gate(asCoach)).toBe('coach_pending');
    expect(gate(applyLoginMode(base({ coach_status: 'rejected' }), 'coach'))).toBe('coach_rejected');
  });

  it('koç kaydı yokken "Koç olarak gir" öğrenci moduna düşer ve açıklama verir', () => {
    const p = base();
    expect(resolveLoginMode(p, 'coach')).toBe('student');
    expect(applyLoginMode(p, 'coach')?.role).toBe('student');
    expect(gate(applyLoginMode(p, 'coach'))).toBe('ok');
    expect(loginModeNotice(p, 'coach')).toMatch(/koç kaydı yok/);
    expect(loginModeNotice(base({ coach_status: 'active' }), 'coach')).toBe('');
  });

  it('seçim yoksa kayıt niyeti varsayılandır', () => {
    expect(resolveLoginMode(base({ signup_intent: 'coach', coach_status: 'pending' }), null)).toBe('coach');
    expect(resolveLoginMode(base({ coach_status: 'active' }), null)).toBe('student');
  });

  it('tekrar uygulamak veritabanı rolünü bozmaz (setProfile geri yazımı)', () => {
    const once = applyLoginMode(base({ coach_status: 'active' }), 'coach');
    expect(once?.role).toBe('coach');
    expect(once?.base_role).toBe('student');
    const back = applyLoginMode(once, 'student');
    expect(back?.role).toBe('student');
    expect(applyLoginMode(back, 'coach')?.role).toBe('coach');
  });

  it('yönetici ve eski saf koç hesabı değişmez', () => {
    expect(applyLoginMode(base({ role: 'admin' }), 'coach')?.role).toBe('admin');
    const pure = base({ role: 'coach', coach_status: 'active' });
    expect(studentModeAvailable(pure)).toBe(false);
    expect(applyLoginMode(pure, 'student')?.role).toBe('coach');
    expect(loginModeNotice(pure, 'student')).toMatch(/yalnız koç/);
  });

  it('geçersiz kayıtlı mod yok sayılır', () => {
    expect(parseLoginMode('admin')).toBeNull();
    expect(parseLoginMode('coach')).toBe('coach');
  });
});

describe('giriş modu: arayüz ve sunucu bağlantısı', () => {
  const account = read('src/pages/AccountPage.tsx');
  const ctx = read('src/context/AppContext.tsx');

  it('giriş ekranında öğrenci / koç seçimi var ve girişten önce kaydedilir', () => {
    expect(account).toContain('Öğrenci olarak gir');
    expect(account).toContain('Koç olarak gir');
    expect(account).toMatch(/setLoginMode\(loginAs\);\s*const \{ error \} = await withTimeout\(supabase\.auth\.signInWithPassword/);
    expect(account).toMatch(/clearGoogleSignupPending\(\);\s*setLoginMode\(loginAs\);/);
  });

  it('Hesabım\'da mod değiştirme / başvuru yok; başvuru girişten sonra Koçlar sayfasında', () => {
    expect(account).not.toContain('Koç paneline geç');
    expect(account).not.toContain('Öğrenci moduna geç');
    expect(account).not.toContain('Öğrenci / Koç');
    expect(account).toMatch(/needsCoachApplication\(base, loginAs\)[\s\S]{0,80}go\('coaches', 'basvuru=1'\)/);
    expect(ctx).toMatch(/needsCoachApplication\(baseProfile, storedLoginMode\)[\s\S]{0,200}go\('coaches', 'basvuru=1'\)/);
    expect(read('src/pages/CoachesPage.tsx')).toMatch(/<CoachApplyCard \/>/);
  });

  it('"Koç olarak gir": kayıt yoksa veya reddedildiyse başvuru formu', () => {
    expect(needsCoachApplication(base(), 'coach')).toBe(true);
    expect(needsCoachApplication(base({ coach_status: 'rejected' }), 'coach')).toBe(true);
    expect(needsCoachApplication(base({ coach_status: 'pending' }), 'coach')).toBe(false);
    expect(needsCoachApplication(base({ coach_status: 'active' }), 'coach')).toBe(false);
    expect(needsCoachApplication(base(), 'student')).toBe(false);
    expect(needsCoachApplication(base({ coach_lookup_failed: true }), 'coach')).toBe(false);
  });

  it('bağlam profili giriş moduna göre sunar', () => {
    expect(ctx).toMatch(/applyLoginMode\(baseProfile, storedLoginMode\)/);
    expect(ctx).not.toMatch(/signup_intent: row\.signup_intent === 'coach' \|\| Boolean\(coach\)/);
  });

  it('062: koç onayı profil rolünü değiştirmez', () => {
    const sql = read('supabase/migrations/062_coach_approval_keeps_student_role.sql');
    const fn = sql.slice(sql.indexOf('create or replace function public.admin_set_coach_status'));
    expect(fn).toMatch(/update public\.coaches set status = p_status/);
    expect(fn).not.toMatch(/update public\.profiles/);
    expect(fn).toMatch(/set search_path to ''/);
  });
});
