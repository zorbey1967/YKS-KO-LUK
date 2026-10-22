/**
 * Resmi Shopier REST: https://api.shopier.com/v1
 * Checkout = PAT ile ürün oluşturma (POST /products). Hosted-checkout / merchant order id yok.
 * Sipariş doğrulama = GET /orders/{id}. PAT loglanmaz.
 */

export const SHOPIER_API_BASE = "https://api.shopier.com/v1";

export type ShopierSecrets = {
  pat: string;
  webhookToken: string;
  productImageUrl: string;
};

export function readShopierSecrets(getEnv: (key: string) => string | undefined): ShopierSecrets {
  return {
    pat: String(getEnv("SHOPIER_PAT") || "").trim(),
    webhookToken: String(getEnv("SHOPIER_WEBHOOK_TOKEN") || "").trim(),
    productImageUrl: String(getEnv("SHOPIER_PRODUCT_IMAGE_URL") || "").trim(),
  };
}

export function shopierCheckoutReady(s: ShopierSecrets) {
  return Boolean(s.pat && s.productImageUrl.startsWith("https://"));
}

export function shopierWebhookReady(s: ShopierSecrets) {
  return Boolean(s.pat && s.webhookToken);
}

export type ShopierProduct = {
  id: string;
  url: string;
};

export type ShopierLineItem = {
  productId: string;
  quantity: number;
  price: number;
  total: number;
};

export type ShopierRefund = {
  status: string;
  total: number;
};

export type ShopierOrder = {
  id: string;
  paymentStatus: string;
  currency: string;
  total: number;
  lineItems: ShopierLineItem[];
  refunds: ShopierRefund[];
};

function moneyNumber(raw: unknown) {
  const n = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function parseShopierProduct(json: unknown): ShopierProduct | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const id = String(rec.id || "").trim();
  const url = String(rec.url || "").trim();
  if (!id || !url.startsWith("https://")) return null;
  return { id, url };
}

export function parseShopierOrder(json: unknown): ShopierOrder | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const id = String(rec.id || "").trim();
  if (!id) return null;
  const totals = rec.totals && typeof rec.totals === "object"
    ? rec.totals as Record<string, unknown>
    : {};
  const lines = Array.isArray(rec.lineItems) ? rec.lineItems : [];
  const refunds = Array.isArray(rec.refunds) ? rec.refunds : [];
  return {
    id,
    paymentStatus: String(rec.paymentStatus || "").trim().toLowerCase(),
    currency: String(rec.currency || "").trim().toUpperCase(),
    total: moneyNumber(totals.total),
    lineItems: lines.map((row) => {
      const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
      return {
        productId: String(item.productId || "").trim(),
        quantity: Number(item.quantity) || 0,
        price: moneyNumber(item.price),
        total: moneyNumber(item.total),
      };
    }),
    refunds: refunds.map((row) => {
      const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
      return {
        status: String(item.status || "").trim().toLowerCase(),
        total: moneyNumber(item.total),
      };
    }),
  };
}

/**
 * Webhook gövdesinden sipariş id. Tutar/öğrenci buradan alınmaz.
 * Zarf (`data.id` / `order.id`) kök `id`'den önce gelir; kök webhook id olabilir.
 */
export function shopierOrderIdFromPayload(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const rec = payload as Record<string, unknown>;
  const nested = rec.data && typeof rec.data === "object" ? rec.data as Record<string, unknown> : null;
  const order = rec.order && typeof rec.order === "object" ? rec.order as Record<string, unknown> : null;
  const nestedId = String(nested?.id || order?.id || rec.orderId || rec.order_id || "").trim();
  if (nestedId) return nestedId;
  const rootId = String(rec.id || "").trim();
  const looksLikeOrder = rec.paymentStatus != null || Array.isArray(rec.lineItems);
  if (looksLikeOrder && rootId) return rootId;
  return rootId;
}

async function shopierRequest(
  pat: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: unknown; error: string }> {
  if (!pat) return { ok: false, status: 0, json: null, error: "SHOPIER_PAT yok" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${SHOPIER_API_BASE}${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${pat}`,
        ...(body != null ? { "content-type": "application/json" } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      return { ok: false, status: res.status, json, error: `Shopier HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, json, error: "" };
  } catch {
    return { ok: false, status: 0, json: null, error: "Shopier ağ hatası" };
  } finally {
    clearTimeout(timer);
  }
}

export async function shopierCreateProduct(opts: {
  pat: string;
  title: string;
  amountTry: number;
  imageUrl: string;
}) {
  if (!opts.imageUrl.startsWith("https://")) {
    return { ok: false as const, error: "SHOPIER_PRODUCT_IMAGE_URL https olmalı", product: null };
  }
  const created = await shopierRequest(opts.pat, "POST", "/products", {
    title: opts.title,
    description: "Dijital üyelik. Teslimat yalnızca doğrulanmış ödeme sonrası uygulamada açılır.",
    type: "digital",
    media: [{ type: "image", url: opts.imageUrl, placement: 1 }],
    priceData: {
      currency: "TRY",
      price: opts.amountTry.toFixed(2),
      vatPercent: 0,
    },
    stockQuantity: 1,
    shippingPayer: "sellerPays",
    customListing: true,
  });
  if (!created.ok) return { ok: false as const, error: created.error, product: null };
  const product = parseShopierProduct(created.json);
  if (!product) return { ok: false as const, error: "Shopier ürün kimliği veya URL dönmedi", product: null };
  return { ok: true as const, error: "", product };
}

export async function shopierGetOrder(pat: string, orderId: string) {
  const id = encodeURIComponent(orderId);
  const got = await shopierRequest(pat, "GET", `/orders/${id}`);
  if (!got.ok) return { ok: false as const, status: got.status, error: got.error, order: null };
  const order = parseShopierOrder(got.json);
  if (!order) return { ok: false as const, status: got.status, error: "Shopier sipariş gövdesi geçersiz", order: null };
  return { ok: true as const, status: got.status, error: "", order };
}

export async function shopierGetProduct(pat: string, productId: string) {
  if (!productId) return { ok: false as const, status: 0, error: "ürün yok", product: null };
  const got = await shopierRequest(pat, "GET", `/products/${encodeURIComponent(productId)}`);
  if (!got.ok) return { ok: false as const, status: got.status, error: got.error, product: null };
  const product = parseShopierProduct(got.json);
  if (!product) return { ok: false as const, status: got.status, error: "Shopier ürün gövdesi geçersiz", product: null };
  return { ok: true as const, status: got.status, error: "", product };
}

/**
 * Az önce POST /products ile açılan ürünün ödeme linki. Shopier PAT'e ürün okuma izni vermeyebiliyor
 * (GET /products/{id} → 403); yalnız o durumda POST yanıtındaki (Shopier'in kendi döndürdüğü) link kullanılır.
 * Ürün yoksa (404), ağ hatası veya id uyuşmazlığında link verilmez. Ödeme yine webhook'ta GET /orders ile doğrulanır.
 */
export async function shopierConfirmCreatedProduct(pat: string, created: ShopierProduct) {
  const live = await shopierGetProduct(pat, created.id);
  if (live.ok && live.product && live.product.id === created.id) {
    return { ok: true as const, url: live.product.url, verifiedByGet: true };
  }
  if (!live.ok && live.status === 403 && created.id && created.url.startsWith("https://")) {
    return { ok: true as const, url: created.url, verifiedByGet: false };
  }
  return { ok: false as const, url: "", verifiedByGet: false };
}

export async function shopierDeleteProduct(pat: string, productId: string) {
  if (!productId) return { ok: false as const, deleted: false, error: "ürün yok" };
  const del = await shopierRequest(pat, "DELETE", `/products/${encodeURIComponent(productId)}`);
  if (!del.ok && del.status !== 404) {
    return { ok: false as const, deleted: false, error: del.error };
  }
  return { ok: true as const, deleted: del.status !== 404, error: "" };
}
