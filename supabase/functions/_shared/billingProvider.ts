/**
 * Kullanıcıya sunulan ödeme: yalnızca Shopier.
 * iyzico/PayTR checkout başlatılmaz. Eski webhook dalları inbound uyumluluk için durur.
 * Secret değerleri loglanmaz. VITE_* yok.
 *
 * Edge secrets:
 * - SHOPIER_PAT
 * - SHOPIER_WEBHOOK_TOKEN  (POST /webhooks yanıtındaki token, bir kez)
 * - SHOPIER_PRODUCT_IMAGE_URL  (https, POST /products media)
 */

import { readShopierSecrets, shopierCheckoutReady, shopierWebhookReady } from "./shopierApi.ts";

export type ProviderId = "shopier" | "iyzico" | "paytr" | "";

function env(name: string) {
  return (Deno.env.get(name) || "").trim();
}

export function configuredProvider(): ProviderId {
  return "shopier";
}

export function shopierSecrets() {
  return readShopierSecrets((key) => Deno.env.get(key));
}

export function shopierReady() {
  return shopierCheckoutReady(shopierSecrets());
}

export function shopierNotifyReady() {
  return shopierWebhookReady(shopierSecrets());
}

export function iyzicoReady() {
  return Boolean(env("IYZICO_API_KEY") && env("IYZICO_SECRET_KEY"));
}

export function paytrReady() {
  return Boolean(env("PAYTR_MERCHANT_ID") && env("PAYTR_MERCHANT_KEY") && env("PAYTR_MERCHANT_SALT"));
}

export function merchantReady(): boolean {
  return shopierReady();
}

export function missingSecretsMessage() {
  const s = shopierSecrets();
  if (!s.pat) return "Shopier PAT (SHOPIER_PAT) sunucuda yok. Sahte ödeme başlatılmadı; üyelik açılmadı.";
  if (!s.productImageUrl.startsWith("https://")) {
    return "SHOPIER_PRODUCT_IMAGE_URL (https ürün görseli) sunucuda yok. Sahte ödeme başlatılmadı.";
  }
  return "Shopier ödeme sistemi hazır değil. Üyelik açılmadı.";
}
