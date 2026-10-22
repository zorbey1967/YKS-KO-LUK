/**
 * Hesapsız Shopier ödemesi (giriş yapmadan "Ödeme Yap").
 *
 *   POST { action: "start", plan_id }   → { ready, checkout_url, token }
 *   POST { action: "status", token }    → { status: "pending" | "ready" | "expired" | "closed" | "unknown", token_hash? }
 *
 * Fiyat ve plan katalogdan gelir; istemci tutarı reddedilir. Hesap ve paket yalnız billing-webhook
 * Shopier siparişini doğruladıktan sonra oluşur. "status" yalnız ödemesi doğrulanmış ve bu tarayıcının
 * anahtarına bağlı hesap için tek kullanımlık giriş özeti (magic link hashed_token) döndürür.
 * verify_jwt = false (giriş yok); kötüye kullanıma karşı IP hız sınırı.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { chargeAmountTry, normalizePlanId, type PlanId } from "../_shared/billingCatalog.ts";
import { merchantReady, missingSecretsMessage, shopierSecrets } from "../_shared/billingProvider.ts";
import { shopierCreateProduct, shopierDeleteProduct, shopierGetProduct } from "../_shared/shopierApi.ts";
import { type RateStore } from "../_shared/edgeRateLimit.ts";
import { allowDistributed, readUpstashEnv } from "../_shared/upstashRateLimit.ts";
import {
  claimGuestLogin,
  claimTokenHash,
  claimTokenShapeOk,
  GUEST_COLUMNS,
  guestReusable,
  newClaimToken,
  type GuestRow,
} from "../_shared/guestCheckout.ts";

const buckets: RateStore = new Map();
const upstash = readUpstashEnv(Deno.env);

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

function productTitle(planId: PlanId) {
  return planId === "premium" ? "Premium üyelik (30 gün)" : "Pro üyelik (30 gün)";
}

async function limited(key: string, limit: number, windowMs: number) {
  return !await allowDistributed({ memory: buckets, key, limit, windowMs, upstash, fetchImpl: upstash ? fetch : undefined });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Yalnızca POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!url || !service) return json(req, { error: "Ödeme sistemi şu an hazır değil." }, 503);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { action?: unknown; plan_id?: unknown; token?: unknown; amount?: unknown; price?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Geçersiz istek" }, 400);
  }
  const ip = clientIp(req);

  if (body.action === "status") {
    if (await limited(`gs:${ip}`, 60, 60_000)) return json(req, { error: "Çok fazla istek" }, 429);
    if (!claimTokenShapeOk(body.token)) return json(req, { status: "unknown" });
    const hash = await claimTokenHash(String(body.token));
    const { data } = await admin.from("billing_guest_checkouts").select(GUEST_COLUMNS).eq("claim_token_hash", hash).maybeSingle();
    const row = data as GuestRow | null;
    if (!row) return json(req, { status: "unknown" });
    const claim = await claimGuestLogin(admin, row);
    if (!claim.ok) {
      if (claim.status === "error") return json(req, { error: "Giriş hazırlanamadı. Biraz sonra tekrar dene." }, 503);
      return json(req, { status: claim.status });
    }
    return json(req, { status: "ready", token_hash: claim.tokenHash, plan_id: row.plan_id });
  }

  if (body.action !== "start") return json(req, { error: "Geçersiz işlem" }, 400);
  if (body.amount != null || body.price != null) return json(req, { error: "Tutar istemciden kabul edilmez." }, 400);
  const planId = normalizePlanId(body.plan_id);
  if (!planId) return json(req, { error: "Geçersiz paket" }, 400);
  if (await limited(`gc:${ip}`, 6, 10 * 60_000)) {
    return json(req, { error: "Çok fazla ödeme denemesi. Birkaç dakika sonra tekrar dene." }, 429);
  }
  if (!merchantReady()) return json(req, { ready: false, error: missingSecretsMessage() }, 503);
  const secrets = shopierSecrets();
  const amountTry = chargeAmountTry(planId);

  // Aynı tarayıcı ödenmemiş linkini tekrar isterse yeni ürün açılmaz.
  if (claimTokenShapeOk(body.token)) {
    const hash = await claimTokenHash(String(body.token));
    const { data } = await admin.from("billing_guest_checkouts").select(GUEST_COLUMNS).eq("claim_token_hash", hash).maybeSingle();
    const row = data as GuestRow | null;
    if (row && guestReusable(row, planId) && Math.abs(Number(row.amount_try) - amountTry) < 0.009) {
      const live = await shopierGetProduct(secrets.pat, row.provider_session_id);
      if (live.ok && live.product && live.product.id === row.provider_session_id) {
        return json(req, { ready: true, checkout_url: live.product.url, token: String(body.token), plan_id: planId, amount_try: amountTry, reused: true });
      }
    }
  }

  const token = newClaimToken();
  const { data: inserted, error: insErr } = await admin.from("billing_guest_checkouts").insert({
    plan_id: planId,
    amount_try: amountTry,
    currency: "TRY",
    status: "pending",
    provider: "shopier",
    claim_token_hash: await claimTokenHash(token),
  }).select("id").maybeSingle();
  if (insErr || !inserted?.id) return json(req, { ready: false, error: "Ödeme başlatılamadı. Üyelik açılmadı." }, 503);
  const guestId = String(inserted.id);

  const fail = async (productId?: string) => {
    if (productId) await shopierDeleteProduct(secrets.pat, productId);
    await admin.from("billing_guest_checkouts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", guestId);
  };

  const created = await shopierCreateProduct({
    pat: secrets.pat,
    title: productTitle(planId),
    amountTry,
    imageUrl: secrets.productImageUrl,
  });
  if (!created.ok || !created.product) {
    await fail();
    return json(req, { ready: false, error: "Ödeme sayfası açılamadı. Üyelik açılmadı." }, 503);
  }
  const productId = created.product.id;
  const mapped = await admin.from("billing_guest_checkouts").update({
    status: "redirected",
    provider_session_id: productId,
    updated_at: new Date().toISOString(),
  }).eq("id", guestId).eq("status", "pending").select("provider_session_id").maybeSingle();
  if (mapped.error || String(mapped.data?.provider_session_id || "") !== productId) {
    await fail(productId);
    return json(req, { ready: false, error: "Ödeme eşlemesi yazılamadı. Üyelik açılmadı." }, 503);
  }
  const live = await shopierGetProduct(secrets.pat, productId);
  if (!live.ok || !live.product || live.product.id !== productId) {
    await fail(productId);
    return json(req, { ready: false, error: "Ödeme sayfası doğrulanamadı. Üyelik açılmadı." }, 503);
  }
  return json(req, { ready: true, checkout_url: live.product.url, token, plan_id: planId, amount_try: amountTry });
});
