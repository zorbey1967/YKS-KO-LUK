import { SITE_ORIGIN } from './site';

/** Hash router account page. Recovery tokens still land on the SPA origin. */
export const AUTH_RECOVERY_HASH = '#/account';

export function isAllowedAuthOrigin(origin: string) {
  const o = origin.trim().replace(/\/$/, '');
  if (o === SITE_ORIGIN) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(o)) return true;
  const extra = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/$/, '');
  if (extra && extra === o && extra === SITE_ORIGIN) return true;
  return false;
}

/** Open-redirect-safe emailRedirectTo. Unknown origins fall back to SITE_ORIGIN. */
export function authEmailRedirectTo(candidateOrigin?: string) {
  const raw = String(candidateOrigin || SITE_ORIGIN).trim().replace(/\/$/, '');
  const origin = isAllowedAuthOrigin(raw) ? raw : SITE_ORIGIN;
  return `${origin}/${AUTH_RECOVERY_HASH}`;
}
