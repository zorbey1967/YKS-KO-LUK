import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { amountsMatch } from '../../supabase/functions/_shared/billingCatalog.ts';
import {
  checkoutCurrencyOk,
  iyzicoActivateOk,
  merchantMatchesCheckout,
  paytrActivateOk,
  paytrAmountMatchesSession,
  paytrHashExpected,
  safeEq,
} from '../../supabase/functions/_shared/billingWebhookGuard.ts';

describe('billing webhook contract (016 + catalog)', () => {
  it('bilinmeyen siparişte PayTR OK (üyelik yok) kaynağı duruyor', () => {
    const wh = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/billing-webhook/index.ts'),
      'utf8',
    );
    expect(wh).toContain('if (!session)');
    expect(wh).toContain('return paytrAck()');
    expect(wh).toContain('PayTR bilinmeyen merchant_oid');
    expect(wh).toContain('shopierGetOrder');
  });

  it('merchant_oid oturum id ile birebir eşleşmeli', () => {
    expect(merchantMatchesCheckout('chk-1', 'chk-1')).toBe(true);
    expect(merchantMatchesCheckout('chk-1', 'chk-2')).toBe(false);
    expect(merchantMatchesCheckout('', 'chk-1')).toBe(false);
  });

  it('PayTR kuruş ve TRY dışını reddeder', () => {
    expect(paytrAmountMatchesSession(100, 10000)).toBe(true);
    expect(paytrAmountMatchesSession(100, 20000)).toBe(false);
    expect(checkoutCurrencyOk('TRY')).toBe(true);
    expect(checkoutCurrencyOk('USD')).toBe(false);
    expect(paytrActivateOk({
      planId: 'pro',
      amountTry: 100,
      currency: 'TRY',
      totalKurus: 10000,
    })).toBe(true);
    expect(paytrActivateOk({
      planId: 'pro',
      amountTry: 100,
      currency: 'USD',
      totalKurus: 10000,
    })).toBe(false);
    expect(paytrActivateOk({
      planId: 'pro',
      amountTry: 50,
      currency: 'TRY',
      totalKurus: 5000,
    })).toBe(false);
  });

  it('iyzico tutar/katalog uyuşmazlığını reddeder', () => {
    expect(iyzicoActivateOk({
      planId: 'premium',
      amountTry: 200,
      currency: 'TRY',
      paidPrice: 200,
    })).toBe(true);
    expect(iyzicoActivateOk({
      planId: 'premium',
      amountTry: 200,
      currency: 'TRY',
      paidPrice: 1,
    })).toBe(false);
    expect(iyzicoActivateOk({
      planId: null,
      amountTry: 200,
      currency: 'TRY',
      paidPrice: 200,
    })).toBe(false);
    expect(amountsMatch('pro', 100)).toBe(true);
  });

  it('PayTR HMAC sahte anahtarla doğrular; bozuk imzayı reddeder', async () => {
    const expected = await paytrHashExpected('test-key', 'oid-1', 'test-salt', 'success', '10000');
    const other = await paytrHashExpected('test-key', 'oid-1', 'test-salt', 'failed', '10000');
    expect(safeEq(expected, expected)).toBe(true);
    expect(safeEq(expected, other)).toBe(false);
    expect(safeEq(expected, expected + 'x')).toBe(false);
  });
});
