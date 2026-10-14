import type { SupabaseClient } from '@supabase/supabase-js';
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

export function stripOAuthParamsFromUrl() {
  const url = new URL(location.href);
  ['code', 'state', 'error', 'error_description', 'error_code'].forEach((k) => url.searchParams.delete(k));
  if (url.hash.includes('?')) {
    const [path, q] = url.hash.split('?');
    const hp = new URLSearchParams(q);
    ['code', 'state', 'error', 'error_description', 'error_code', 'oauth'].forEach((k) => hp.delete(k));
    const next = hp.toString();
    url.hash = next ? `${path}?${next}` : path;
  }
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** PKCE `?code=` hash rotasına taşınmaz; oturum kurulunca query temizlenir. */
export async function consumeOAuthRedirect(client: SupabaseClient | null) {
  const params = oauthSearchParams();
  if (!params.code && !params.error) return { handled: false, message: '' };
  if (!client) {
    stripOAuthParamsFromUrl();
    return { handled: true, message: 'Google girişi bu ortamda yapılandırılmamış. E-posta ile devam et.' };
  }
  if (params.error) {
    stripOAuthParamsFromUrl();
    return { handled: true, message: publicAuthError(new Error(params.errorDescription || params.error)) };
  }
  const { data: existing } = await client.auth.getSession();
  if (existing.session?.user) {
    stripOAuthParamsFromUrl();
    return { handled: true, message: 'Google ile giriş başarılı.' };
  }
  const { error } = await client.auth.exchangeCodeForSession(String(params.code));
  stripOAuthParamsFromUrl();
  if (error) return { handled: true, message: publicAuthError(error) };
  return { handled: true, message: 'Google ile giriş başarılı.' };
}
