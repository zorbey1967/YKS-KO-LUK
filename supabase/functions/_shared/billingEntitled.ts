import { normalizePlanId } from "./billingCatalog.ts";

export type BillingGate = {
  skip: boolean;
  role: string;
  status: string;
  trialEnds: string;
  subEnds: string;
  plan: string;
};

/** student-ai üyelik kapısı. Belirsiz şema/status erişim vermez. */
export function billingOk(b: BillingGate, now = Date.now()) {
  if (b.role === "admin" || b.role === "coach") return { entitled: true, tier: "premium" as const };
  if (b.skip) return { entitled: false, tier: "none" as const };
  if (!b.status) return { entitled: false, tier: "none" as const };
  if (b.status === "trialing") {
    const t = b.trialEnds ? new Date(b.trialEnds).getTime() : NaN;
    return { entitled: Number.isFinite(t) && t > now, tier: "trial" as const };
  }
  if (b.status === "active") {
    const mapped = normalizePlanId(b.plan);
    if (!mapped) return { entitled: false, tier: "none" as const };
    if (!b.subEnds) return { entitled: true, tier: mapped };
    const t = new Date(b.subEnds).getTime();
    return { entitled: Number.isFinite(t) && t > now, tier: mapped };
  }
  return { entitled: false, tier: "none" as const };
}
