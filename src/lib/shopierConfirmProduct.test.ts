import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shopierConfirmCreatedProduct } from '../../supabase/functions/_shared/shopierApi.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const created = { id: 'prod_1', url: 'https://www.shopier.com/s/prod_1' };

function stubGet(status: number, body: unknown = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method || 'GET'} ${url}`);
    return new Response(JSON.stringify(body), { status });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('yeni Shopier ürününün ödeme linki', () => {
  it('GET 200 ve id eşleşirse Shopier\'den okunan link', async () => {
    const calls = stubGet(200, { id: 'prod_1', url: 'https://www.shopier.com/s/okunan' });
    expect(await shopierConfirmCreatedProduct('pat', created)).toEqual({ ok: true, url: 'https://www.shopier.com/s/okunan', verifiedByGet: true });
    expect(calls).toEqual(['GET https://api.shopier.com/v1/products/prod_1']);
  });

  it('yalnız 403 (PAT ürün okuyamıyor): POST yanıtındaki link kullanılır', async () => {
    stubGet(403, { message: 'Access to this resource on the server is denied' });
    expect(await shopierConfirmCreatedProduct('pat', created)).toEqual({ ok: true, url: created.url, verifiedByGet: false });
  });

  it('404, 500 veya 401: link verilmez', async () => {
    for (const status of [404, 500, 401]) {
      stubGet(status);
      expect((await shopierConfirmCreatedProduct('pat', created)).ok).toBe(false);
    }
  });

  it('GET 200 ama başka ürün: link verilmez', async () => {
    stubGet(200, { id: 'prod_baska', url: 'https://www.shopier.com/s/baska' });
    expect((await shopierConfirmCreatedProduct('pat', created)).ok).toBe(false);
  });

  it('ağ hatası: link verilmez', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect((await shopierConfirmCreatedProduct('pat', created)).ok).toBe(false);
  });

  it('403 olsa bile POST linki https değilse link verilmez', async () => {
    stubGet(403);
    expect((await shopierConfirmCreatedProduct('pat', { id: 'prod_1', url: 'http://guvensiz' })).ok).toBe(false);
  });

  it('billing-checkout ve billing-guest son linki bu yardımcıdan alır', () => {
    for (const f of ['supabase/functions/billing-checkout/index.ts', 'supabase/functions/billing-guest/index.ts']) {
      const src = read(f);
      expect(src).toMatch(/const live = await shopierConfirmCreatedProduct\(secrets\.pat, created\.product\);\n\s*if \(!live\.ok\) \{/);
      expect(src).toMatch(/checkout_url: live\.url/);
    }
  });
});
