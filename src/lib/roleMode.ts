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

export function clearLoginMode() {
  try { localStorage.removeItem(LOGIN_MODE_KEY); } catch { /* ignore */ }
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
  if (stored === 'coach') return hasCoachRecord(p) || p?.coach_lookup_failed ? 'coach' : 'student';
  if (stored === 'student') return 'student';
  // Seçim yoksa: koç niyetiyle kayıtlı ve başvurusu açık / onaylıysa koç; reddedilmiş veya pasifse öğrenci.
  const intent = (p?.base_signup_intent ?? p?.signup_intent) === 'coach';
  return intent && (p?.coach_status === 'pending' || p?.coach_status === 'active') ? 'coach' : 'student';
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

/**
 * "Koç olarak gir" seçildi ama koç kaydı yok veya reddedildi: girişten sonra başvuru formu açılır.
 * Mod değişikliği yalnız giriş ekranından (çıkış yapıp yeniden giriş); Hesabım'da mod / başvuru yok.
 */
export function needsCoachApplication(p: Profile | null | undefined, chosen: LoginMode | null) {
  if (chosen !== 'coach' || baseRoleOf(p) !== 'student' || p?.coach_lookup_failed) return false;
  return !hasCoachRecord(p) || p?.coach_status === 'rejected';
}

/** Giriş ekranında "Koç olarak gir" seçildi ama hesap koç paneline giremiyorsa açıklama. */
export function loginModeNotice(p: Profile | null | undefined, chosen: LoginMode | null): string {
  if (baseRoleOf(p) === 'admin' || p?.coach_lookup_failed) return '';
  if (chosen === 'coach' && !hasCoachRecord(p)) {
    return 'Bu hesapta koç kaydı yok. Koç olmak için başvuru formunu doldur.';
  }
  if (chosen === 'student' && !studentModeAvailable(p) && baseRoleOf(p) === 'coach') {
    return 'Bu hesap yalnız koç hesabı; koç paneli açıldı.';
  }
  return '';
}
