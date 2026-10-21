/**
 * Vercel /api/shopier/webhook çekirdeği. Supabase billing-webhook'taki Shopier dalıyla aynı sıra:
 * imza → GET /orders/{id} → oturum eşleme → olay kaydı → iade veya apply_verified_payment.
 * Yalnız supabase/functions/_shared yardımcıları kullanılır; imza biçimi orada tanımlıdır.
 * Gövde, imza, token ve PAT loglanmaz.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlanId } from "../../supabase/functions/_shared/billingCatalog.ts";
import {
  applyPaymentRefund,
  applyVerifiedPayment,
  recordBillingEvent,
} from "../../supabase/functions/_shared/billingApply.ts";
import type { RateStore } from "../../supabase/functions/_shared/edgeRateLimit.ts";
import {
  readShopierSecrets,
  shopierDeleteProduct,
  shopierGetOrder,
  shopierOrderIdFromPayload,
  shopierWebhookReady,
} from "../../supabase/functions/_shared/shopierApi.ts";
import { shopierRetrievedOrderMatches } from "../../supabase/functions/_shared/shopierCheckout.ts";
import {
  shopierActivateOk,
  shopierEventHeader,
  shopierRefundedTotal,
  shopierSignatureHeader,
  shopierWebhookAuth,
} from "../../supabase/functions/_shared/shopierWebhook.ts";
import { allowDistributed, readUpstashEnv } from "../../supabase/functions/_shared/upstashRateLimit.ts";

export const MAX_BODY_BYTES = 256 * 1024;
/** Shopier 5 sn içinde 200 bekler; süre aşılırsa 503 döner ve Shopier tekrar dener (işlem idempotent). */
export const RESPONSE_DEADLINE_MS = 4500;

export type ShopierWebhookDeps = {
  env: (name: string) => string | undefined;
  createAdmin: (url: string, serviceKey: string) => SupabaseClient;
  memory?: RateStore;
  deadlineMs?: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  amount_try: number;
  currency?: string;
  provider_session_id?: string;
};

const defaultMemory: RateStore = new Map();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function asRecord(v: unknown) {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function idValue(v: unknown) {
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return String(v);
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(s) ? s : "";
}

/**
 * Sipariş kimliği. Açık sipariş alanları (`data.orderId`, `data.order.id`, `orderId`, `order.id`, `order_id`)
 * önce gelir. İade olaylarında kök `id` / `data.id` iade kimliği olabileceği için kullanılmaz; açık alan
 * yoksa boş döner (yanlış kimlikle sipariş sorgulanmaz). Sipariş olaylarında Order gövdesinin kendi `id`'si geçerlidir.
 */
export function shopierWebhookOrderId(payload: unknown, eventName: string) {
  const rec = asRecord(payload);
  if (!rec) return "";
  const data = asRecord(rec.data);
  const explicit = [
    data?.orderId,
    asRecord(data?.order)?.id,
    data?.order_id,
    rec.orderId,
    asRecord(rec.order)?.id,
    rec.order_id,
  ].map(idValue).find(Boolean);
  if (explicit) return explicit;
  if (/refund/i.test(eventName)) return "";
  return idValue(shopierOrderIdFromPayload(payload));
}

function clientIp(req: Request) {
  const xf = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return xf || (req.headers.get("x-real-ip") || "").trim() || "unknown";
}

async function processShopierWebhook(req: Request, deps: ShopierWebhookDeps): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Yalnızca POST" }, 405);

  const upstash = readUpstashEnv({ get: deps.env });
  if (!await allowDistributed({
    memory: deps.memory ?? defaultMemory,
    key: `vwh:${clientIp(req)}`,
    limit: 60,
    windowMs: 60_000,
    upstash,
    fetchImpl: upstash ? fetch : undefined,
  })) {
    return json({ error: "Çok fazla istek" }, 429);
  }

  const url = String(deps.env("SUPABASE_URL") || deps.env("VITE_SUPABASE_URL") || "").trim();
  const service = String(deps.env("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!url || !service) return json({ error: "Sunucu anahtarı eksik" }, 503);
  const secrets = readShopierSecrets(deps.env);
  if (!shopierWebhookReady(secrets)) {
    return json({ error: "Shopier webhook secret yok; olay işlenmedi." }, 503);
  }

  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "Gövde çok büyük" }, 413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Gövde çok büyük" }, 413);

  const authz = await shopierWebhookAuth(raw, shopierSignatureHeader(req.headers), secrets.webhookToken);
  if (!authz.ok) {
    return json({ error: authz.reason === "missing" ? "Shopier imza başlığı yok" : "Shopier imza geçersiz" }, 401);
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = asRecord(JSON.parse(raw));
  } catch {
    payload = null;
  }
  if (!payload) return json({ error: "JSON değil" }, 400);
  // Shopier-Event imza kapsamında değil: yalnız etiket; olay kimliğine sınırlı karakterle yazılır.
  const eventName = String(shopierEventHeader(req.headers) || payload.event || payload.type || "order.created")
    .trim().slice(0, 64).replace(/[^A-Za-z0-9._-]/g, "_") || "order.created";
  const orderId = shopierWebhookOrderId(payload, eventName);
  if (!orderId) return json({ error: "siparis_id_yok" }, 400);

  const retrieved = await shopierGetOrder(secrets.pat, orderId);
  if (!retrieved.ok || !retrieved.order) return json({ error: "Shopier sipariş doğrulanamadı" }, 502);
  const order = retrieved.order;
  if (!shopierRetrievedOrderMatches(orderId, order.id)) {
    return json({ ok: true, applied: false, reason: "siparis_id_uyusmuyor" });
  }

  const admin = deps.createAdmin(url, service);
  let session: SessionRow | null = null;
  let productId = "";
  for (const line of order.lineItems) {
    if (!line.productId) continue;
    const found = await admin.from("billing_checkout_sessions")
      .select("id, user_id, plan_id, amount_try, currency, provider_session_id")
      .eq("provider", "shopier")
      .eq("provider_session_id", line.productId)
      .maybeSingle();
    // Okuma hatasında 200 dönülürse Shopier tekrar denemez ve ödeme kaybolur.
    if (found.error) return json({ error: "Ödeme oturumu okunamadı" }, 500);
    if (found.data) {
      session = found.data as SessionRow;
      productId = line.productId;
      break;
    }
  }

  const ev = await recordBillingEvent(admin, {
    provider: "shopier",
    eventId: `shopier:${order.id}:${eventName}`,
    eventType: eventName.slice(0, 80),
    userId: session ? String(session.user_id) : null,
    payload: { orderId: order.id, paymentStatus: order.paymentStatus, event: eventName, via: "vercel" },
  });
  if (!ev.ok) return json({ error: ev.error }, 500);

  const refundedTotal = shopierRefundedTotal(order);
  if (refundedTotal > 0.009) {
    const refunded = await applyPaymentRefund(admin, {
      provider: "shopier",
      paymentId: order.id,
      refundedTotalTry: refundedTotal,
    });
    if (!refunded.ok) return json({ error: refunded.error }, 500);
    return json({ ok: true, applied: false, refunded: refunded.applied, revoked: refunded.revoked, reason: refunded.reason });
  }
  if (/refund/i.test(eventName)) {
    return json({ ok: true, applied: false, refunded: false, reason: "iade_tamamlanmadi" });
  }

  if (!session || !productId) return json({ ok: true, applied: false, reason: "urun_oturum_yok" });
  const planId = normalizePlanId(session.plan_id);
  if (!shopierActivateOk({
    planId,
    sessionAmountTry: Number(session.amount_try),
    sessionCurrency: session.currency,
    productId,
    order,
  }) || !planId) {
    return json({ ok: true, applied: false, reason: "siparis_dogrulanamadi" });
  }

  const applied = await applyVerifiedPayment(admin, {
    userId: String(session.user_id),
    checkoutId: String(session.id),
    planId,
    provider: "shopier",
    paymentId: order.id,
    amountTry: Number(session.amount_try),
    subscriptionId: order.id,
  });
  if (!applied.ok) return json({ error: applied.error }, 500);
  if (applied.latePayment) {
    await recordBillingEvent(admin, {
      provider: "shopier",
      eventId: `shopier:${order.id}:late_payment`,
      eventType: "late_payment_review",
      userId: String(session.user_id),
      payload: { orderId: order.id, planId, reason: "daha_yeni_aktif_plan_korundu" },
    });
  }
  if (!applied.duplicatePayment) await shopierDeleteProduct(secrets.pat, productId);
  return json({
    ok: true,
    applied: !applied.duplicatePayment && !applied.latePayment,
    duplicatePayment: applied.duplicatePayment,
    latePayment: applied.latePayment,
  });
}

export async function handleShopierWebhook(req: Request, deps: ShopierWebhookDeps): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<Response>((resolve) => {
    timer = setTimeout(() => resolve(json({ error: "zaman_asimi" }, 503)), deps.deadlineMs ?? RESPONSE_DEADLINE_MS);
  });
  try {
    return await Promise.race([
      processShopierWebhook(req, deps).catch(() => json({ error: "islenemedi" }, 500)),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
