import { describe, expect, it } from 'vitest';
import { activeMembershipCount, shopierRevenueFromPayments } from './shopierRevenue';
import type { AdminPaymentRow, BillingRow } from './cloudPlatform';

function pay(partial: Partial<AdminPaymentRow>): AdminPaymentRow {
  return {
    id: partial.id || '1',
    email: 'a@b.c',
    amountTry: 200,
    currency: 'TRY',
    status: 'succeeded',
    provider: 'shopier',
    providerPaymentId: 'ord_1',
    createdAt: '2026-10-12',
    ...partial,
  };
}

describe('Shopier gelir ayrımı', () => {
  it('aynı siparişi iki kez saymaz', () => {
    const stats = shopierRevenueFromPayments([
      pay({ id: 'a', providerPaymentId: 'ord_1' }),
      pay({ id: 'b', providerPaymentId: 'ord_1' }),
      pay({ id: 'c', providerPaymentId: 'ord_2', amountTry: 200 }),
      pay({ id: 'd', provider: 'iyzico', providerPaymentId: 'iy_1' }),
    ]);
    expect(stats.orderCount).toBe(2);
    expect(stats.grossTry).toBe(400);
  });

  it('iade edilen sipariş brütte kalır, netten bir kez düşer; koç satırı yok', () => {
    const stats = shopierRevenueFromPayments([
      pay({ providerPaymentId: 'ord_1', status: 'succeeded' }),
      pay({ id: 'r', providerPaymentId: 'ord_9', status: 'refunded', amountTry: 200 }),
    ]);
    expect(stats.orderCount).toBe(2);
    expect(stats.refundCount).toBe(1);
    expect(stats.grossTry).toBe(400);
    expect(stats.refundedTry).toBe(200);
    expect(stats.netTry).toBe(200);
  });

  it('tamamı iade edilmişse net sıfır; başarısız ödeme brüte girmez', () => {
    const stats = shopierRevenueFromPayments([
      pay({ id: 'r1', providerPaymentId: 'ord_1', status: 'refunded', amountTry: 200 }),
      pay({ id: 'f1', providerPaymentId: 'ord_2', status: 'failed', amountTry: 200 }),
    ]);
    expect(stats.grossTry).toBe(200);
    expect(stats.refundedTry).toBe(200);
    expect(stats.netTry).toBe(0);
    expect(stats.failedCount).toBe(1);
  });

  it('aktif üyeliği subscription_status ile sayar', () => {
    const rows = [
      { id: '1', name: 'A', email: 'a', plan: 'premium', subscription_status: 'active', trial_started_at: '', trial_ends_at: '', subscription_ends_at: '', account_status: 'active' },
      { id: '2', name: 'B', email: 'b', plan: 'premium', subscription_status: 'trialing', trial_started_at: '', trial_ends_at: '', subscription_ends_at: '', account_status: 'active' },
    ] as BillingRow[];
    expect(activeMembershipCount(rows)).toBe(1);
  });
});
