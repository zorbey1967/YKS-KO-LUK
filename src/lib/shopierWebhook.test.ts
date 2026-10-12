import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chargeAmountTry } from '../../supabase/functions/_shared/billingCatalog.ts';
import {
  parseShopierOrder,
  parseShopierProduct,
  shopierOrderIdFromPayload,
} from '../../supabase/functions/_shared/shopierApi.ts';
import {
  shopierActivateOk,
  shopierHmacSha256,
  shopierSignatureOk,
} from '../../supabase/functions/_shared/shopierWebhook.ts';

const paidOrder = {
  id: 'ord_1',
  paymentStatus: 'paid',
  currency: 'TRY',
  totals: { total: '200.00' },
  lineItems: [{ productId: 'prod_1', title: 'Premium', quantity: 1, price: '200.00', total: '200.00' }],
  refunds: [],
};

describe('Shopier katalog ve sipariş eşlemesi', () => {
  it('kampanyalı Premium çekimi 200 TL (katalog; fiyat burada değişmez)', () => {
    expect(chargeAmountTry('premium')).toBe(200);
    expect(chargeAmountTry('pro')).toBe(100);
  });

  it('ürün ve sipariş parse eder', () => {
    expect(parseShopierProduct({ id: 'p1', url: 'https://www.shopier.com/1' })).toEqual({
      id: 'p1',
      url: 'https://www.shopier.com/1',
    });
    expect(parseShopierProduct({ id: 'p1', url: 'http://insecure' })).toBeNull();
    const order = parseShopierOrder(paidOrder);
    expect(order?.id).toBe('ord_1');
    expect(order?.total).toBe(200);
    expect(shopierOrderIdFromPayload({ id: 'ord_1', paymentStatus: 'paid', lineItems: [] })).toBe('ord_1');
    expect(shopierOrderIdFromPayload({ data: { id: 'ord_2' } })).toBe('ord_2');
    expect(shopierOrderIdFromPayload({ id: 'wh_1', data: { id: 'ord_2' } })).toBe('ord_2');
  });

  it('paid + TRY + ürün + adet 1 + 200 TL kabul eder', () => {
    const order = parseShopierOrder(paidOrder);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'prod_1',
      order,
    })).toBe(true);
  });

  it('sahte imza, yanlış tutar, kur, ürün, adet, unpaid ve iadeyi reddeder', async () => {
    const raw = JSON.stringify({ id: 'ord_1' });
    expect(await shopierSignatureOk(raw, 'deadbeef', 'test-token')).toBe(false);
    const { hex } = await shopierHmacSha256('test-token', raw);
    expect(await shopierSignatureOk(raw, hex, 'test-token')).toBe(true);
    expect(await shopierSignatureOk(raw + 'x', hex, 'test-token')).toBe(false);

    const order = parseShopierOrder(paidOrder);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'prod_1',
      order: { ...order!, total: 199 },
    })).toBe(false);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'USD',
      productId: 'prod_1',
      order,
    })).toBe(false);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'other',
      order,
    })).toBe(false);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'prod_1',
      order: parseShopierOrder({
        ...paidOrder,
        lineItems: [{ productId: 'prod_1', quantity: 2, price: '200.00', total: '400.00' }],
        totals: { total: '400.00' },
      }),
    })).toBe(false);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'prod_1',
      order: parseShopierOrder({ ...paidOrder, paymentStatus: 'unpaid' }),
    })).toBe(false);
    expect(shopierActivateOk({
      planId: 'premium',
      sessionAmountTry: 200,
      sessionCurrency: 'TRY',
      productId: 'prod_1',
      order: parseShopierOrder({
        ...paidOrder,
        refunds: [{ id: 'r1', type: 'full', status: 'succeeded', total: '200.00' }],
      }),
    })).toBe(false);
  });

  it('webhook üyelik için GET /orders ve applyVerifiedPayment kullanır; tarayıcı dönüşü yok', () => {
    const wh = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/billing-webhook/index.ts'),
      'utf8',
    );
    const checkout = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/billing-checkout/index.ts'),
      'utf8',
    );
    expect(wh).toContain('shopierGetOrder');
    expect(wh).toContain('shopierActivateOk');
    expect(wh).toContain('shopierRetrievedOrderMatches');
    expect(wh).toContain("provider: \"shopier\"");
    expect(wh).toContain('applyVerifiedPayment');
    expect(checkout).toContain('shopierCreateProduct');
    expect(checkout).not.toContain('iyzicoPost');
    expect(checkout).toContain('provider_session_id: created.product.id');
  });
});
