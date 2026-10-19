import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { chargeAmountTry, normalizePlanId, type PlanId } from "../_shared/billingCatalog.ts";
import { merchantReady, missingSecretsMessage, shopierSecrets } from "../_shared/billingProvider.ts";
import { recordBillingEvent } from "../_shared/billingApply.ts";
import {
  shopierCreateProduct,
  shopierDeleteProduct,
  shopierGetProduct,
} from "../_shared/shopierApi.ts";
import {
  shopierOrphanEventId,
  shopierReusableSession,
  shopierSessionMapped,
  type ShopierSessionRow,
} from "../_shared/shopierCheckout.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request) {
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return (match?.[1] || "").trim();
}

function productTitle(planId: PlanId) {
  return planId === "premium" ? "Premium üyelik (30 gün)" : "Pro üyelik (30 gün)";
}

async function failOrphan(
  admin: SupabaseClient,
  pat: string,
  sessionId: string,
  productId: string,
  userId: string,
) {
  const del = await shopierDeleteProduct(pat, productId);
  await admin.from("billing_checkout_sessions").update({
    status: "failed",
    updated_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (!del.ok) {
    await recordBillingEvent(admin, {
      provider: "shopier",
      eventId: shopierOrphanEventId(productId, sessionId),
      eventType: "orphan_product",
      userId,
      payload: { productId, sessionId, deleted: false, reason: "map_failed" },
    });
  }
  return del;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Yalnızca POST" }, 405);

  const token = bearerFrom(req);
  if (!token) return json(req, { error: "Oturum gerekli", ready: false }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return json(req, { error: "Sunucu kimlik ayarı eksik", ready: false }, 503);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return json(req, { error: "Geçersiz oturum", ready: false }, 401);

  const { data: activeRpc, error: activeErr } = await supabase.rpc("caller_account_active");
  if (!activeErr && activeRpc !== true) {
    return json(req, { error: "Hesap askıda", ready: false }, 403);
  }

  let body: { plan_id?: string; amount?: unknown; price?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Geçersiz JSON", ready: false }, 400);
  }
  const planId = normalizePlanId(body.plan_id);
  if (!planId) return json(req, { error: "Geçersiz paket", ready: false }, 400);
  if (body.amount != null || body.price != null) {
    return json(req, { error: "Tutar istemciden kabul edilmez.", ready: false }, 400);
  }

  const amountTry = chargeAmountTry(planId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || String(profile.role) !== "student") {
    return json(req, { error: "Yalnızca öğrenci hesabı paket seçebilir.", ready: false, plan_id: planId, amount_try: amountTry }, 403);
  }
  if (String(profile.account_status) !== "active") {
    return json(req, { error: "Hesap onayından sonra üyelik başlatılabilir.", ready: false, plan_id: planId, amount_try: amountTry }, 403);
  }

  const service = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!service) {
    return json(req, {
      ready: false,
      error: "Ödeme oturumu yazılamadı. Üyelik açılmadı.",
      plan_id: planId,
      amount_try: amountTry,
    }, 503);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  if (!merchantReady()) {
    return json(req, {
      ready: false,
      error: missingSecretsMessage(),
      plan_id: planId,
      amount_try: amountTry,
      currency: "TRY",
    }, 503);
  }

  const secrets = shopierSecrets();

  const existing = await admin.from("billing_checkout_sessions")
    .select("id, user_id, plan_id, amount_try, currency, status, provider, provider_session_id, created_at")
    .eq("user_id", auth.user.id)
    .eq("plan_id", planId)
    .eq("provider", "shopier")
    .in("status", ["pending", "redirected"])
    .neq("provider_session_id", "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reuseRow = existing.data as ShopierSessionRow | null;
  if (shopierReusableSession(reuseRow, planId, amountTry)) {
    const reread = await admin.from("billing_checkout_sessions")
      .select("id, plan_id, amount_try, currency, status, provider, provider_session_id, created_at")
      .eq("id", reuseRow!.id)
      .maybeSingle();
    const mapped = reread.data as ShopierSessionRow | null;
    const productId = String(mapped?.provider_session_id || "");
    if (shopierSessionMapped(mapped, productId)) {
      const live = await shopierGetProduct(secrets.pat, productId);
      if (live.ok && live.product && live.product.id === productId) {
        return json(req, {
          ready: true,
          error: "",
          plan_id: planId,
          amount_try: amountTry,
          currency: "TRY",
          provider: "shopier",
          checkout_url: live.product.url,
          checkout_session_id: mapped!.id,
          reused: true,
        });
      }
    }
    await admin.from("billing_checkout_sessions").update({
      status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", reuseRow!.id);
  }

  const { data: session, error: sessErr } = await admin.from("billing_checkout_sessions").insert({
    user_id: auth.user.id,
    plan_id: planId,
    amount_try: amountTry,
    currency: "TRY",
    status: "pending",
    provider: "shopier",
  }).select("id").maybeSingle();
  if (sessErr || !session?.id) {
    return json(req, {
      ready: false,
      error: "Ödeme oturumu kaydedilemedi. Sahte ödeme yok.",
      plan_id: planId,
      amount_try: amountTry,
    }, 503);
  }

  const created = await shopierCreateProduct({
    pat: secrets.pat,
    title: productTitle(planId),
    amountTry,
    imageUrl: secrets.productImageUrl,
  });
  if (!created.ok || !created.product) {
    await admin.from("billing_checkout_sessions").update({
      status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);
    return json(req, {
      ready: false,
      error: "Shopier ürünü oluşturulamadı. Ödeme bağlantısı yok; üyelik açılmadı.",
      plan_id: planId,
      amount_try: amountTry,
    }, 503);
  }

  const mapped = await admin.from("billing_checkout_sessions").update({
    status: "redirected",
    provider: "shopier",
    provider_session_id: created.product.id,
    updated_at: new Date().toISOString(),
  }).eq("id", session.id).eq("status", "pending").select("id, provider, provider_session_id, status").maybeSingle();

  const mappedRow = mapped.data as ShopierSessionRow | null;
  if (mapped.error || !shopierSessionMapped(mappedRow, created.product.id)) {
    const del = await failOrphan(admin, secrets.pat, session.id, created.product.id, auth.user.id);
    return json(req, {
      ready: false,
      error: del.ok
        ? "Checkout ile Shopier ürün eşlemesi yazılamadı. Ödeme bağlantısı yok; üyelik açılmadı."
        : "Ürün eşlemesi yazılamadı ve Shopier ürünü silinemedi. Ödeme bağlantısı yok. Manuel uzlaştırma kaydı oluşturuldu.",
      plan_id: planId,
      amount_try: amountTry,
      reconcile: del.ok ? undefined : "orphan_product",
    }, 503);
  }

  const verified = await admin.from("billing_checkout_sessions")
    .select("id, provider, provider_session_id, status")
    .eq("id", session.id)
    .maybeSingle();
  const verifiedRow = verified.data as ShopierSessionRow | null;
  if (!shopierSessionMapped(verifiedRow, created.product.id)) {
    const del = await failOrphan(admin, secrets.pat, session.id, created.product.id, auth.user.id);
    return json(req, {
      ready: false,
      error: del.ok
        ? "Eşleme doğrulanamadı. Ödeme bağlantısı yok; üyelik açılmadı."
        : "Eşleme doğrulanamadı ve Shopier ürünü silinemedi. Ödeme bağlantısı yok. Manuel uzlaştırma kaydı oluşturuldu.",
      plan_id: planId,
      amount_try: amountTry,
      reconcile: del.ok ? undefined : "orphan_product",
    }, 503);
  }

  const live = await shopierGetProduct(secrets.pat, created.product.id);
  if (!live.ok || !live.product || live.product.id !== created.product.id) {
    const del = await failOrphan(admin, secrets.pat, session.id, created.product.id, auth.user.id);
    return json(req, {
      ready: false,
      error: "Shopier ürün URL’si doğrulanamadı. Ödeme bağlantısı yok; üyelik açılmadı.",
      plan_id: planId,
      amount_try: amountTry,
      reconcile: del.ok ? undefined : "orphan_product",
    }, 503);
  }

  return json(req, {
    ready: true,
    error: "",
    plan_id: planId,
    amount_try: amountTry,
    currency: "TRY",
    provider: "shopier",
    checkout_url: live.product.url,
    checkout_session_id: session.id,
  });
});
