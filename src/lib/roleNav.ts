import { coercePageForAccess, type AccessGate } from './accessGate';
import type { PageId, Profile } from './types';

/** Öğrenci çalışma yüzeyleri. Koç hash ile gelse de panel dışına düşmesin. RLS yine asıl kapı. */
export const STUDENT_ONLY_PAGES: PageId[] = [
  'home',
  'meetings',
  'library',
  'questionbank',
  'goal',
  'schedule',
  'tasks',
  'plan',
  'exams',
  'calculator',
  'topics',
  'questions',
  'calendar',
  'timer',
  'analytics',
  'membership',
  'admin',
];

export function landingPageForRole(role: Profile['role'] | string | null | undefined): PageId {
  return role === 'coach' ? 'coaches' : 'home';
}

export function coercePageForRole(
  page: PageId,
  role: Profile['role'] | string | null | undefined,
  isAdmin = false,
): PageId {
  if (isAdmin) return page;
  if (role === 'coach' && (STUDENT_ONLY_PAGES.includes(page) || page === 'admin')) return 'coaches';
  return page;
}

export function coerceAppPage(
  page: PageId,
  role: Profile['role'] | string | null | undefined,
  gate: AccessGate,
  isAdmin = false,
): PageId {
  return coercePageForAccess(coercePageForRole(page, role, isAdmin), gate);
}

export function leaveMeetingShell(go: (id: PageId) => void, role: Profile['role'] | string | null | undefined) {
  go(landingPageForRole(role));
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* tarayıcı script kapatmayı reddedebilir */
    }
  }, 80);
}
