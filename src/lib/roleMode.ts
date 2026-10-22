import type { Profile } from './types';
import { readLocal, writeLocal } from './util';

/** Tek hesap: öğrenci tarafı veya (onaylı koç kaydı varsa) koç paneli. */
export type LoginMode = 'student' | 'coach';

export const LOGIN_MODE_KEY = 'yks_login_mode';

export function parseLoginMode(raw: unknown): LoginMode | null {
  return raw === 'coach' || raw === 'student' ? raw : null;
}

export function readLoginMode(): LoginMode | null {
  return parseLoginMode(readLocal(LOGIN_MODE_KEY));
}

export function writeLoginMode(mode: LoginMode) {
  writeLocal(LOGIN_MODE_KEY, mode);
}

export function baseRoleOf(p: Profile | null | undefined) {
  return p?.base_role ?? p?.role ?? 'student';
}

/** Koç kaydı (beklemede / onaylı / reddedildi) var mı. */
export function hasCoachRecord(p: Profile | null | undefined) {
  return Boolean(p?.coach_status) || baseRoleOf(p) === 'coach';
}

/** Koç paneli yalnız onaylı koç kaydıyla açılır. */
export function coachModeAvailable(p: Profile | null | undefined) {
  return baseRoleOf(p) === 'coach' || p?.coach_status === 'active';
}

/**
 * Öğrenci tarafı rolü `student` olan hesaplarda açılır (paket/deneme kuralları bu role bağlı).
 * Eski tip saf koç hesabı (`role = coach`) öğrenci tarafına geçemez.
 */
export function studentModeAvailable(p: Profile | null | undefined) {
  return baseRoleOf(p) === 'student';
}

export function resolveLoginMode(p: Profile | null | undefined, stored: LoginMode | null): LoginMode {
  const role = baseRoleOf(p);
  if (role === 'coach') return 'coach';
  if (role === 'admin') return 'student';
  const preferred = stored ?? ((p?.base_signup_intent ?? p?.signup_intent) === 'coach' ? 'coach' : 'student');
  if (preferred === 'coach' && !hasCoachRecord(p)) return 'student';
  return preferred;
}

/** Profili seçilen giriş moduna göre gösterir; tekrar uygulanması sonucu değiştirmez. */
export function applyLoginMode(p: Profile | null, stored: LoginMode | null): Profile | null {
  if (!p) return p;
  const baseRole = baseRoleOf(p);
  const baseIntent = p.base_signup_intent ?? p.signup_intent ?? 'student';
  const base: Profile = { ...p, base_role: baseRole, base_signup_intent: baseIntent };
  if (baseRole === 'admin') return { ...base, role: 'admin', signup_intent: baseIntent };
  if (baseRole === 'coach') return { ...base, role: 'coach', signup_intent: 'coach' };
  if (resolveLoginMode(base, stored) === 'coach') {
    return { ...base, role: p.coach_status === 'active' ? 'coach' : 'student', signup_intent: 'coach' };
  }
  return { ...base, role: 'student', signup_intent: 'student' };
}

/** Giriş ekranında "Koç olarak gir" seçildi ama hesap koç paneline giremiyorsa açıklama. */
export function loginModeNotice(p: Profile | null | undefined, chosen: LoginMode | null): string {
  if (chosen === 'coach' && !hasCoachRecord(p)) {
    return 'Bu hesapta koç kaydı yok; öğrenci olarak giriş yapıldı. Koç olmak için Hesabım\'dan başvurabilirsin.';
  }
  if (chosen === 'student' && !studentModeAvailable(p) && baseRoleOf(p) === 'coach') {
    return 'Bu hesap yalnız koç hesabı; koç paneli açıldı.';
  }
  return '';
}
