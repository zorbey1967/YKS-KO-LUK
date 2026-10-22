#!/usr/bin/env node
/**
 * GEÇİCİ — Shopier'de YENİ bir webhook aboneliği açar. Mevcut aboneliklere DOKUNMAZ (silmez, değiştirmez).
 *
 * Varsayılan: KURU ÇALIŞMA. Yalnız mevcut abonelikleri okur ve göndereceği isteği gösterir; hiçbir şey açmaz.
 * Gerçekten açmak için açıkça --uygula verilmelidir:
 *
 *   $env:SHOPIER_PAT = "<Shopier erişim anahtarı>"
 *   node scripts/shopier-webhook-create.mjs            # kuru çalışma
 *   node scripts/shopier-webhook-create.mjs --uygula   # YALNIZ onaydan sonra
 *   Remove-Item Env:SHOPIER_PAT
 *
 * Güvenlik:
 * - Aynı olay + aynı adres zaten varsa ikinci abonelik AÇILMAZ.
 * - Hedef adres sabittir (Supabase billing-webhook); parametreyle değiştirilemez.
 * - Shopier'in döndürdüğü imza anahtarı (token) ekrana veya loga YAZILMAZ; doğrudan Supabase secret
 *   SHOPIER_WEBHOOK_TOKEN olarak kaydedilir (kısa ömürlü env dosyası hemen silinir) ve Supabase'in
 *   sakladığı sha256 özetiyle doğrulanır.
 */

const API = 'https://api.shopier.com/v1';
const TARGET_URL = 'https://naiakscryafhvcghjmzx.supabase.co/functions/v1/billing-webhook';
const EVENT = 'order.created';
const apply = process.argv.includes('--uygula');

const pat = String(process.env.SHOPIER_PAT || '').trim();
if (!pat) {
  console.error('SHOPIER_PAT ortam değişkeni yok. PowerShell: $env:SHOPIER_PAT = "..."');
  process.exit(2);
}

async function call(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    return await fetch(`${API}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${pat}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

function listOf(body) {
  return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.webhooks) ? body.webhooks : [];
}
const eventsOf = (w) => (Array.isArray(w?.events) ? w.events : w?.event ? [w.event] : []).map(String);
const safe = (w) => ({ id: String(w?.id || ''), url: String(w?.url || ''), events: eventsOf(w) });

// 1) Mevcut abonelikleri oku (salt okuma)
let res;
try {
  res = await call('GET', '/webhooks');
} catch {
  console.error('Shopier ağ hatası veya zaman aşımı. Hiçbir şey açılmadı.');
  process.exit(1);
}
if (!res.ok) {
  console.error(`GET /webhooks → HTTP ${res.status}. Hiçbir şey açılmadı.`);
  process.exit(1);
}
let current;
try { current = listOf(JSON.parse(await res.text())); } catch { console.error('Liste JSON değil. Hiçbir şey açılmadı.'); process.exit(1); }
console.log('Mevcut abonelikler (değiştirilmeyecek):');
console.log(JSON.stringify(current.map(safe), null, 2));

const already = current.find((w) => String(w?.url || '') === TARGET_URL && eventsOf(w).includes(EVENT));
if (already) {
  console.log(`\nZaten var: ${already.id} (${EVENT} → ${TARGET_URL}). Yeni abonelik AÇILMADI.`);
  process.exit(0);
}

const request = { event: EVENT, url: TARGET_URL };
console.log(`\nGönderilecek istek: POST ${API}/webhooks`);
console.log(JSON.stringify(request, null, 2));

if (!apply) {
  console.log('\nKURU ÇALIŞMA: hiçbir abonelik açılmadı. Açmak için onaydan sonra --uygula ile çalıştır.');
  process.exit(0);
}

// 2) Yalnız --uygula ile: yeni abonelik
let created;
try {
  created = await call('POST', '/webhooks', request);
} catch {
  console.error('Shopier ağ hatası. Abonelik açılıp açılmadığını önce salt okuma listesiyle kontrol et; tekrar çalıştırma.');
  process.exit(1);
}
const text = await created.text();
if (!created.ok) {
  // Yalnız hata metni alanları; uzun/anahtar benzeri değerler maskelenir, gövdenin geri kalanı yazdırılmaz.
  let reason = '';
  try {
    const e = JSON.parse(text);
    const pick = (o) => (o && typeof o === 'object' ? ['message', 'error', 'detail', 'title', 'code'].map((k) => (typeof o[k] === 'string' || typeof o[k] === 'number' ? `${k}=${o[k]}` : '')).filter(Boolean) : []);
    reason = [...pick(e), ...pick(e?.error), ...(Array.isArray(e?.errors) ? e.errors.flatMap(pick) : [])].join(' | ');
  } catch {
    reason = '';
  }
  reason = reason.replace(/[A-Za-z0-9_\-.]{32,}/g, '<maskelendi>').slice(0, 300);
  console.error(`POST /webhooks → HTTP ${created.status}${reason ? ` | ${reason}` : ' (hata metni yok)'}. Mevcut abonelikler değişmedi.`);
  process.exit(1);
}
let data;
try { data = JSON.parse(text); } catch { data = null; }
const w = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
console.log('\nYENİ abonelik açıldı:');
console.log(JSON.stringify(safe(w), null, 2));
const token = String(w?.token || w?.initial_token || '');
if (!token) {
  console.log('\nUYARI: Yanıtta imza anahtarı (token) yok. Webhook imzası doğrulanamaz; canlı teste geçme.');
  process.exit(1);
}

// Token ekrana/loga yazılmaz: kısa ömürlü env dosyasıyla doğrudan Supabase secret'ına yazılır, dosya hemen silinir.
// Sonra Supabase'in sakladığı özet (sha256) ile karşılaştırılır; değer görünmeden doğru kaydedildiği doğrulanır.
const { spawnSync } = await import('node:child_process');
const { createHash, randomBytes } = await import('node:crypto');
const { writeFileSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const PROJECT_REF = 'naiakscryafhvcghjmzx';
const envFile = join(tmpdir(), `yks_wh_${randomBytes(8).toString('hex')}.env`);
const quoted = token.includes("'") ? `"${token.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `'${token}'`;
let stored = false;
try {
  writeFileSync(envFile, `SHOPIER_WEBHOOK_TOKEN=${quoted}\n`, { mode: 0o600 });
  const set = spawnSync('cmd.exe', ['/d', '/s', '/c', `npx.cmd --yes supabase secrets set --env-file "${envFile}" --project-ref ${PROJECT_REF}`], { encoding: 'utf8' });
  stored = set.status === 0;
} finally {
  rmSync(envFile, { force: true });
}
const list = spawnSync('cmd.exe', ['/d', '/s', '/c', `npx.cmd --yes supabase secrets list --project-ref ${PROJECT_REF} -o json`], { encoding: 'utf8' });
let digestOk = false;
try {
  const rows = JSON.parse(String(list.stdout || '').slice(String(list.stdout || '').indexOf('[')));
  const row = rows.find((r) => r.name === 'SHOPIER_WEBHOOK_TOKEN');
  digestOk = Boolean(row) && String(row.value || '').toLowerCase() === createHash('sha256').update(token).digest('hex');
} catch {
  digestOk = false;
}
if (stored && digestOk) {
  console.log('\nSUPABASE_SECRET SHOPIER_WEBHOOK_TOKEN: KAYDEDILDI ve ozet eslesti (deger yazdirilmadi).');
} else {
  console.log(`\nSUPABASE_SECRET SHOPIER_WEBHOOK_TOKEN: BASARISIZ (set=${stored}, ozet=${digestOk}). Token yazdirilmadi.`);
  console.log(`Bu durumda yeni abonelik (${safe(w).id}) imzasi dogrulanamaz: o aboneligi silip bu scripti yeniden calistirmak gerekir.`);
  process.exit(1);
}
