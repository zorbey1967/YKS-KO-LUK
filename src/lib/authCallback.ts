import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { publicAuthError } from './authUi';

export function readOAuthCallback(search: string, hash: string) {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashQuery = hash.includes('?')
    ? new URLSearchParams(hash.slice(hash.indexOf('?') + 1))
    : new URLSearchParams();
  const get = (key: string) => query.get(key) || hashQuery.get(key);
  return {
    code: get('code'),
    error: get('error') || get('error_code'),
    errorDescription: get('error_description'),
  };
}

function oauthSearchParams() {
  return readOAuthCallback(location.search, location.hash);
}

/** Query’deki PKCE code hash rotasına taşınmaz. Callback sonrası hesap sayfası. */
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

export function formatOAuthExchangeError(err: unknown) {
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message || err || '');
  const mapped = publicAuthError(err instanceof Error ? err : new Error(raw));
  if (raw && mapped && mapped !== raw) return `${mapped} (${raw})`;
  return raw || mapped || 'Google oturumu kurulamadı.';
}

type ExchangeClient = {
  auth: {
    exchangeCodeForSession: (code: string) => PromiseLike<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
  };
};

export async function completeOAuthCode(client: ExchangeClient, params: ReturnType<typeof readOAuthCallback>) {
  if (!params.code && !params.error) return { handled: false as const, message: '', session: null as Session | null };
  if (params.error) {
    return {
      handled: true as const,
      message: formatOAuthExchangeError(new Error(params.errorDescription || params.error)),
      session: null as Session | null,
    };
  }
  const { data, error } = await client.auth.exchangeCodeForSession(String(params.code));
  if (error) {
    return { handled: true as const, message: formatOAuthExchangeError(error), session: null as Session | null };
  }
  if (!data.session?.user) {
    return {
      handled: true as const,
      message: formatOAuthExchangeError(new Error('data.session yok')),
      session: null as Session | null,
    };
  }
  return { handled: true as const, message: 'Google ile giriş başarılı.', session: data.session };
}

/** PKCE `?code=` hash’e kopyalanmaz. Kod bir kez exchange edilir (detectSessionInUrl kapalı). */
export async function consumeOAuthRedirect(client: SupabaseClient | null) {
  const params = oauthSearchParams();
  if (!params.code && !params.error) return { handled: false, message: '', session: null as Session | null };
  if (!client) {
    stripOAuthParamsFromUrl(true);
    return { handled: true, message: 'Google girişi bu ortamda yapılandırılmamış. E-posta ile devam et.', session: null };
  }
  const result = await completeOAuthCode(client, params);
  stripOAuthParamsFromUrl(true);
  return result;
}
