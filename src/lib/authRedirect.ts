import { SITE_ORIGIN } from './site';

/** Hash router account page. Recovery tokens still land on the SPA origin. */
export const AUTH_RECOVERY_HASH = '#/account';

function isProjectVercelOrigin(origin: string) {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'e-kocluk.vercel.app') return true;
    if (!h.endsWith('.vercel.app')) return false;
    return h.includes('e-kocluk') || h.includes('yks-ko-luk');
  } catch {
    return false;
  }
}

export function isLegacyGithubPagesUrl(value: string) {
  return /(?:^|[/.])github\.io(?:\/|$)/i.test(String(value || ''));
}

export function isLocalAuthOrigin(origin: string) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(origin.trim().replace(/\/$/, ''));
}

export function isAllowedAuthOrigin(origin: string) {
  const o = origin.trim().replace(/\/$/, '');
  if (isLegacyGithubPagesUrl(o)) return false;
  if (o === SITE_ORIGIN) return true;
  if (isLocalAuthOrigin(o)) return true;
  if (isProjectVercelOrigin(o)) return true;
  const extra = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/$/, '');
  if (extra && extra === o && isProjectVercelOrigin(extra) && !isLegacyGithubPagesUrl(extra)) return true;
  return false;
}

/** Open-redirect-safe emailRedirectTo. Unknown origins fall back to SITE_ORIGIN. */
export function authEmailRedirectTo(candidateOrigin?: string) {
  const raw = String(candidateOrigin || SITE_ORIGIN).trim().replace(/\/$/, '');
  const origin = isAllowedAuthOrigin(raw) ? raw : SITE_ORIGIN;
  return `${origin}/${AUTH_RECOVERY_HASH}`;
}
