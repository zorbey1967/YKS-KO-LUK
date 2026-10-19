/**
 * Yeni ödemeler: Shopier imza + GET /orders/{id}.
 * Tarayıcı dönüşü plan yazmaz. Eski iyzico/PayTR dalları inbound uyumluluk için durur.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizePlanId } from "../_shared/billingCatalog.ts";
import {
  applyPaymentRefund,
  applyVerifiedPayment,
  isUniqueViolation,
  recordBillingEvent,
  recordPayment,
} from "../_shared/billingApply.ts";
import { iyzicoPost } from "../_shared/iyzicoAuth.ts";
import { iyzicoReady, paytrReady, shopierNotifyReady, shopierSecrets } from "../_shared/billingProvider.ts";
import { shopierDeleteProduct, shopierGetOrder, shopierOrderIdFromPayload } from "../_shared/shopierApi.ts";
import { shopierRetrievedOrderMatches } from "../_shared/shopierCheckout.ts";
import {
  shopierActivateOk,
  shopierEventHeader,
  shopierRefundedTotal,
  shopierSignatureHeader,
  shopierWebhookAuth,
} from "../_shared/shopierWebhook.ts";
import { type RateStore } from "../_shared/edgeRateLimit.ts";
import { allowDistributed, readUpstashEnv } from "../_shared/upstashRateLimit.ts";
import {
  iyzicoActivateOk,
  paytrActivateOk,
  paytrHashExpected,
  safeEq,
} from "../_shared/billingWebhookGuard.ts";

const webhookBuckets: RateStore = new Map();
const upstash = readUpstashEnv(Deno.env);

function clientIp(req: Request) {
  const xf = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return xf || "unknown";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function paytrRetry(message: string) {
  return new Response(message, { status: 500, headers: { "Content-Type": "text/plain" } });
}

function paytrAck() {
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

function form(text: string) {
  const params = new URLSearchParams(text);
  const o: Record<string, string> = {};
  for (const [k, v] of params.entries()) o[k] = v;
  return o;
}

async function hmacSha256Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Yalnızca POST" }, 405);
  if (!await allowDistributed({
    memory: webhookBuckets,
    key: `wh:${clientIp(req)}`,
    limit: 60,
    windowMs: 60_000,
    upstash,
    fetchImpl: upstash ? fetch : undefined,
  })) {
    return json({ error: "Çok fazla istek" }, 429);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) return json({ error: "Sunucu anahtarı eksik" }, 503);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const ctype = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text();
  const isPaytrForm = ctype.includes("x-www-form-urlencoded") || raw.includes("merchant_oid=");
  const genericSig = (req.headers.get("x-billing-signature") || req.headers.get("x-webhook-signature") || "").trim();
  const shopierHint = Boolean(shopierSignatureHeader(req.headers) || shopierEventHeader(req.headers));
  const shopierJson = !isPaytrForm && !genericSig && (shopierHint || (shopierNotifyReady() && raw.trim().startsWith("{")));

  if (shopierJson) {
    if (!shopierNotifyReady()) {
      return json({ error: "Shopier webhook secret yok; olay işlenmedi." }, 503);
    }
    const secrets = shopierSecrets();
    const signature = shopierSignatureHeader(req.headers);
    const authz = await shopierWebhookAuth(raw, signature, secrets.webhookToken);
    if (!authz.ok) {
      return json({ error: authz.reason === "missing" ? "Shopier imza başlığı yok" : "Shopier imza geçersiz" }, 401);
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json({ error: "JSON değil" }, 400);
    }
    const eventName = shopierEventHeader(req.headers) || String(payload.event || payload.type || "order.created");
    const orderId = shopierOrderIdFromPayload(payload);
    if (!orderId) return json({ error: "siparis_id_yok" }, 400);

    const retrieved = await shopierGetOrder(secrets.pat, orderId);
    if (!retrieved.ok || !retrieved.order) {
      return json({ error: "Shopier sipariş doğrulanamadı" }, 502);
    }
    const order = retrieved.order;
    if (!shopierRetrievedOrderMatches(orderId, order.id)) {
      return json({ ok: true, applied: false, reason: "siparis_id_uyusmuyor" });
    }
    const eventId = `shopier:${order.id}:${eventName}`;

    let session: {
      id: string;
      user_id: string;
      plan_id: string;
      amount_try: number;
      currency?: string;
      provider_session_id?: string;
    } | null = null;
    let productId = "";
    for (const line of order.lineItems) {
      if (!line.productId) continue;
      const found = await admin.from("billing_checkout_sessions")
        .select("id, user_id, plan_id, amount_try, currency, provider_session_id")
        .eq("provider", "shopier")
        .eq("provider_session_id", line.productId)
        .maybeSingle();
      if (found.data) {
        session = found.data as typeof session;
        productId = line.productId;
        break;
      }
    }

    const ev = await recordBillingEvent(admin, {
      provider: "shopier",
      eventId,
      eventType: eventName.slice(0, 80),
      userId: session ? String(session.user_id) : null,
      payload: { orderId: order.id, paymentStatus: order.paymentStatus, event: eventName },
    });
    if (!ev.ok) return json({ error: ev.error }, 500);

    if (/refund/i.test(eventName)) {
      // 050: tam iadede o ödemenin süresi düşülür / erişim kapanır; kısmi iadede erişim değişmez.
      // İade toplamı bildirim gövdesinden değil, GET /orders/{id} ile alınan siparişten okunur.
      const refunded = await applyPaymentRefund(admin, {
        provider: "shopier",
        paymentId: order.id,
        refundedTotalTry: shopierRefundedTotal(order),
      });
      if (!refunded.ok) return json({ error: refunded.error }, 500);
      return json({ ok: true, applied: false, refunded: refunded.applied, revoked: refunded.revoked, reason: refunded.reason });
    }

    if (!session || !productId) {
      return json({ ok: true, applied: false, reason: "urun_oturum_yok" });
    }
    const planId = normalizePlanId(session.plan_id);
    if (!shopierActivateOk({
      planId,
      sessionAmountTry: Number(session.amount_try),
      sessionCurrency: session.currency,
      productId,
      order,
    })) {
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
    if (!applied.duplicatePayment) {
      await shopierDeleteProduct(secrets.pat, productId);
    }
    return json({ ok: true, applied: true, duplicatePayment: applied.duplicatePayment });
  }

  // PayTR bildirim: merchant_oid + merchant_salt + status + total_amount HMAC, yanıt OK.
  if (ctype.includes("x-www-form-urlencoded") || raw.includes("merchant_oid=")) {
    const f = form(raw);
    if (f.merchant_oid && f.hash) {
      if (!paytrReady()) return json({ error: "PayTR secret yok; olay işlenmedi." }, 503);
      const mid = (Deno.env.get("PAYTR_MERCHANT_KEY") || "").trim();
      const salt = (Deno.env.get("PAYTR_MERCHANT_SALT") || "").trim();
      const expected = await paytrHashExpected(mid, f.merchant_oid, salt, f.status, f.total_amount);
      if (!safeEq(expected, f.hash)) return json({ error: "PayTR hash geçersiz" }, 401);
      const { data: session } = await admin.from("billing_checkout_sessions").select("id, user_id, plan_id, amount_try, currency").eq("id", f.merchant_oid).maybeSingle();
      if (!session) {
        // PayTR bilinmeyen merchant_oid için de OK bekler; aksi halde tekrar dener.
        // Üyelik açılmaz.
        return paytrAck();
      }
      const planId = normalizePlanId(session.plan_id);
      const eventId = `paytr:${f.merchant_oid}:${f.status}`;
      const ev = await recordBillingEvent(admin, {
        provider: "paytr",
        eventId,
        eventType: f.status || "unknown",
        userId: String(session.user_id),
        payload: { status: f.status, total_amount: f.total_amount },
      });
      if (!ev.ok) return paytrRetry("event_yazilamadi");
      if (f.status !== "success") {
        const failed = await recordPayment(admin, {
          userId: String(session.user_id),
          checkoutId: String(session.id),
          amountTry: Number(session.amount_try) || 0,
          status: "failed",
          provider: "paytr",
          paymentId: eventId,
        });
        if (failed.error) return paytrRetry("odeme_kaydi_yazilamadi");
        return paytrAck();
      }
      if (!paytrActivateOk({
        planId,
        amountTry: Number(session.amount_try),
        currency: session.currency,
        totalKurus: f.total_amount,
      })) {
        return paytrAck();
      }
      const applied = await applyVerifiedPayment(admin, {
        userId: String(session.user_id),
        checkoutId: String(session.id),
        planId,
        provider: "paytr",
        paymentId: eventId,
        amountTry: Number(session.amount_try),
      });
      if (!applied.ok) return paytrRetry(applied.error || "uyelik_acilamadi");
      return paytrAck();
    }
  }

  // iyzico CF callback: token → CF-Retrieve. Tarayıcı dönüşü tek başına yetmez.
  const maybeForm = form(raw);
  const iyziToken = maybeForm.token || "";
  if (iyziToken && iyzicoReady()) {
    const retrieved = await iyzicoPost("/payment/iyzipos/checkoutform/auth/ecom/detail", {
      locale: "tr",
      conversationId: maybeForm.conversationId || "cb",
      token: iyziToken,
    });
    if (!retrieved.ok) return json({ error: `iyzico retrieve: ${retrieved.error}` }, 502);
    const st = String(retrieved.json.paymentStatus || "");
    const conversationId = String(retrieved.json.conversationId || maybeForm.conversationId || "");
    const paymentId = String(retrieved.json.paymentId || retrieved.json.token || iyziToken);
    const paidPrice = Number(retrieved.json.paidPrice);
    let session: { id: string; user_id: string; plan_id: string; amount_try: number; currency?: string } | null = null;
    if (conversationId) {
      const byConv = await admin.from("billing_checkout_sessions").select("id, user_id, plan_id, amount_try, currency").eq("id", conversationId).maybeSingle();
      session = byConv.data as typeof session;
    }
    if (!session) {
      const byTok = await admin.from("billing_checkout_sessions").select("id, user_id, plan_id, amount_try, currency").eq("provider_session_id", iyziToken).maybeSingle();
      session = byTok.data as typeof session;
    }
    if (!session) return json({ ok: true, applied: false, reason: "oturum_yok" });
    const planId = normalizePlanId(session.plan_id);
    const eventId = `iyzico:${paymentId}`;
    const ev = await recordBillingEvent(admin, {
      provider: "iyzico",
      eventId,
      eventType: st || "unknown",
      userId: String(session.user_id),
      payload: { paymentStatus: st, paymentId, conversationId },
    });
    if (!ev.ok) return json({ error: ev.error }, 500);
    if (st !== "SUCCESS") {
      const failed = await recordPayment(admin, {
        userId: String(session.user_id),
        checkoutId: String(session.id),
        amountTry: Number(session.amount_try) || 0,
        status: st === "FAILURE" ? "failed" : "canceled",
        provider: "iyzico",
        paymentId,
      });
      if (failed.error) return json({ error: failed.error }, 500);
      return json({ ok: true, applied: false, paymentStatus: st });
    }
    if (!planId) return json({ ok: true, applied: false, reason: "paket_yok" });
    const expected = Number(session.amount_try);
    if (!iyzicoActivateOk({
      planId,
      amountTry: expected,
      currency: session.currency,
      paidPrice,
    })) {
      return json({ ok: true, applied: false, reason: "tutar_uyusmuyor" });
    }
    const applied = await applyVerifiedPayment(admin, {
      userId: String(session.user_id),
      checkoutId: String(session.id),
      planId,
      provider: "iyzico",
      paymentId,
      amountTry: expected,
      subscriptionId: paymentId,
    });
    if (!applied.ok) return json({ error: applied.error }, 500);
    return json({ ok: true, applied: true, duplicatePayment: applied.duplicatePayment });
  }

  // Eski jenerik HMAC (sağlayıcı resmi yöntemi değil). Secret yoksa işlenmez.
  const secret = (Deno.env.get("BILLING_WEBHOOK_SECRET") || "").trim();
  if (!secret) {
    return json({ error: "Doğrulanmış sağlayıcı bildirimi yok; üyelik açılmadı." }, 503);
  }
  const given = (req.headers.get("x-billing-signature") || req.headers.get("x-webhook-signature") || "").trim().toLowerCase();
  const expected = await hmacSha256Hex(secret, raw);
  if (!given || !safeEq(given, expected)) return json({ error: "İmza geçersiz" }, 401);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "JSON değil" }, 400);
  }
  const eventId = String(payload.event_id || payload.id || "").slice(0, 120);
  if (!eventId) return json({ error: "event_id yok" }, 400);
  const eventType = String(payload.event_type || payload.type || "unknown").slice(0, 80).toLowerCase();
  const { error: insErr } = await admin.from("billing_events").insert({
    provider: String(payload.provider || "generic").slice(0, 40),
    event_id: eventId,
    event_type: eventType,
    user_id: String(payload.user_id || "") || null,
    payload,
  });
  if (insErr && isUniqueViolation(insErr)) {
    return json({ ok: true, duplicate: true });
  }
  if (insErr) return json({ error: "Olay kaydı yazılamadı" }, 500);
  // Jenerik HMAC ile abonelik açılmaz; yalnızca olay kaydı.
  return json({ ok: true, applied: false, reason: "jenerik_hmac_uyelik_acmaz" });
});
