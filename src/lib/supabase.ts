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
