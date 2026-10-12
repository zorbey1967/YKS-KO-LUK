import type { PlanId } from "./billingCatalog.ts";

const REUSE_MS = 6 * 3600 * 1000;

export type ShopierSessionRow = {
  id: string;
  user_id?: string;
  plan_id: string;
  amount_try: unknown;
  currency?: string;
  status: string;
  provider: string;
  provider_session_id: string | null;
  created_at?: string;
};

/** Eşleme DB satırında yoksa ödeme URL’si verilmez. */
export function shopierSessionMapped(row: ShopierSessionRow | null | undefined, productId: string) {
  const pid = String(productId || "").trim();
  if (!row || !pid) return false;
  if (String(row.provider) !== "shopier") return false;
  return String(row.provider_session_id || "").trim() === pid;
}

export function shopierReusableSession(
  row: ShopierSessionRow | null | undefined,
  planId: PlanId,
  amountTry: number,
  now = Date.now(),
) {
  if (!row) return false;
  if (String(row.plan_id) !== planId) return false;
  if (Math.abs(Number(row.amount_try) - amountTry) > 0.009) return false;
  if (!shopierSessionMapped(row, String(row.provider_session_id || ""))) return false;
  if (row.status !== "pending" && row.status !== "redirected") return false;
  const created = Date.parse(String(row.created_at || ""));
  if (!Number.isFinite(created) || now - created > REUSE_MS) return false;
  return true;
}

export function shopierOrphanEventId(productId: string, sessionId: string) {
  return `orphan-product:${productId}:${sessionId}`.slice(0, 120);
}

export function shopierRetrievedOrderMatches(queriedId: string, retrievedId: string) {
  const a = String(queriedId || "").trim();
  const b = String(retrievedId || "").trim();
  return Boolean(a) && a === b;
}
