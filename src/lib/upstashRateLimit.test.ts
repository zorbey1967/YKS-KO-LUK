import { describe, expect, it, vi } from 'vitest';
import { allowRate, type RateStore } from '../../supabase/functions/_shared/edgeRateLimit.ts';
import {
  allowDistributed,
  readUpstashEnv,
  upstashPipelineBody,
} from '../../supabase/functions/_shared/upstashRateLimit.ts';

describe('Map kota çoklu isolate’ta yetersiz', () => {
  it('iki ayrı Map aynı kullanıcıya limiti iki kez verir', () => {
    const a: RateStore = new Map();
    const b: RateStore = new Map();
    const t0 = 1_000;
    expect(allowRate({ store: a, key: 'u1', limit: 1, windowMs: 1000, now: t0 })).toBe(true);
    expect(allowRate({ store: a, key: 'u1', limit: 1, windowMs: 1000, now: t0 + 1 })).toBe(false);
    expect(allowRate({ store: b, key: 'u1', limit: 1, windowMs: 1000, now: t0 + 1 })).toBe(true);
  });
});

describe('Upstash tasarım (ağ yok)', () => {
  it('eksik veya gayrimeşru URL’yi yok sayar', () => {
    expect(readUpstashEnv({ get: () => undefined })).toBeNull();
    expect(readUpstashEnv({ get: (n) => (n.includes('URL') ? 'http://evil.example' : 'tok') })).toBeNull();
    expect(readUpstashEnv({
      get: (n) => (n.includes('URL') ? 'https://us1-demo.upstash.io' : 'tok'),
    })).toEqual({ url: 'https://us1-demo.upstash.io', token: 'tok' });
  });

  it('pipeline INCR+EXPIRE üretir; mock fetch limit aşınca reddeder', async () => {
    expect(upstashPipelineBody('u1', 60)).toContain('INCR');
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ result: 3 }, { result: 1 }]), { status: 200 }));
    const ok = await allowDistributed({
      memory: new Map(),
      key: 'u1',
      limit: 2,
      windowMs: 60_000,
      upstash: { url: 'https://us1-demo.upstash.io', token: 'tok' },
      fetchImpl,
    });
    expect(ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us1-demo.upstash.io/pipeline');
    expect(String((init.headers as Record<string, string>).Authorization)).toMatch(/^Bearer /);
  });

  it('paylaşılan sayaç iki isolate’i tek limite bağlar (mock, ağ yok)', async () => {
    let n = 0;
    const fetchImpl = async () => {
      n += 1;
      return new Response(JSON.stringify([{ result: n }, { result: 1 }]), { status: 200 });
    };
    const env = { url: 'https://us1-demo.upstash.io', token: 'tok' };
    const a = await allowDistributed({ memory: new Map(), key: 'u', limit: 2, windowMs: 1000, upstash: env, fetchImpl });
    const b = await allowDistributed({ memory: new Map(), key: 'u', limit: 2, windowMs: 1000, upstash: env, fetchImpl });
    const c = await allowDistributed({ memory: new Map(), key: 'u', limit: 2, windowMs: 1000, upstash: env, fetchImpl });
    expect([a, b, c]).toEqual([true, true, false]);
  });

  it('Upstash hata verirse Map’e düşmez, reddeder', async () => {
    const fetchImpl = async () => { throw new Error('network'); };
    const ok = await allowDistributed({
      memory: new Map(),
      key: 'u',
      limit: 99,
      windowMs: 1000,
      upstash: { url: 'https://us1-demo.upstash.io', token: 'tok' },
      fetchImpl,
    });
    expect(ok).toBe(false);
  });

  it('Upstash env yoksa belleğe düşer ve fetch çağırmaz', async () => {
    const fetchImpl = vi.fn();
    const mem: RateStore = new Map();
    await expect(allowDistributed({
      memory: mem,
      key: 'u1',
      limit: 1,
      windowMs: 1000,
      now: 5,
      upstash: null,
      fetchImpl,
    })).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
