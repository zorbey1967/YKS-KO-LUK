import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleShopierWebhook, MAX_BODY_BYTES, shopierWebhookOrderId } from '../../api/_lib/shopierWebhook.ts';
import { shopierHmacSha256 } from '../../supabase/functions/_shared/shopierWebhook.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKEN = 'test-webhook-token';

const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  SHOPIER_PAT: 'test-pat',
  SHOPIER_WEBHOOK_TOKEN: TOKEN,
};

const SESSION = {
  id: 'sess_1',
  user_id: 'user_1',
  plan_id: 'premium',
  amount_try: 200,
  currency: 'TRY',
  provider_session_id: 'prod_1',
};

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'ord_1',
    paymentStatus: 'paid',
    currency: 'TRY',
    totals: { total: '200.00' },
    lineItems: [{ productId: 'prod_1', quantity: 1, price: '200.00', total: '200.00' }],
    refunds: [],
    ...over,
  };
}

type Rpc = { data?: unknown; error?: { message: string } | null };

function fakeAdmin(opts: {
  session?: typeof SESSION | null;
  sessionError?: boolean;
  eventError?: boolean;
  rpc?: Record<string, Rpc>;
} = {}) {
  const calls = {
    inserts: [] as { table: string; row: Record<string, unknown> }[],
    rpc: [] as { fn: string; args: Record<string, unknown> }[],
  };
  const admin = {
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          calls.inserts.push({ table, row });
          return { error: opts.eventError ? { message: 'yazilamadi' } : null };
        },
        select() {
          const q = {
            eq: () => q,
            maybeSingle: async () => (opts.sessionError
              ? { data: null, error: { message: 'db' } }
              : { data: opts.session === undefined ? SESSION : opts.session, error: null }),
          };
          return q;
        },
      };
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.rpc.push({ fn, args });
      return opts.rpc?.[fn] ?? { data: { ok: true }, error: null };
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

type FetchCall = { url: string; method: string };

function stubShopier(orderBody: unknown, status = 200) {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || 'GET');
    calls.push({ url, method });
    if (method === 'GET' && url.includes('/orders/')) {
      return new Response(JSON.stringify(orderBody), { status });
    }
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 });
  }));
  return calls;
}

async function signedRequest(body: unknown, headers: Record<string, string> = {}, sign = true) {
  const raw = JSON.stringify(body);
  const { hex } = await shopierHmacSha256(TOKEN, raw);
  return new Request('https://e-kocluk.vercel.app/api/shopier/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Shopier-Event': 'order.created',
      ...(sign ? { 'Shopier-Signature': hex } : {}),
      ...headers,
    },
    body: raw,
  });
}

function deps(admin: SupabaseClient, env: Record<string, string> = ENV, extra: { deadlineMs?: number } = {}) {
  let created = 0;
  return {
    get created() {
      return created;
    },
    value: {
      env: (name: string) => env[name],
      createAdmin: () => {
        created += 1;
        return admin;
      },
      memory: new Map(),
      ...extra,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Vercel /api/shopier/webhook: kapı', () => {
  it('POST dışını 405 ile reddeder', async () => {
    const { admin } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const res = await handleShopierWebhook(new Request('https://x/api/shopier/webhook'), deps(admin).value);
    expect(res.status).toBe(405);
    expect(fetchCalls).toHaveLength(0);
  });

  it('webhook token veya PAT yoksa 503; sipariş okunmaz', async () => {
    const { admin } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const env = { ...ENV, SHOPIER_WEBHOOK_TOKEN: '' };
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin, env).value);
    expect(res.status).toBe(503);
    expect(fetchCalls).toHaveLength(0);
  });

  it('service role yoksa 503', async () => {
    const { admin } = fakeAdmin();
    stubShopier(order());
    const env = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' };
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin, env).value);
    expect(res.status).toBe(503);
  });

  it('imza başlığı yoksa 401; Shopier ve veritabanına dokunulmaz', async () => {
    const { admin, calls } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const d = deps(admin);
    const res = await handleShopierWebhook(await signedRequest(order(), {}, false), d.value);
    expect(res.status).toBe(401);
    expect(fetchCalls).toHaveLength(0);
    expect(d.created).toBe(0);
    expect(calls.inserts).toHaveLength(0);
  });

  it('geçersiz imza 401; gövde değiştirilirse imza tutmaz', async () => {
    const { admin, calls } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const good = await signedRequest(order());
    const sig = good.headers.get('Shopier-Signature') || '';
    const tampered = new Request(good.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Shopier-Signature': sig },
      body: JSON.stringify(order({ id: 'ord_baska' })),
    });
    const res = await handleShopierWebhook(tampered, deps(admin).value);
    expect(res.status).toBe(401);
    expect(fetchCalls).toHaveLength(0);
    expect(calls.rpc).toHaveLength(0);
  });

  it('büyük gövdeyi 413 ile reddeder', async () => {
    const { admin } = fakeAdmin();
    stubShopier(order());
    const req = await signedRequest(order(), { 'content-length': String(MAX_BODY_BYTES + 1) });
    const res = await handleShopierWebhook(req, deps(admin).value);
    expect(res.status).toBe(413);
  });
});

describe('Vercel /api/shopier/webhook: ödeme', () => {
  it('imzalı + paid + eşleşen ürün: apply_verified_payment çağrılır, ürün silinir', async () => {
    const { admin, calls } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, applied: true, duplicatePayment: false });
    expect(calls.rpc.map((c) => c.fn)).toEqual(['apply_verified_payment']);
    expect(calls.rpc[0].args).toMatchObject({
      p_user_id: 'user_1',
      p_plan_id: 'premium',
      p_provider: 'shopier',
      p_payment_id: 'ord_1',
      p_amount_try: 200,
      p_checkout_id: 'sess_1',
    });
    expect(calls.inserts[0]).toMatchObject({ table: 'billing_events', row: { event_id: 'shopier:ord_1:order.created' } });
    expect(fetchCalls.some((c) => c.method === 'DELETE' && c.url.endsWith('/products/prod_1'))).toBe(true);
  });

  it('tutar ve plan gövdeden alınmaz: gövdedeki sahte tutar etkisiz, Shopier siparişi esas', async () => {
    const { admin, calls } = fakeAdmin();
    stubShopier(order({ totals: { total: '1.00' } }));
    const res = await handleShopierWebhook(await signedRequest(order({ totals: { total: '200.00' } })), deps(admin).value);
    expect(await res.json()).toMatchObject({ applied: false, reason: 'siparis_dogrulanamadi' });
    expect(calls.rpc).toHaveLength(0);
  });

  it('tekrar gelen ödeme: duplicate, ürün silinmez', async () => {
    const { admin } = fakeAdmin({ rpc: { apply_verified_payment: { data: { ok: true, duplicate_payment: true }, error: null } } });
    const fetchCalls = stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(await res.json()).toMatchObject({ ok: true, applied: false, duplicatePayment: true });
    expect(fetchCalls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('ödenmemiş sipariş üyelik açmaz', async () => {
    const { admin, calls } = fakeAdmin();
    stubShopier(order({ paymentStatus: 'unpaid' }));
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(await res.json()).toMatchObject({ applied: false, reason: 'siparis_dogrulanamadi' });
    expect(calls.rpc).toHaveLength(0);
  });

  it('eşlenmemiş ürün üyelik açmaz', async () => {
    const { admin, calls } = fakeAdmin({ session: null });
    stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(await res.json()).toMatchObject({ applied: false, reason: 'urun_oturum_yok' });
    expect(calls.rpc).toHaveLength(0);
  });

  it('oturum okuma hatası 500 (Shopier tekrar dener), üyelik yazılmaz', async () => {
    const { admin, calls } = fakeAdmin({ sessionError: true });
    stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(res.status).toBe(500);
    expect(calls.rpc).toHaveLength(0);
  });

  it('olay kaydı yazılamazsa 500', async () => {
    const { admin, calls } = fakeAdmin({ eventError: true });
    stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(res.status).toBe(500);
    expect(calls.rpc).toHaveLength(0);
  });

  it('RPC hatası 500', async () => {
    const { admin } = fakeAdmin({ rpc: { apply_verified_payment: { data: null, error: { message: 'rpc yok' } } } });
    stubShopier(order());
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(res.status).toBe(500);
  });

  it('Shopier sipariş GET başarısızsa 502', async () => {
    const { admin, calls } = fakeAdmin();
    stubShopier({}, 500);
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin).value);
    expect(res.status).toBe(502);
    expect(calls.inserts).toHaveLength(0);
  });

  it('süre aşımında 503 döner (200 dönülmez)', async () => {
    const { admin } = fakeAdmin();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const res = await handleShopierWebhook(await signedRequest(order()), deps(admin, ENV, { deadlineMs: 30 }).value);
    expect(res.status).toBe(503);
  });
});

describe('Vercel /api/shopier/webhook: iade', () => {
  it('tamamlanmış iade apply_payment_refund çağırır, üyelik açmaz', async () => {
    const { admin, calls } = fakeAdmin({
      rpc: { apply_payment_refund: { data: { ok: true, applied: true, revoked: true, reason: 'tam_iade' }, error: null } },
    });
    stubShopier(order({ refunds: [{ id: 'r1', type: 'full', status: 'succeeded', total: '200.00' }] }));
    const req = await signedRequest({ orderId: 'ord_1' }, { 'Shopier-Event': 'refund.updated' });
    const res = await handleShopierWebhook(req, deps(admin).value);
    expect(await res.json()).toMatchObject({ ok: true, applied: false, refunded: true, revoked: true });
    expect(calls.rpc.map((c) => c.fn)).toEqual(['apply_payment_refund']);
    expect(calls.rpc[0].args).toMatchObject({ p_provider: 'shopier', p_payment_id: 'ord_1', p_refunded_total: 200 });
  });

  it('tamamlanmamış iade olayı hiçbir RPC çağırmaz', async () => {
    const { admin, calls } = fakeAdmin();
    stubShopier(order({ refunds: [{ id: 'r1', type: 'full', status: 'pending', total: '200.00' }] }));
    const req = await signedRequest({ orderId: 'ord_1' }, { 'Shopier-Event': 'refund.updated' });
    const res = await handleShopierWebhook(req, deps(admin).value);
    expect(await res.json()).toMatchObject({ applied: false, reason: 'iade_tamamlanmadi' });
    expect(calls.rpc).toHaveLength(0);
  });
});

describe('Vercel /api/shopier/webhook: sipariş kimliği', () => {
  it('açık sipariş alanları kök/data id’den önce gelir', () => {
    expect(shopierWebhookOrderId({ data: { id: 'ref_1', orderId: 'ord_1' } }, 'refund.updated')).toBe('ord_1');
    expect(shopierWebhookOrderId({ data: { id: 'ref_1', order: { id: 'ord_2' } } }, 'refund.updated')).toBe('ord_2');
    expect(shopierWebhookOrderId({ id: 'ref_1', orderId: 'ord_3' }, 'refund.updated')).toBe('ord_3');
    expect(shopierWebhookOrderId({ id: 'ref_1', order: { id: 'ord_4' } }, 'refund.updated')).toBe('ord_4');
    expect(shopierWebhookOrderId({ orderId: 12345 }, 'refund.updated')).toBe('12345');
  });

  it('iade olayında açık sipariş alanı yoksa kök/data id kullanılmaz', () => {
    expect(shopierWebhookOrderId({ id: 'ref_1' }, 'refund.updated')).toBe('');
    expect(shopierWebhookOrderId({ data: { id: 'ref_1' } }, 'refund.updated')).toBe('');
  });

  it('sipariş olayında Order gövdesinin kendi id’si geçerli', () => {
    expect(shopierWebhookOrderId(order(), 'order.created')).toBe('ord_1');
    expect(shopierWebhookOrderId({ data: { id: 'ord_5' } }, 'order.created')).toBe('ord_5');
  });

  it('biçim dışı kimlik reddedilir', () => {
    expect(shopierWebhookOrderId({ orderId: '../products/x' }, 'refund.updated')).toBe('');
    expect(shopierWebhookOrderId({ orderId: { id: 'x' } }, 'refund.updated')).toBe('');
    expect(shopierWebhookOrderId({ orderId: -1 }, 'refund.updated')).toBe('');
  });

  it('iade gövdesinde yalnız iade id’si varsa 400; Shopier ve veritabanına dokunulmaz', async () => {
    const { admin, calls } = fakeAdmin();
    const fetchCalls = stubShopier(order());
    const req = await signedRequest({ data: { id: 'ref_1', status: 'succeeded' } }, { 'Shopier-Event': 'refund.updated' });
    const res = await handleShopierWebhook(req, deps(admin).value);
    expect(res.status).toBe(400);
    expect(fetchCalls).toHaveLength(0);
    expect(calls.inserts).toHaveLength(0);
  });

  it('data.id iade, data.orderId sipariş: yalnız sipariş kimliğiyle GET yapılır', async () => {
    const { admin } = fakeAdmin();
    const fetchCalls = stubShopier(order({ refunds: [{ id: 'ref_1', type: 'full', status: 'succeeded', total: '200.00' }] }));
    const req = await signedRequest({ data: { id: 'ref_1', orderId: 'ord_1' } }, { 'Shopier-Event': 'refund.updated' });
    await handleShopierWebhook(req, deps(admin).value);
    const gets = fetchCalls.filter((c) => c.method === 'GET');
    expect(gets.map((c) => c.url)).toEqual(['https://api.shopier.com/v1/orders/ord_1']);
  });

  it('nesne olmayan JSON 400 (500 değil)', async () => {
    const { admin } = fakeAdmin();
    stubShopier(order());
    for (const body of [null, [1, 2], 'metin']) {
      const res = await handleShopierWebhook(await signedRequest(body), deps(admin).value);
      expect(res.status).toBe(400);
    }
  });

  it('imzasız Shopier-Event başlığı olay kimliğine sınırlı karakterle yazılır', async () => {
    const { admin, calls } = fakeAdmin();
    stubShopier(order());
    await handleShopierWebhook(await signedRequest(order(), { 'Shopier-Event': 'order.created<script>' }), deps(admin).value);
    expect(calls.inserts[0].row.event_id).toBe('shopier:ord_1:order.created_script_');
  });
});

describe('Vercel yapılandırması', () => {
  it('SPA yönlendirmesi /api isteklerini index.html’e çevirmez', () => {
    const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { rewrites: { source: string }[] };
    const spa = cfg.rewrites.find((r) => r.source.includes('(?!'));
    expect(spa?.source).toContain('(?!api/');
  });

  it('endpoint Edge runtime, secret’lar VITE_ önekiyle okunmaz', () => {
    const entry = readFileSync(join(root, 'api', 'shopier', 'webhook.ts'), 'utf8');
    const core = readFileSync(join(root, 'api', '_lib', 'shopierWebhook.ts'), 'utf8');
    expect(entry).toMatch(/runtime:\s*"edge"/);
    for (const src of [entry, core]) {
      expect(src).not.toMatch(/VITE_[A-Z_]*(SERVICE|SECRET|TOKEN|PAT)/);
      expect(src).not.toMatch(/console\.(log|info|error|warn)/);
    }
  });
});
