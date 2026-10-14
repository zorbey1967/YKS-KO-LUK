import { isLegacyGithubPagesUrl, isLocalAuthOrigin } from './authRedirect';
import { SITE_ORIGIN } from './site';

function isAuthHost(host: string) {
  return host.endsWith('.supabase.co') || host === '127.0.0.1' || host === 'localhost';
}

function authUrlBase(explicit?: string) {
  const raw = String(explicit || '').replace(/\/$/, '');
  if (raw) return raw;
  return 'http://127.0.0.1:54321';
}

export function inspectAuthorizeUrl(raw: string, supabaseBase?: string) {
  try {
    const href = authorizeUrlForNavigation(raw, supabaseBase);
    const u = new URL(href);
    const provider = u.searchParams.get('provider') || '';
    const redirectTo = u.searchParams.get('redirect_to') || '';
    const codeChallenge = Boolean(u.searchParams.get('code_challenge'));
    const authorizeState = Boolean(u.searchParams.get('state'));
    const skipHttpRedirect = u.searchParams.get('skip_http_redirect');
    const authorizePath = u.pathname.includes('/auth/v1/authorize');
    const redirectOrigin = redirectTo.replace(/\/$/, '');
    const redirectOk = Boolean(redirectTo)
      && !isLegacyGithubPagesUrl(redirectTo)
      && (redirectOrigin === SITE_ORIGIN || isLocalAuthOrigin(redirectOrigin));
    return {
      provider,
      redirectTo,
      codeChallenge,
      authorizeState,
      skipHttpRedirect,
      host: u.hostname,
      ok:
        isAuthHost(u.hostname)
        && authorizePath
        && provider === 'google'
        && redirectOk
        && codeChallenge
        && skipHttpRedirect !== 'true',
    };
  } catch {
    return {
      provider: '',
      redirectTo: '',
      codeChallenge: false,
      authorizeState: false,
      skipHttpRedirect: null as string | null,
      host: '',
      ok: false,
    };
  }
}

/** skip_http_redirect silinir. Göreli URL asla uygulama origin’ine (e-kocluk) çözülmez. */
export function authorizeUrlForNavigation(raw: string, supabaseBase?: string) {
  const fallback = authUrlBase(supabaseBase);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    u = new URL(raw, `${fallback}/`);
  }
  u.searchParams.delete('skip_http_redirect');
  const redirectTo = u.searchParams.get('redirect_to') || '';
  if (!redirectTo || isLegacyGithubPagesUrl(redirectTo)) {
    u.searchParams.set('redirect_to', `${SITE_ORIGIN}/`);
  }
  if (isAuthHost(u.hostname) && u.pathname.includes('/auth/v1/authorize')) return u.toString();
  const rebuilt = new URL(`${fallback}/auth/v1/authorize`);
  u.searchParams.forEach((value, key) => rebuilt.searchParams.set(key, value));
  rebuilt.searchParams.delete('skip_http_redirect');
  return rebuilt.toString();
}
