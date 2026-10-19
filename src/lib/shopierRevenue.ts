import type { AdminPaymentRow, BillingRow } from './cloudPlatform';

function uniqueByPaymentId(rows: AdminPaymentRow[]) {
  const seen = new Set<string>();
  const out: AdminPaymentRow[] = [];
  for (const row of rows) {
    const key = `${row.provider}:${row.providerPaymentId || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Shopier brüt / iade / net; koç defteri ayrı. Aynı sipariş id bir kez sayılır.
 * İade edilen ödeme ayrı satır değildir: aynı satır status=refunded olur (050). Bu yüzden
 * brüt = başarılı + iade edilmiş tahsilat; iade = tam iade tutarları + kısmi iadeler; net = brüt − iade.
 */
export function shopierRevenueFromPayments(rows: AdminPaymentRow[] | null | undefined) {
  const all = uniqueByPaymentId((rows || []).filter((r) => r.provider === 'shopier'));
  const collected = all.filter((r) => r.status === 'succeeded' || r.status === 'refunded');
  const refunded = all.filter((r) => r.status === 'refunded');
  const failed = all.filter((r) => r.status === 'failed');
  const gross = collected.reduce((s, r) => s + r.amountTry, 0);
  const fullRefunds = refunded.reduce((s, r) => s + (r.refundedTotalTry && r.refundedTotalTry > 0 ? Math.min(r.refundedTotalTry, r.amountTry) : r.amountTry), 0);
  const partialRefunds = all
    .filter((r) => r.status === 'succeeded' && (r.refundedTotalTry || 0) > 0)
    .reduce((s, r) => s + Math.min(r.refundedTotalTry || 0, r.amountTry), 0);
  const refunds = fullRefunds + partialRefunds;
  return {
    orderCount: collected.length,
    refundCount: refunded.length,
    failedCount: failed.length,
    grossTry: Math.round(gross * 100) / 100,
    refundedTry: Math.round(refunds * 100) / 100,
    netTry: Math.round((gross - refunds) * 100) / 100,
  };
}

export function activeMembershipCount(rows: BillingRow[] | null | undefined) {
  return (rows || []).filter((r) => r.subscription_status === 'active' && r.account_status === 'active').length;
}
