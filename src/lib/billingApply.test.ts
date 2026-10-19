import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activatePaid,
  applyVerifiedPayment,
  isUniqueViolation,
  recordBillingEvent,
  recordPayment,
} from '../../supabase/functions/_shared/billingApply.ts';

type Result = { data?: unknown; error: { code?: string; message: string } | null };

function thenable(result: Result) {
  const p = Promise.resolve(result);
  const api = {
    eq: () => api,
    maybeSingle: () => p,
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
  return api;
}

function mockAdmin(opts: {
  errors?: Record<string, Result>;
  rows?: Record<string, Result>;
  calls?: string[];
  upserted?: Record<string, unknown>;
}) {
  const calls = opts.calls || [];
  const errors = opts.errors || {};
  const rows = opts.rows || {};
  const upserted = opts.upserted || {};
  return {
    from(table: string) {
      const result = () => errors[table] || { error: null };
      return {
        insert: async () => {
          calls.push(`${table}:insert`);
          return result();
        },
        upsert: async (row: unknown) => {
          calls.push(`${table}:upsert`);
          upserted[table] = row;
          return result();
        },
        update: () => {
          calls.push(`${table}:update`);
          return thenable(result());
        },
        select: () => {
          calls.push(`${table}:select`);
          return thenable(rows[table] || { data: null, error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
}

const paid = {
  userId: '00000000-0000-4000-8000-000000000001',
  planId: 'pro' as const,
  provider: 'iyzico',
  checkoutId: 'chk_1',
  amountTry: 100,
  subscriptionId: 'pay_1',
};

describe('activatePaid fail-closed', () => {
  it('016 tablosu yoksa profili güncellemez', async () => {
    const calls: string[] = [];
    const admin = mockAdmin({
      calls,
      errors: {
        billing_subscriptions: { error: { message: 'Could not find the table' } },
      },
    });
    const r = await activatePaid(admin, paid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/table/i);
    expect(calls).toEqual(['billing_subscriptions:upsert']);
    expect(calls.some((c) => c.startsWith('profiles:'))).toBe(false);
  });

  it('abonelik ve checkout yazıldıktan sonra profili günceller', async () => {
    const calls: string[] = [];
    const admin = mockAdmin({ calls });
    const r = await activatePaid(admin, paid);
    expect(r).toEqual({ ok: true });
    expect(calls).toEqual([
      'billing_subscriptions:upsert',
      'billing_checkout_sessions:update',
      'profiles:update',
    ]);
  });

  it('checkout güncellemesi başarısızsa profili yazmaz', async () => {
    const calls: string[] = [];
    const admin = mockAdmin({
      calls,
      errors: {
        billing_checkout_sessions: { error: { message: 'checkout update failed' } },
      },
    });
    const r = await activatePaid(admin, paid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/checkout/i);
    expect(calls).toEqual([
      'billing_subscriptions:upsert',
      'billing_checkout_sessions:update',
    ]);
    expect(calls.some((c) => c.startsWith('profiles:'))).toBe(false);
  });

  it('profil güncellemesi başarısızsa üyelik açılmaz', async () => {
    const calls: string[] = [];
    const admin = mockAdmin({
      calls,
      errors: { profiles: { error: { message: 'profile update failed' } } },
    });
    const r = await activatePaid(admin, paid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/profile/i);
    expect(calls).toEqual([
      'billing_subscriptions:upsert',
      'billing_checkout_sessions:update',
      'profiles:update',
    ]);
  });
});

describe('applyVerifiedPayment idempotency', () => {
  it('RPC yoksa üyelik açmaz (çok adımlı yola düşmez)', async () => {
    const calls: string[] = [];
    const admin = mockAdmin({ calls });
    const r = await applyVerifiedPayment(admin, {
      userId: paid.userId,
      checkoutId: paid.checkoutId,
      planId: paid.planId,
      provider: paid.provider,
      paymentId: 'pay_1',
      amountTry: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/RPC yok/i);
    expect(calls).toEqual([]);
  });

  it('022 RPC varsa tek çağrı; fonksiyon yoksa hata (üyelik yok)', async () => {
    const rpcAdmin = {
      rpc: async () => ({ data: { ok: true, duplicate_payment: true }, error: null }),
      from() { throw new Error('rpc varken from kullanılmamalı'); },
    } as unknown as SupabaseClient;
    const atomic = await applyVerifiedPayment(rpcAdmin, {
      userId: paid.userId,
      checkoutId: paid.checkoutId,
      planId: paid.planId,
      provider: paid.provider,
      paymentId: 'pay_1',
      amountTry: 100,
    });
    expect(atomic).toEqual({ ok: true, duplicatePayment: true, latePayment: false });

    const lateAdmin = {
      rpc: async () => ({ data: { ok: true, duplicate_payment: false, late_payment: true }, error: null }),
      from() { throw new Error('rpc varken from kullanılmamalı'); },
    } as unknown as SupabaseClient;
    const late = await applyVerifiedPayment(lateAdmin, {
      userId: paid.userId,
      planId: paid.planId,
      provider: paid.provider,
      paymentId: 'pay_old',
      amountTry: 100,
    });
    expect(late).toEqual({ ok: true, duplicatePayment: false, latePayment: true });

    const calls: string[] = [];
    const fallback = mockAdmin({ calls });
    (fallback as unknown as { rpc: () => Promise<Result> }).rpc = async () => ({
      data: null,
      error: { code: '42883', message: 'function apply_verified_payment does not exist' },
    });
    const miss = await applyVerifiedPayment(fallback, {
      userId: paid.userId,
      planId: paid.planId,
      provider: paid.provider,
      paymentId: 'pay_1',
      amountTry: 100,
    });
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error).toMatch(/does not exist/i);
    expect(calls).toEqual([]);
  });
});

describe('record helpers', () => {
  it('unique event tekrarını duplicate sayar; şema hatasını fail eder', async () => {
    expect(isUniqueViolation({ code: '23505', message: 'x' })).toBe(true);
    const dup = mockAdmin({
      errors: { billing_events: { error: { code: '23505', message: 'duplicate key' } } },
    });
    const a = await recordBillingEvent(dup, { provider: 'paytr', eventId: 'e1', eventType: 'success' });
    expect(a).toEqual({ ok: true, duplicate: true });

    const missing = mockAdmin({
      errors: { billing_events: { error: { message: 'Could not find the table' } } },
    });
    const b = await recordBillingEvent(missing, { provider: 'paytr', eventId: 'e1', eventType: 'success' });
    expect(b.ok).toBe(false);

    const payMissing = mockAdmin({
      errors: { billing_payments: { error: { message: 'Could not find the table' } } },
    });
    const pay = await recordPayment(payMissing, {
      userId: paid.userId,
      amountTry: 1,
      status: 'succeeded',
      provider: 'paytr',
      paymentId: 'p1',
    });
    expect(pay.error).toBeTruthy();
  });
});
