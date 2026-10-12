/**
 * Isolate-local token bucket. Not a distributed quota.
 * Edge replicas do not share this Map; production still needs Redis/gateway limits.
 *
 * Staging için gerçek kota (bu dosya yeterli değil):
 * - Upstash Redis REST veya Vercel KV (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * - veya Cloudflare/API gateway rate limit (IP)
 * Test: aynı user_id ile iki isolate’ta limit aşımı; loglarda IP hash / user uuid, ham e-posta yok.
 */

export type RateBucket = { n: number; resetAt: number };
export type RateStore = Map<string, RateBucket>;

export function allowRate(opts: {
  store: RateStore;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}) {
  const now = opts.now ?? Date.now();
  const key = String(opts.key || '').slice(0, 200);
  if (!key || opts.limit < 1 || opts.windowMs < 1) return false;
  const cur = opts.store.get(key);
  if (!cur || now >= cur.resetAt) {
    opts.store.set(key, { n: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (cur.n >= opts.limit) return false;
  cur.n += 1;
  return true;
}
