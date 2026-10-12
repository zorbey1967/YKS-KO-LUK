import { allowRate, type RateStore } from "./edgeRateLimit.ts";

/**
 * Upstash REST tasarımı. URL/token yoksa çağrı yapılmaz (yerel Map).
 * İki Edge isolate Map paylaşmaz; Upstash aynı key’i paylaşır.
 * Dış ağa bu dosyadan varsayılan bağlanılmaz.
 */

export type UpstashEnv = { url: string; token: string };

export function readUpstashEnv(env: { get(name: string): string | undefined }) {
  const url = String(env.get("UPSTASH_REDIS_REST_URL") || "").trim().replace(/\/$/, "");
  const token = String(env.get("UPSTASH_REDIS_REST_TOKEN") || "").trim();
  if (!url || !token) return null;
  if (!/^https:\/\/[a-z0-9.-]+\.upstash\.io$/i.test(url)) return null;
  return { url, token } as UpstashEnv;
}

export function upstashPipelineBody(key: string, windowSec: number) {
  const k = `rl:${key}`.slice(0, 200);
  return JSON.stringify([
    ["INCR", k],
    ["EXPIRE", k, String(windowSec), "NX"],
  ]);
}

export async function allowUpstash(opts: {
  env: UpstashEnv;
  key: string;
  limit: number;
  windowMs: number;
  fetchImpl: typeof fetch;
}) {
  const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000));
  const res = await opts.fetchImpl(`${opts.env.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.env.token}`,
      "Content-Type": "application/json",
    },
    body: upstashPipelineBody(opts.key, windowSec),
  });
  if (!res.ok) return false;
  const json = await res.json() as { result?: number }[];
  const n = Number(json?.[0]?.result);
  if (!Number.isFinite(n)) return false;
  return n <= opts.limit;
}

/** Env yoksa bellek; varsa Upstash. İki ayrı Map limiti 2x kanıtlar. */
export async function allowDistributed(opts: {
  memory: RateStore;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
  upstash: UpstashEnv | null;
  fetchImpl?: typeof fetch;
}) {
  if (opts.upstash && opts.fetchImpl) {
    try {
      return await allowUpstash({
        env: opts.upstash,
        key: opts.key,
        limit: opts.limit,
        windowMs: opts.windowMs,
        fetchImpl: opts.fetchImpl,
      });
    } catch {
      return false;
    }
  }
  return allowRate({
    store: opts.memory,
    key: opts.key,
    limit: opts.limit,
    windowMs: opts.windowMs,
    now: opts.now,
  });
}
