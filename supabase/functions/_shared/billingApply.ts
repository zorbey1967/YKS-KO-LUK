import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { chargeAmountTry, type PlanId } from "./billingCatalog.ts";

export function periodEndIso(from = new Date()) {
  const d = new Date(from.getTime() + 30 * 86400000);
  return d.toISOString();
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "23505" || /duplicate/i.test(error.message || "");
}

type DbErr = { code?: string; message?: string };

function fail(error: DbErr | null | undefined, fallback: string) {
  return { ok: false as const, error: String(error?.message || fallback) };
}

export async function recordBillingEvent(
  admin: SupabaseClient,
  row: {
    provider: string;
    eventId: string;
    eventType: string;
    userId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("billing_events").insert({
    provider: row.provider,
    event_id: row.eventId,
    event_type: row.eventType,
    user_id: row.userId || null,
    payload: row.payload || {},
  });
  if (!error) return { ok: true as const, duplicate: false };
  if (isUniqueViolation(error)) return { ok: true as const, duplicate: true };
  return fail(error, "Olay kaydı yazılamadı");
}

export async function recordPayment(
  admin: SupabaseClient,
  row: {
    userId: string;
    checkoutId?: string | null;
    amountTry: number;
    status: "pending" | "succeeded" | "failed" | "canceled" | "refunded";
    provider: string;
    paymentId: string;
  },
) {
  const { error } = await admin.from("billing_payments").insert({
    user_id: row.userId,
    checkout_session_id: row.checkoutId || null,
    amount_try: row.amountTry,
    currency: "TRY",
    status: row.status,
    provider: row.provider,
    provider_payment_id: row.paymentId,
  });
  if (!error) return { duplicate: false as const };
  if (isUniqueViolation(error)) return { duplicate: true as const };
  return { duplicate: false as const, error: error.message };
}

/**
 * Önce 016 tabloları, sonra profil. Tablo yoksa veya yazma kırılırsa üyelik açılmaz.
 * Tekrar çağrı güvenli (upsert + aynı profil alanları).
 */
export async function activatePaid(
  admin: SupabaseClient,
  opts: {
    userId: string;
    planId: PlanId;
    provider: string;
    checkoutId?: string | null;
    customerId?: string;
    subscriptionId?: string;
    amountTry: number;
    periodEnd?: string | null;
    /** false: mevcut period_end korunur (aynı payment_id tekrarı süre uzatmaz). */
    extendPeriod?: boolean;
  },
) {
  let ends = opts.periodEnd || periodEndIso();
  let periodStart = new Date().toISOString();
  if (opts.extendPeriod === false) {
    const existing = await admin.from("billing_subscriptions").select("period_end, period_start").eq("user_id", opts.userId).maybeSingle();
    const kept = existing.data && typeof existing.data === "object"
      ? (existing.data as { period_end?: string | null; period_start?: string | null })
      : null;
    if (kept?.period_end) {
      ends = String(kept.period_end);
      if (kept.period_start) periodStart = String(kept.period_start);
    }
  }
  const locked = opts.amountTry || chargeAmountTry(opts.planId);
  const sub = await admin.from("billing_subscriptions").upsert({
    user_id: opts.userId,
    plan_id: opts.planId,
    status: "active",
    period_start: periodStart,
    period_end: ends,
    provider: opts.provider,
    provider_subscription_id: opts.subscriptionId || "",
    locked_amount_try: locked,
    currency: "TRY",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (sub.error) return fail(sub.error, "Abonelik kaydı yazılamadı");

  if (opts.checkoutId) {
    const paid = await admin.from("billing_checkout_sessions").update({
      status: "paid",
      updated_at: new Date().toISOString(),
    }).eq("id", opts.checkoutId);
    if (paid.error) return fail(paid.error, "Ödeme oturumu güncellenemedi");
  }

  const { error } = await admin.from("profiles").update({
    plan: opts.planId,
    subscription_status: "active",
    subscription_started_at: periodStart,
    subscription_ends_at: ends,
    billing_provider: opts.provider,
    provider_customer_id: opts.customerId || "",
    provider_subscription_id: opts.subscriptionId || "",
  }).eq("id", opts.userId).eq("role", "student");
  if (error) return fail(error, "Üyelik yazılamadı");
  return { ok: true as const };
}

/** Atomik RPC zorunlu. Çok adımlı yola sessiz düşülmez (kısmi üyelik riski). Webhook 500 → sağlayıcı tekrar dener. */
export async function applyVerifiedPayment(
  admin: SupabaseClient,
  row: {
    userId: string;
    checkoutId?: string | null;
    planId: PlanId;
    provider: string;
    paymentId: string;
    amountTry: number;
    subscriptionId?: string;
  },
) {
  if (typeof admin.rpc !== "function") {
    return { ok: false as const, error: "atomik ödeme RPC yok" };
  }
  const rpc = await admin.rpc("apply_verified_payment", {
    p_user_id: row.userId,
    p_plan_id: row.planId,
    p_provider: row.provider,
    p_payment_id: row.paymentId,
    p_amount_try: row.amountTry,
    p_checkout_id: row.checkoutId || null,
    p_subscription_id: row.subscriptionId || row.paymentId,
  });
  if (rpc.error) return { ok: false as const, error: rpc.error.message || "atomik ödeme RPC yok" };
  const data = rpc.data && typeof rpc.data === "object"
    ? rpc.data as { ok?: boolean; duplicate_payment?: boolean }
    : {};
  if (data.ok === false) return { ok: false as const, error: "üyelik yazılamadı" };
  return { ok: true as const, duplicatePayment: Boolean(data.duplicate_payment) };
}

/**
 * İade (050 apply_payment_refund, atomik). Tam iadede o ödemenin kapsadığı süre düşülür;
 * kalan süre yoksa erişim kapanır. Kısmi iadede erişim değişmez (reason=kismi_iade).
 * RPC yoksa veya hata verirse ok:false döner; webhook 500 verir ve sağlayıcı tekrar dener
 * (sessizce "yalnız kayıt" yoluna düşülmez).
 */
export async function applyPaymentRefund(
  admin: SupabaseClient,
  row: { provider: string; paymentId: string; refundedTotalTry: number },
) {
  if (typeof admin.rpc !== "function") return { ok: false as const, error: "iade RPC yok" };
  const rpc = await admin.rpc("apply_payment_refund", {
    p_provider: row.provider,
    p_payment_id: row.paymentId,
    p_refunded_total: Number.isFinite(row.refundedTotalTry) ? row.refundedTotalTry : 0,
  });
  if (rpc.error) return { ok: false as const, error: rpc.error.message || "iade RPC yok" };
  const data = rpc.data && typeof rpc.data === "object"
    ? rpc.data as { ok?: boolean; applied?: boolean; revoked?: boolean; reason?: string }
    : {};
  if (data.ok === false) return { ok: false as const, error: "iade yazılamadı" };
  return {
    ok: true as const,
    applied: Boolean(data.applied),
    revoked: Boolean(data.revoked),
    reason: String(data.reason || ""),
  };
}
