import { amountsMatch, BILLING_CURRENCY, type PlanId } from "./billingCatalog.ts";
import { checkoutCurrencyOk, safeEq } from "./billingWebhookGuard.ts";
import type { ShopierOrder } from "./shopierApi.ts";

/**
 * OpenAPI: webhook `token` imza için kullanılır.
 * Başlık adı ve hex/base64 kodlaması developer.shopier.com sayfalarında yok;
 * üyelik yine de yalnızca GET /orders/{id} sonrası açılır.
 * İmza eşleşmezse retrieve yapılmaz.
 *
 * TODO(ticari açılış): Shopier imza formatı (başlık adı, HMAC-SHA256 hex/base64, imzalanan gövde)
 * gerçek bir küçük ödeme + iade bildirimiyle henüz DOĞRULANMADI. Doğrulanana kadar:
 *   - imza geçersizse 401 döner, sipariş okunmaz, üyelik açılmaz (güvenli taraf);
 *   - imza doğru olsa bile üyelik yalnızca GET /orders/{id} sonucuna göre açılır/kapanır.
 * Format farklı çıkarsa sadece bu dosyadaki shopierSignatureOk güncellenir.
 */
export async function shopierHmacSha256(token: string, raw: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const bytes = new Uint8Array(sig);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return { hex, b64 };
}

export function shopierSignatureHeader(headers: Headers) {
  return (headers.get("Shopier-Signature") || headers.get("shopier-signature") || "").trim();
}

export function shopierEventHeader(headers: Headers) {
  return (headers.get("Shopier-Event") || headers.get("shopier-event") || "").trim();
}

export async function shopierSignatureOk(raw: string, signatureHeader: string, token: string) {
  if (!raw || !signatureHeader || !token) return false;
  const { hex, b64 } = await shopierHmacSha256(token, raw);
  const given = signatureHeader.trim();
  if (given.length === hex.length && safeEq(given.toLowerCase(), hex.toLowerCase())) return true;
  if (given.length === b64.length && safeEq(given, b64)) return true;
  return false;
}

/**
 * Aday HMAC kapısı (resmi portal başlık/kodlama yayımlamadı).
 * Geçersizse retrieve ve üyelik yok. Canlı teslimat formatı ayrıca teyit edilmeli.
 */
export async function shopierWebhookAuth(raw: string, signatureHeader: string, token: string) {
  if (!token) return { ok: false as const, reason: "no_token" as const };
  if (!signatureHeader) return { ok: false as const, reason: "missing" as const };
  if (!await shopierSignatureOk(raw, signatureHeader, token)) {
    return { ok: false as const, reason: "invalid" as const };
  }
  return { ok: true as const };
}

export function shopierRefundedTotal(order: ShopierOrder) {
  return order.refunds
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + (Number.isFinite(r.total) ? r.total : 0), 0);
}

export function shopierActivateOk(input: {
  planId: PlanId | null;
  sessionAmountTry: unknown;
  sessionCurrency?: unknown;
  productId: string;
  order: ShopierOrder | null;
}) {
  if (!input.planId || !input.order) return false;
  if (!input.productId) return false;
  if (input.order.paymentStatus !== "paid") return false;
  if (!checkoutCurrencyOk(input.sessionCurrency) || input.order.currency !== BILLING_CURRENCY) return false;
  const expected = Number(input.sessionAmountTry);
  if (!Number.isFinite(expected) || expected <= 0) return false;
  if (!amountsMatch(input.planId, expected)) return false;
  if (Math.abs(input.order.total - expected) > 0.009) return false;
  const matched = input.order.lineItems.filter((line) => line.productId === input.productId);
  if (matched.length !== 1) return false;
  if (matched[0].quantity !== 1) return false;
  if (input.order.lineItems.some((line) => line.productId !== input.productId)) return false;
  if (shopierRefundedTotal(input.order) > 0.009) return false;
  return true;
}
