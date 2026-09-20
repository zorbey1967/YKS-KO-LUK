import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
    : null;

/** User-facing text when the Vite-bundled URL/anon key are missing. Never includes secrets. */
export const SUPABASE_UNAVAILABLE =
  'Canlı ortamda Supabase ayarı yok. Giriş ve koç listesi şu an kapalı.';

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

/** Short, secret-free copy. Distinguishes missing config from a failed request. */
export function publicCloudError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/zaman aşımı|timeout|Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) {
    return 'Bağlantı hatası. Ağını kontrol edip yeniden dene.';
  }
  if (/İstek iptal/i.test(msg)) return 'İstek iptal edildi.';
  return 'Bulut isteği tamamlanamadı.';
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
