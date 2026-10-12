import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shopierOrderIdFromPayload } from '../../supabase/functions/_shared/shopierApi.ts';
import {
  shopierOrphanEventId,
  shopierRetrievedOrderMatches,
  shopierReusableSession,
  shopierSessionMapped,
} from '../../supabase/functions/_shared/shopierCheckout.ts';
import { shopierHmacSha256, shopierWebhookAuth } from '../../supabase/functions/_shared/shopierWebhook.ts';

const mapped = {
  id: 'sess-1',
  plan_id: 'premium' as const,
  amount_try: 200,
  status: 'redirected',
  provider: 'shopier',
  provider_session_id: 'prod_1',
  created_at: new Date().toISOString(),
};

describe('Shopier checkout eşleme ve webhook id', () => {
  it('zarf data.id / order.id kök webhook id’den önce gelir', () => {
    expect(shopierOrderIdFromPayload({ id: 'ord_root', paymentStatus: 'paid', lineItems: [] })).toBe('ord_root');
    expect(shopierOrderIdFromPayload({ id: 'wh_1', data: { id: 'ord_2' } })).toBe('ord_2');
    expect(shopierOrderIdFromPayload({ id: 'wh_1', order: { id: 'ord_3' } })).toBe('ord_3');
    expect(shopierOrderIdFromPayload({ data: { id: 'ord_4' } })).toBe('ord_4');
    expect(shopierOrderIdFromPayload({})).toBe('');
  });

  it('GET sipariş id sorgulanan id ile eşleşmezse uygulama yok', () => {
    expect(shopierRetrievedOrderMatches('ord_1', 'ord_1')).toBe(true);
    expect(shopierRetrievedOrderMatches('ord_1', 'ord_2')).toBe(false);
    expect(shopierRetrievedOrderMatches('', 'ord_1')).toBe(false);
  });

  it('eşlenmemiş ürün oturuma bağlanmaz; reuse yalnızca kendi eşlemesiyle', () => {
    expect(shopierSessionMapped(null, 'prod_1')).toBe(false);
    expect(shopierSessionMapped(mapped, 'other')).toBe(false);
    expect(shopierSessionMapped(mapped, 'prod_1')).toBe(true);
    expect(shopierReusableSession(mapped, 'premium', 200)).toBe(true);
    expect(shopierReusableSession({ ...mapped, provider_session_id: '' }, 'premium', 200)).toBe(false);
    expect(shopierReusableSession({ ...mapped, created_at: '2020-01-01T00:00:00.000Z' }, 'premium', 200)).toBe(false);
    expect(shopierOrphanEventId('prod_1', 'sess-1')).toContain('orphan-product:prod_1:sess-1');
  });

  it('eksik veya geçersiz imzada retrieve/üyelik kapısı kapalıdır', async () => {
    const raw = JSON.stringify({ data: { id: 'ord_1' } });
    expect(await shopierWebhookAuth(raw, '', 'test-token')).toEqual({ ok: false, reason: 'missing' });
    expect(await shopierWebhookAuth(raw, 'deadbeef', 'test-token')).toEqual({ ok: false, reason: 'invalid' });
    expect(await shopierWebhookAuth(raw, 'aabb', '')).toEqual({ ok: false, reason: 'no_token' });
    const { hex } = await shopierHmacSha256('test-token', raw);
    expect((await shopierWebhookAuth(raw, hex, 'test-token')).ok).toBe(true);
  });

  it('checkout URL yalnızca doğrulanmış eşlemeden; webhook retrieve id kontrolü var', () => {
    const checkout = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/billing-checkout/index.ts'),
      'utf8',
    );
    const wh = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/billing-webhook/index.ts'),
      'utf8',
    );
    expect(checkout).toContain('shopierSessionMapped');
    expect(checkout).toContain('shopierGetProduct');
    expect(checkout).toContain('orphan_product');
    expect(checkout).toContain('shopierReusableSession');
    expect(checkout).not.toMatch(/checkout_url: created\.product\.url/);
    expect(wh).toContain('shopierWebhookAuth');
    expect(wh).toContain('shopierRetrievedOrderMatches');
    expect(wh).toContain('urun_oturum_yok');
  });
});
