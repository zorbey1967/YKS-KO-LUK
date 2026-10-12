import { describe, expect, it } from 'vitest';
import { allowRate, type RateStore } from '../../supabase/functions/_shared/edgeRateLimit.ts';

describe('allowRate (isolate bucket)', () => {
  it('pencere içinde limiti aşınca reddeder, sonra sıfırlar', () => {
    const store: RateStore = new Map();
    const t0 = 1_000_000;
    expect(allowRate({ store, key: 'u1', limit: 2, windowMs: 1000, now: t0 })).toBe(true);
    expect(allowRate({ store, key: 'u1', limit: 2, windowMs: 1000, now: t0 + 1 })).toBe(true);
    expect(allowRate({ store, key: 'u1', limit: 2, windowMs: 1000, now: t0 + 2 })).toBe(false);
    expect(allowRate({ store, key: 'u2', limit: 2, windowMs: 1000, now: t0 + 2 })).toBe(true);
    expect(allowRate({ store, key: 'u1', limit: 2, windowMs: 1000, now: t0 + 1000 })).toBe(true);
  });

  it('boş anahtarı reddeder', () => {
    const store: RateStore = new Map();
    expect(allowRate({ store, key: '', limit: 5, windowMs: 1000, now: 1 })).toBe(false);
  });
});
