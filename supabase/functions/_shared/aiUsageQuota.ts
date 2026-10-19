/**
 * ZORRO (student-ai) günlük / aylık kullanım sınırı.
 * Sınırlar ortam değişkeniyle ayarlanır; 0 = sınır yok. Kalıcı sayaç için UPSTASH_REDIS_REST_* gerekir
 * (yoksa her Edge örneği kendi belleğinde sayar; bu yalnızca yaklaşık bir sınırdır).
 *
 *   AI_DAILY_LIMIT_PRO      (varsayılan 40)
 *   AI_DAILY_LIMIT_PREMIUM  (varsayılan 150; deneme süresi de bunu kullanır)
 *   AI_MONTHLY_LIMIT_PRO    (varsayılan 800)
 *   AI_MONTHLY_LIMIT_PREMIUM(varsayılan 3000)
 */
export type AiQuota = { daily: number; monthly: number };

function num(env: { get(name: string): string | undefined }, key: string, fallback: number) {
  const raw = String(env.get(key) ?? '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function aiQuotaFor(tier: string, role: string, env: { get(name: string): string | undefined }): AiQuota {
  if (role === 'admin') return { daily: 0, monthly: 0 };
  if (tier === 'pro') {
    return { daily: num(env, 'AI_DAILY_LIMIT_PRO', 40), monthly: num(env, 'AI_MONTHLY_LIMIT_PRO', 800) };
  }
  return { daily: num(env, 'AI_DAILY_LIMIT_PREMIUM', 150), monthly: num(env, 'AI_MONTHLY_LIMIT_PREMIUM', 3000) };
}

/** Sayaç anahtarları İstanbul takvim gününe / ayına göre (gece yarısı sıfırlanır). */
export function aiQuotaKeys(userId: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { day: `ai:d:${userId}:${parts}`, month: `ai:m:${userId}:${parts.slice(0, 7)}` };
}
