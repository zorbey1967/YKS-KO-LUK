import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function supabaseUrlOk(u: string) {
  if (!u) return false;
  try {
    const x = new URL(u);
    if (x.protocol === 'https:' && (x.hostname.endsWith('.supabase.co') || x.hostname === 'localhost')) return true;
    if (import.meta.env.DEV && (x.hostname === 'localhost' || x.hostname === '127.0.0.1') && (x.protocol === 'http:' || x.protocol === 'https:')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const supabaseUrl = (() => {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return supabaseUrlOk(raw) ? raw : '';
})();
export const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
    : null;

/** User-facing text when the Vite-bundled URL/anon key are missing. Never includes secrets. */
export const SUPABASE_UNAVAILABLE =
  'Canlı ortamda Supabase ayarı yok. Giriş ve koç listesi şu an kapalı.';

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

export const SESSION_REQUIRED = 'Oturumunuz geçerli değil. Lütfen tekrar giriş yapın.';

function sessionNeedsRefresh(expiresAt: number | undefined) {
  if (!expiresAt) return true;
  return expiresAt * 1000 < Date.now() + 90_000;
}

/** RPC öncesi kullanıcı JWT’si; yoksa anon çağrı yapma. */
export async function requireUserSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Bulut ayarı yok.' };
  const read = async () => (await supabase.auth.getSession()).data.session;
  let session = await read();
  if (!session?.access_token || sessionNeedsRefresh(session.expires_at)) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) session = data.session;
    else session = await read();
  }
  if (!session?.access_token) return { ok: false, error: SESSION_REQUIRED };
  return { ok: true };
}

/** Short, secret-free copy. Distinguishes missing config from a failed request. */
export function publicCloudError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/zaman aşımı|timeout|Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) {
    return 'Bağlantı hatası. Ağını kontrol edip yeniden dene.';
  }
  if (/İstek iptal/i.test(msg)) return 'İstek iptal edildi.';
  return 'İşlem şu anda gerçekleştirilemedi. Tekrar deneyin.';
}

export function withTimeout<T>(p: PromiseLike<T>, ms = 12000, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('İstek zaman aşımına uğradı.')), ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('İstek iptal edildi.'));
    };
    if (signal?.aborted) {
      clearTimeout(t);
      reject(new Error('İstek iptal edildi.'));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(p).then((v) => {
      clearTimeout(t);
      resolve(v);
    }, (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
