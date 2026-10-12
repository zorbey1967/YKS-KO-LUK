import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('016 schema vs webhook (kaynak sözleşmesi)', () => {
  const mig = readFileSync(join(root, 'supabase/migrations/016_billing_payments.sql'), 'utf8');
  const wh = readFileSync(join(root, 'supabase/functions/billing-webhook/index.ts'), 'utf8');
  const apply = readFileSync(join(root, 'supabase/functions/_shared/billingApply.ts'), 'utf8');

  it('webhook 016 tablo adlarını kullanır', () => {
    expect(mig).toContain('create table if not exists public.billing_checkout_sessions');
    expect(mig).toContain('create table if not exists public.billing_payments');
    expect(mig).toContain('unique (provider, provider_payment_id)');
    expect(mig).toContain('amount_try numeric(12,2)');
    expect(mig).toContain("currency text not null default 'TRY'");
    expect(mig).toContain('provider_payment_id text not null');
    expect(mig).toContain("plan_id text not null check (plan_id in ('pro', 'premium'))");
    expect(wh).toContain('billing_checkout_sessions');
    expect(wh).toContain('amount_try, currency');
    expect(wh).toContain('applyVerifiedPayment');
    expect(apply).toContain('billing_subscriptions');
    expect(apply).toContain('provider_payment_id');
    expect(apply).toContain('currency: "TRY"');
    expect(apply).toContain('apply_verified_payment');
    expect(apply).toContain('atomik ödeme RPC yok');
  });

  it('üye aktivasyonu tablolardan sonra profile yazar', () => {
    const upsert = apply.indexOf('billing_subscriptions');
    const profiles = apply.indexOf('from("profiles")');
    expect(upsert).toBeGreaterThan(0);
    expect(profiles).toBeGreaterThan(upsert);
  });
});
