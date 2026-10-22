import { supabase } from './supabase';
import type { PlanId } from './plans';

/**
 * Hesapsız Shopier ödemesi (istemci). Tarayıcıda yalnız sunucunun verdiği tek kullanımlık anahtar
 * tutulur; plan/tutar/hesap bilgisi istemciden gönderilmez ve istemciye güvenilmez.
 * Hesap ve paket, ödeme Shopier'de doğrulandıktan sonra sunucuda (billing-webhook) oluşur.
 */

export const GUEST_TOKEN_KEY = 'rk_guest_checkout';
export const GUEST_STARTED_EVENT = 'rk-guest-checkout-started';
export const GUEST_EMAIL_DOMAIN = 'misafir.rubikkocluk.invalid';
/** Bekleme ekranının durumu sorma süresi (öğrenci ödeme sayfasında vakit geçirebilir). */
export const GUEST_WAIT_MS = 60 * 60_000;

type Stored = { token: string; planId: PlanId; startedAt: number };

export function readGuestCheckout(): Stored | null {
  try {
    const raw = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (typeof v.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(v.token)) return null;
    if (v.planId !== 'pro' && v.planId !== 'premium') return null;
    return { token: v.token, planId: v.planId, startedAt: Number(v.startedAt) || 0 };
  } catch {
    return null;
  }
}

export function clearGuestCheckout() {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    /* depolama kapalı */
  }
}

function saveGuestCheckout(v: Stored) {
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify(v));
  } catch {
    /* depolama kapalı: bu tarayıcı otomatik giriş yapamaz */
  }
}

export function isGuestAccountEmail(email: string | null | undefined) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

async function invokeGuest(body: Record<string, unknown>) {
  if (!supabase) return { data: null as Record<string, unknown> | null, error: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.functions.invoke('billing-guest', { body });
  const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (error) {
    let msg = '';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = (await ctx.json()) as { error?: unknown };
        msg = String(j?.error || '');
      }
    } catch {
      /* gövde yok */
    }
    return { data: rec, error: msg || 'Ödeme şu an başlatılamadı. Biraz sonra tekrar dene.' };
  }
  return { data: rec, error: '' };
}

/** Giriş yapmadan ödeme: Shopier ödeme adresini döndürür. Fiyat sunucuda katalogdan belirlenir. */
export async function startGuestCheckout(planId: PlanId): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const prev = readGuestCheckout();
  const { data, error } = await invokeGuest({ action: 'start', plan_id: planId, token: prev?.planId === planId ? prev.token : undefined });
  if (error) return { ok: false, error };
  const url = String(data?.checkout_url || '');
  const token = String(data?.token || '');
  if (!data?.ready || !/^https:\/\//.test(url) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { ok: false, error: String(data?.error || 'Ödeme sayfası açılamadı. Üyelik değişmedi.') };
  }
  saveGuestCheckout({ token, planId, startedAt: prev?.token === token ? prev.startedAt : Date.now() });
  try {
    window.dispatchEvent(new Event(GUEST_STARTED_EVENT));
  } catch {
    /* tarayıcı dışı */
  }
  return { ok: true, url };
}

export type GuestClaim = 'none' | 'pending' | 'signed_in' | 'expired' | 'closed' | 'error';

/**
 * Ödeme onaylandıysa bu tarayıcıda oturumu açar. Onaylanmadıysa "pending".
 * Oturum Supabase'in kendi doğrulamasıyla (tek kullanımlık giriş özeti) açılır; parola veya
 * kalıcı gizli bilgi istemciye gelmez.
 */
export async function claimGuestCheckout(): Promise<GuestClaim> {
  const cur = readGuestCheckout();
  if (!cur || !supabase) return 'none';
  const { data, error } = await invokeGuest({ action: 'status', token: cur.token });
  if (error) return 'error';
  const status = String(data?.status || '');
  if (status === 'pending') return 'pending';
  if (status === 'expired' || status === 'closed' || status === 'unknown') {
    clearGuestCheckout();
    return status === 'unknown' ? 'closed' : status;
  }
  if (status !== 'ready') return 'error';
  const tokenHash = String(data?.token_hash || '');
  if (!tokenHash) return 'error';
  const { data: auth, error: authErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (authErr || !auth.session) return 'error';
  clearGuestCheckout();
  return 'signed_in';
}
