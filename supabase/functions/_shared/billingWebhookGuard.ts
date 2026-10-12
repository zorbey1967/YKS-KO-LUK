import { amountsMatch, BILLING_CURRENCY, type PlanId } from "./billingCatalog.ts";

export function checkoutCurrencyOk(currency: unknown) {
  const c = String(currency || BILLING_CURRENCY).trim().toUpperCase();
  return c === BILLING_CURRENCY;
}

export function merchantMatchesCheckout(merchantOid: unknown, sessionId: unknown) {
  const a = String(merchantOid || "").trim();
  const b = String(sessionId || "").trim();
  return Boolean(a) && a === b;
}

export function paytrAmountMatchesSession(amountTry: unknown, totalKurus: unknown) {
  const paidKurus = Number(totalKurus);
  const expected = Number(amountTry);
  if (!Number.isFinite(paidKurus) || !Number.isFinite(expected)) return false;
  return Math.abs(paidKurus / 100 - expected) <= 0.009;
}

/** PayTR: oturum tutarı, kuruş, para birimi ve katalog fiyatı. */
export function paytrActivateOk(input: {
  planId: PlanId | null;
  amountTry: unknown;
  currency?: unknown;
  totalKurus: unknown;
}) {
  if (!input.planId) return false;
  if (!checkoutCurrencyOk(input.currency)) return false;
  if (!paytrAmountMatchesSession(input.amountTry, input.totalKurus)) return false;
  return amountsMatch(input.planId, Number(input.amountTry));
}

export function iyzicoActivateOk(input: {
  planId: PlanId | null;
  amountTry: unknown;
  currency?: unknown;
  paidPrice: unknown;
}) {
  if (!input.planId) return false;
  if (!checkoutCurrencyOk(input.currency)) return false;
  const expected = Number(input.amountTry);
  const paid = Number(input.paidPrice);
  if (!Number.isFinite(expected) || expected <= 0) return false;
  if (!Number.isFinite(paid)) return false;
  if (Math.abs(paid - expected) > 0.05 && !amountsMatch(input.planId, paid)) return false;
  return amountsMatch(input.planId, expected);
}

export async function paytrHashExpected(
  merchantKey: string,
  merchantOid: string,
  salt: string,
  status: string,
  totalAmount: string,
) {
  const data = `${merchantOid}${salt}${status}${totalAmount}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(merchantKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
