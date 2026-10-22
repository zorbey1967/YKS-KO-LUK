/**
 * Hesapsız (giriş yapmadan) Shopier ödemesi — ortak sunucu mantığı.
 *
 * - Tarayıcıya verilen anahtar 32 bayt rastgele; veritabanında yalnız SHA-256 özeti tutulur.
 * - Hesap ancak Shopier siparişi billing-webhook'ta doğrulandıktan sonra açılır.
 * - Hesabın giriş kimliği, e-posta istenmediği için, bu ödemeye bağlı ve hiçbir zaman gerçek
 *   posta alamayan bir adrestir (`.invalid` ayrılmış alan adı; kimse sahiplenemez).
 * - Paket mevcut apply_verified_payment (054/055) ile tanımlanır; tekrar gelen sipariş ikinci
 *   hesap veya paket oluşturmaz.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { applyVerifiedPayment } from "./billingApply.ts";
import type { PlanId } from "./billingCatalog.ts";

export const GUEST_EMAIL_DOMAIN = "misafir.rubikkocluk.invalid";
/** Ödeme onaylandıktan sonra tarayıcının anahtarla (bir kez) oturum alabileceği süre. */
export const GUEST_CLAIM_WINDOW_MS = 24 * 3_600_000;
/** Ödenmemiş hesapsız ödeme linkinin yeniden kullanılabileceği süre. */
export const GUEST_REUSE_MS = 6 * 3_600_000;

export type GuestRow = {
  id: string;
  plan_id: string;
  amount_try: number | string;
  currency: string;
  status: string;
  provider: string;
  provider_session_id: string;
  user_id: string | null;
  checkout_session_id: string | null;
  provider_order_id: string | null;
  created_at: string;
  paid_at: string | null;
  claimed_at: string | null;
};

export const GUEST_COLUMNS =
  "id, plan_id, amount_try, currency, status, provider, provider_session_id, user_id, checkout_session_id, provider_order_id, created_at, paid_at, claimed_at";

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newClaimToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

/** Biçim kontrolü: yalnız newClaimToken çıktısı kabul edilir (43 karakter base64url). */
export function claimTokenShapeOk(token: unknown) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function claimTokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function guestEmailFor(guestId: string) {
  const id = String(guestId || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("misafir_id_gecersiz");
  return `rk-${id}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: unknown) {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/** Tarayıcının anahtarla oturum alıp alamayacağı. Ödenmemiş, süresi geçmiş veya zaten kullanılmışsa hayır. */
export function guestClaimState(row: Pick<GuestRow, "status" | "user_id" | "paid_at" | "claimed_at">, now = Date.now()) {
  if (row.status === "failed" || row.status === "expired") return "closed" as const;
  if (row.status !== "paid" || !row.user_id || !row.paid_at) return "pending" as const;
  if (row.claimed_at) return "closed" as const;
  const paid = Date.parse(row.paid_at);
  if (!Number.isFinite(paid) || now - paid > GUEST_CLAIM_WINDOW_MS) return "expired" as const;
  return "ready" as const;
}

/**
 * Anahtar başına TEK giriş özeti. Yalnız claimed_at'ı boştan dolduran istek özet alır (koşullu güncelleme,
 * eşzamanlı ikinci istek "closed" görür). Özet üretilemezse işaret geri alınır; hiç özet verilmediği için
 * tekrar denemek güvenlidir. Şifre sonradan belirlense de anahtar ikinci kez giriş açamaz.
 */
export async function claimGuestLogin(admin: SupabaseClient, row: GuestRow, now = Date.now()) {
  const state = guestClaimState(row, now);
  if (state !== "ready") return { ok: false as const, status: state };
  const nowIso = new Date(now).toISOString();
  const mark = await admin.from("billing_guest_checkouts")
    .update({ claimed_at: nowIso, updated_at: nowIso })
    .eq("id", row.id)
    .is("claimed_at", null)
    .select("id");
  if (mark.error) return { ok: false as const, status: "error" as const };
  if (!mark.data || mark.data.length !== 1) return { ok: false as const, status: "closed" as const };
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: guestEmailFor(row.id) });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    await admin.from("billing_guest_checkouts").update({ claimed_at: null }).eq("id", row.id).eq("claimed_at", nowIso);
    return { ok: false as const, status: "error" as const };
  }
  return { ok: true as const, tokenHash };
}

/** Ödeme linki yeniden kullanılabilir mi (aynı tarayıcı tekrar "Ödeme Yap" derse yeni ürün açılmaz). */
export function guestReusable(row: Pick<GuestRow, "status" | "provider_session_id" | "created_at" | "plan_id">, planId: PlanId, now = Date.now()) {
  if (row.plan_id !== planId) return false;
  if (row.status !== "redirected" || !row.provider_session_id) return false;
  const t = Date.parse(row.created_at);
  return Number.isFinite(t) && now - t <= GUEST_REUSE_MS;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string) {
  const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ? String(data.id) : null;
}

/**
 * Doğrulanmış ödeme için öğrenci hesabını bulur veya açar. Aynı misafir ödeme için her zaman aynı
 * giriş kimliği kullanıldığından tekrar gelen webhook ikinci hesap açamaz.
 */
export async function ensureGuestUser(admin: SupabaseClient, guest: GuestRow) {
  if (guest.user_id) return { ok: true as const, userId: guest.user_id, created: false };
  const email = guestEmailFor(guest.id);
  const existing = await findUserIdByEmail(admin, email);
  if (existing) return { ok: true as const, userId: existing, created: false };
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { intent: "student", source: "shopier_guest" },
  });
  if (created.error || !created.data?.user?.id) {
    // Eşzamanlı ikinci teslimat hesabı az önce açmış olabilir.
    const again = await findUserIdByEmail(admin, email);
    if (again) return { ok: true as const, userId: again, created: false };
    return { ok: false as const, error: "hesap_acilamadi" };
  }
  return { ok: true as const, userId: String(created.data.user.id), created: true };
}

/**
 * billing-webhook'tan: sipariş Shopier'de doğrulandıktan (shopierActivateOk) SONRA çağrılır.
 * Hesap → normal ödeme oturumu → apply_verified_payment → misafir satırı "paid".
 */
export async function applyGuestPayment(
  admin: SupabaseClient,
  input: { guest: GuestRow; planId: PlanId; orderId: string },
) {
  const user = await ensureGuestUser(admin, input.guest);
  if (!user.ok) return { ok: false as const, error: user.error };

  const attach = await admin.rpc("guest_checkout_attach", {
    p_guest_id: input.guest.id,
    p_user_id: user.userId,
    p_order_id: input.orderId,
  });
  if (attach.error || !attach.data) return { ok: false as const, error: "oturum_baglanamadi" };
  const checkoutId = String(attach.data);

  const applied = await applyVerifiedPayment(admin, {
    userId: user.userId,
    checkoutId,
    planId: input.planId,
    provider: "shopier",
    paymentId: input.orderId,
    amountTry: Number(input.guest.amount_try),
    subscriptionId: input.orderId,
  });
  if (!applied.ok) return { ok: false as const, error: applied.error };

  const nowIso = new Date().toISOString();
  await admin.from("billing_guest_checkouts").update({
    status: "paid",
    paid_at: input.guest.paid_at || nowIso,
    updated_at: nowIso,
  }).eq("id", input.guest.id);

  return {
    ok: true as const,
    userId: user.userId,
    createdUser: user.created,
    duplicatePayment: applied.duplicatePayment,
    latePayment: applied.latePayment,
  };
}
