import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { publicAuthError } from './authUi';

export type OAuthCallbackParams = {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
};

export type OAuthDebug = {
  codePresent: boolean;
  codeLength: number;
  exchangeStarted: boolean;
  exchangeError: string | null;
  exchangeSession: boolean;
  exchangeUser: boolean;
  getSessionError: string | null;
  getSession: boolean;
  authEvent: string;
  user: boolean;
  reused: boolean;
};

export type OAuthConsumeResult = {
  handled: boolean;
  message: string;
  session: Session | null;
  debug: OAuthDebug;
};

const emptyDebug = (): OAuthDebug => ({
  codePresent: false,
  codeLength: 0,
  exchangeStarted: false,
  exchangeError: null,
  exchangeSession: false,
  exchangeUser: false,
  getSessionError: null,
  getSession: false,
  authEvent: '',
  user: false,
  reused: false,
});

let consumeOnce: Promise<OAuthConsumeResult> | null = null;
let consumedCode = '';
let lastAuthEvent = '';

export function noteOAuthAuthEvent(event: string) {
  lastAuthEvent = event;
}

export function oauthConsumeBusy() {
  return Boolean(consumeOnce);
}

export function readOAuthCallback(search: string, hash: string): OAuthCallbackParams {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  let hashQuery = new URLSearchParams();
  if (rawHash.includes('?')) {
    hashQuery = new URLSearchParams(rawHash.slice(rawHash.indexOf('?') + 1));
  } else if (rawHash.includes('=') && !rawHash.startsWith('/')) {
    hashQuery = new URLSearchParams(rawHash);
  }
  const get = (key: string) => query.get(key) || hashQuery.get(key);
  return {
    code: get('code'),
    error: get('error') || get('error_code'),
    errorDescription: get('error_description'),
  };
}

export function urlHasOAuthCallback(search: string, hash: string) {
  const p = readOAuthCallback(search, hash);
  return Boolean(p.code || p.error);
}

function oauthSearchParams() {
  return readOAuthCallback(location.search, location.hash);
}

export function stripOAuthParamsFromUrl(openAccount = false) {
  const url = new URL(location.href);
  ['code', 'state', 'error', 'error_description', 'error_code'].forEach((k) => url.searchParams.delete(k));
  if (url.hash.includes('?')) {
    const [path, q] = url.hash.split('?');
    const hp = new URLSearchParams(q);
    ['code', 'state', 'error', 'error_description', 'error_code', 'oauth'].forEach((k) => hp.delete(k));
    const next = hp.toString();
    url.hash = next ? `${path}?${next}` : path;
  }
  if (openAccount) url.hash = '/account';
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function openAccountHashKeepQuery() {
  const url = new URL(location.href);
  url.hash = '/account';
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function formatOAuthExchangeError(err: unknown) {
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message || err || '');
  const mapped = publicAuthError(err instanceof Error ? err : new Error(raw));
  if (raw && mapped && mapped !== raw) return `${mapped} (${raw})`;
  return raw || mapped || 'Google oturumu kurulamadı.';
}

export function formatOAuthDebugLine(debug: OAuthDebug) {
  return [
    `code=${debug.codePresent ? 'var' : 'yok'}`,
    `exchange=${debug.exchangeStarted ? 'başladı' : 'yok'}`,
    `exchange.error=${debug.exchangeError || 'yok'}`,
    `exchange.session=${debug.exchangeSession ? 'var' : 'yok'}`,
    `getSession.error=${debug.getSessionError || 'yok'}`,
    `getSession.session=${debug.getSession ? 'var' : 'yok'}`,
    `auth event=${debug.authEvent || 'yok'}`,
    `user=${debug.user ? 'var' : 'yok'}`,
    debug.reused ? 'reused=1' : '',
  ].filter(Boolean).join(' ');
}

type ExchangeClient = {
  auth: {
    exchangeCodeForSession: (code: string) => PromiseLike<{
      data: { session: Session | null; user?: { id: string } | null };
      error: { message: string } | null;
    }>;
    getSession?: () => PromiseLike<{ data: { session: Session | null }; error?: { message: string } | null }>;
  };
};

export async function completeOAuthCode(client: ExchangeClient, params: OAuthCallbackParams): Promise<OAuthConsumeResult> {
  const debug = emptyDebug();
  debug.codePresent = Boolean(params.code);
  debug.codeLength = params.code ? params.code.length : 0;
  debug.authEvent = lastAuthEvent;
  if (!params.code && !params.error) return { handled: false, message: '', session: null, debug };
  if (params.error) {
    debug.exchangeError = params.errorDescription || params.error;
    return {
      handled: true,
      message: `${formatOAuthExchangeError(new Error(debug.exchangeError))} ${formatOAuthDebugLine(debug)}`,
      session: null,
      debug,
    };
  }
  debug.exchangeStarted = true;
  const { data, error } = await client.auth.exchangeCodeForSession(String(params.code));
  debug.exchangeError = error?.message || null;
  debug.exchangeSession = Boolean(data?.session);
  debug.exchangeUser = Boolean(data?.session?.user || data?.user);
  let stored: Session | null = data?.session || null;
  if (client.auth.getSession) {
    try {
      const after = await client.auth.getSession();
      stored = after.data.session || stored;
      debug.getSession = Boolean(after.data.session?.user);
      debug.getSessionError = after.error?.message || null;
    } catch (e) {
      debug.getSessionError = e instanceof Error ? e.message : String(e);
    }
  }
  debug.user = Boolean(stored?.user);
  debug.authEvent = lastAuthEvent;
  if (error) {
    return {
      handled: true,
      message: `${formatOAuthExchangeError(error)} ${formatOAuthDebugLine(debug)}`,
      session: stored,
      debug,
    };
  }
  if (!stored?.user) {
    return {
      handled: true,
      message: `${formatOAuthExchangeError(new Error('data.session yok'))} ${formatOAuthDebugLine(debug)}`,
      session: null,
      debug,
    };
  }
  return {
    handled: true,
    message: `Google ile giriş başarılı. ${formatOAuthDebugLine(debug)}`,
    session: stored,
    debug,
  };
}

export async function consumeOAuthParams(client: ExchangeClient, params: OAuthCallbackParams): Promise<OAuthConsumeResult> {
  if (!params.code && !params.error) {
    return { handled: false, message: '', session: null, debug: emptyDebug() };
  }
  if (params.code && consumedCode && params.code === consumedCode && consumeOnce) {
    const shared = await consumeOnce;
    return { ...shared, debug: { ...shared.debug, reused: true } };
  }
  if (consumeOnce) {
    const shared = await consumeOnce;
    return { ...shared, debug: { ...shared.debug, reused: true } };
  }
  if (params.code) consumedCode = params.code;
  consumeOnce = completeOAuthCode(client, params);
  return consumeOnce;
}

/** Tek exchange. Query, getSession oturumu doğrulayana kadar durur. */
export async function consumeOAuthRedirect(client: SupabaseClient | null): Promise<OAuthConsumeResult> {
  const params = oauthSearchParams();
  if (!params.code && !params.error) {
    return { handled: false, message: '', session: null, debug: emptyDebug() };
  }
  if (!client) {
    openAccountHashKeepQuery();
    return {
      handled: true,
      message: 'Google girişi bu ortamda yapılandırılmamış. E-posta ile devam et.',
      session: null,
      debug: { ...emptyDebug(), codePresent: Boolean(params.code), codeLength: params.code?.length || 0 },
    };
  }
  const result = await consumeOAuthParams(client, params);
  if (result.session?.user) stripOAuthParamsFromUrl(true);
  else openAccountHashKeepQuery();
  return result;
}

export function resetOAuthConsumeForTests() {
  consumeOnce = null;
  consumedCode = '';
  lastAuthEvent = '';
}
