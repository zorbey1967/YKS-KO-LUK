const STORAGE_KEY = 'yks_oauth_debug';
export const OAUTH_DEBUG_EVENT = 'yks-oauth-debug';

export type OAuthExchangePhase = '' | 'START' | 'SUCCESS' | 'ERROR';

export type OAuthDebugSnapshot = {
  step: string;
  code: 'YES' | 'NO';
  state: 'YES' | 'NO';
  exchange: OAuthExchangePhase;
  exchangeError: string;
  exchangeSession: 'YES' | 'NO';
  getSession: 'YES' | 'NO';
  getSessionError: string;
  authEvent: string;
  user: 'YES' | 'NO';
  finalRoute: string;
  provider: string;
  redirectTo: string;
  codeChallenge: 'YES' | 'NO';
  authorizeState: 'YES' | 'NO';
};

const empty = (): OAuthDebugSnapshot => ({
  step: '',
  code: 'NO',
  state: 'NO',
  exchange: '',
  exchangeError: '',
  exchangeSession: 'NO',
  getSession: 'NO',
  getSessionError: '',
  authEvent: '',
  user: 'NO',
  finalRoute: '',
  provider: '',
  redirectTo: '',
  codeChallenge: 'NO',
  authorizeState: 'NO',
});

export function yesNo(v: unknown): 'YES' | 'NO' {
  return v ? 'YES' : 'NO';
}

export function sanitizeOAuthError(raw: string) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]+/g, '[jwt]')
    .replace(/(access_token|refresh_token|id_token|client_secret)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 240);
}

function currentRoute() {
  if (typeof location === 'undefined') return '';
  return `${location.pathname}${location.search}${location.hash}`;
}

export function readOAuthDebug(): OAuthDebugSnapshot {
  if (typeof sessionStorage === 'undefined') return empty();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<OAuthDebugSnapshot>;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export function writeOAuthDebug(patch: Partial<OAuthDebugSnapshot>) {
  const next = { ...readOAuthDebug(), ...patch, finalRoute: patch.finalRoute ?? currentRoute() };
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore quota */ }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OAUTH_DEBUG_EVENT));
  }
  return next;
}

export function formatOAuthDebugPanel(snap: OAuthDebugSnapshot) {
  return [
    'OAUTH DEBUG',
    `step=${snap.step || '-'}`,
    `code=${snap.code}`,
    `state=${snap.state}`,
    `exchange=${snap.exchange || '-'}`,
    `exchangeError=${snap.exchangeError || '-'}`,
    `exchangeSession=${snap.exchangeSession}`,
    `getSession=${snap.getSession}`,
    `getSessionError=${snap.getSessionError || '-'}`,
    `authEvent=${snap.authEvent || '-'}`,
    `user=${snap.user}`,
    `finalRoute=${snap.finalRoute || '-'}`,
  ].join('\n');
}

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
        && Boolean(redirectTo)
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
  if (isAuthHost(u.hostname) && u.pathname.includes('/auth/v1/authorize')) return u.toString();
  const rebuilt = new URL(`${fallback}/auth/v1/authorize`);
  u.searchParams.forEach((value, key) => rebuilt.searchParams.set(key, value));
  rebuilt.searchParams.delete('skip_http_redirect');
  return rebuilt.toString();
}
