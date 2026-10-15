import { supabase } from './supabase';
import { chargeAmountTry, normalizePlanId, type PlanId } from './plans';

export type CheckoutResult = {
  ready: boolean;
  error: string;
  plan_id?: PlanId;
  amount_try?: number;
  checkout_url?: string;
};

export type PaymentRow = {
  id: string;
  amountTry: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string;
  createdAt: string;
};

export type CancelResult = { ok: boolean; error: string };

/** Shopier checkout; PAT yoksa sahte başarı dönmez. Tutar sunucuda kilitlenir. */
export async function requestCheckout(planId: PlanId): Promise<CheckoutResult> {
  if (!supabase) {
    return { ready: false, error: 'Sunucu bağlantısı yok.', plan_id: planId, amount_try: chargeAmountTry(planId) };
  }
  const { data, error } = await supabase.functions.invoke('billing-checkout', {
    body: { plan_id: planId },
  });
  const body = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  const serverPlan = normalizePlanId(body.plan_id) || planId;
  const amount = Number(body.amount_try);
  let msg = String(body.error || error?.message || 'Ödeme sistemi hazırlanıyor.');
  if (/failed to send|edge function|not found|404/i.test(msg)) {
    msg = 'Ödeme sistemi hazırlanıyor. Checkout fonksiyonu henüz yayınlanmadı; sahte ödeme yok.';
  }
  const checkoutUrl = String(body.checkout_url || '');
  return {
    ready: Boolean(body.ready) && Boolean(checkoutUrl),
    error: msg,
    plan_id: serverPlan,
    amount_try: Number.isFinite(amount) ? amount : chargeAmountTry(serverPlan),
    checkout_url: checkoutUrl || undefined,
  };
}

export async function listMyPayments(): Promise<{ rows: PaymentRow[]; available: boolean }> {
  if (!supabase) return { rows: [], available: false };
  try {
    const { data, error } = await supabase
      .from('billing_payments')
      .select('id, amount_try, currency, status, provider, provider_payment_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { rows: [], available: false };
    return {
      available: true,
      rows: (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        amountTry: Number(r.amount_try) || 0,
        currency: String(r.currency || 'TRY'),
        status: String(r.status || ''),
        provider: String(r.provider || ''),
        providerPaymentId: String(r.provider_payment_id || ''),
        createdAt: String(r.created_at || ''),
      })),
    };
  } catch {
    return { rows: [], available: false };
  }
}

export async function requestCancel(): Promise<CancelResult> {
  if (!supabase) return { ok: false, error: 'Sunucu bağlantısı yok.' };
  try {
    const { data, error } = await supabase.rpc('request_subscription_cancel');
    if (error) {
      if (/does not exist|schema cache|42883/i.test(error.message || '')) {
        return { ok: false, error: 'İptal kaydı bu ortamda yok. Sahte iptal oluşturulmadı.' };
      }
      return { ok: false, error: error.message || 'İptal isteği gönderilemedi.' };
    }
    const rec = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    if (rec.ok === false) return { ok: false, error: String(rec.error || 'İptal isteği reddedildi.') };
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'İptal isteği gönderilemedi.' };
  }
}

export function paymentStatusLabel(status: string) {
  const s = status.toLowerCase();
  if (s === 'succeeded' || s === 'paid') return 'Başarılı';
  if (s === 'pending') return 'Bekliyor';
  if (s === 'failed') return 'Başarısız';
  if (s === 'canceled' || s === 'cancelled') return 'İptal';
  if (s === 'refunded') return 'İade';
  return status || '—';
}
