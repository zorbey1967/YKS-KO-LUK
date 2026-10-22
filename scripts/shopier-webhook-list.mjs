#!/usr/bin/env node
/**
 * GEÇİCİ — Shopier webhook aboneliklerini YALNIZ OKUR. Hiçbir aboneliği değiştirmez, silmez, oluşturmaz.
 *
 *   $env:SHOPIER_PAT = "<Shopier erişim anahtarı>"
 *   node scripts/shopier-webhook-list.mjs
 *   Remove-Item Env:SHOPIER_PAT
 *
 * Gösterilen: abonelik id, adres, olay(lar), tarih alanları ve tüm anahtar ADLARI.
 * Gizlenen: token/secret/key içeren her alanın değeri (yalnız "<gizli>" yazılır).
 * Ek olarak her abonelik adresi için OPTIONS ile sunucunun izin verdiği yöntemler (Allow) sorulur;
 * OPTIONS hiçbir şeyi değiştirmez. PUT/PATCH/DELETE/POST GÖNDERİLMEZ.
 */

const API = 'https://api.shopier.com/v1';
const pat = String(process.env.SHOPIER_PAT || '').trim();
if (!pat) {
  console.error('SHOPIER_PAT ortam değişkeni yok. PowerShell: $env:SHOPIER_PAT = "..."');
  process.exit(2);
}

const SECRETISH = /token|secret|key|signature|hash|password/i;
const SAFE = /^(id|url|event|events|topic|topics|status|active|enabled|createdAt|updatedAt|dateCreated|dateUpdated|type|name|description)$/i;

function view(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRETISH.test(k)) { out[k] = '<gizli>'; continue; }
    if (Array.isArray(v)) { out[k] = v.every((x) => typeof x === 'string' && x.length < 80) ? v : `<array(${v.length})>`; continue; }
    if (v && typeof v === 'object') { out[k] = '<object>'; continue; }
    out[k] = SAFE.test(k) ? v : `<${typeof v}>`;
  }
  return out;
}

async function call(method, path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    return await fetch(`${API}${path}`, { method, headers: { accept: 'application/json', authorization: `Bearer ${pat}` }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

let res;
try {
  res = await call('GET', '/webhooks');
} catch {
  console.error('Shopier ağ hatası veya zaman aşımı.');
  process.exit(1);
}
const text = await res.text();
if (!res.ok) {
  console.error(`GET /webhooks → HTTP ${res.status} (gövde yazdırılmadı).`);
  process.exit(1);
}
let body;
try { body = JSON.parse(text); } catch { console.error('Cevap JSON değil.'); process.exit(1); }
const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.webhooks) ? body.webhooks : null;

const report = {
  listShape: Array.isArray(body) ? 'array' : list ? 'object.data/webhooks' : `<${typeof body}> keys: ${body && typeof body === 'object' ? Object.keys(body).join(',') : ''}`,
  count: list ? list.length : 0,
  webhooks: [],
};
for (const w of list || []) {
  const id = w && typeof w === 'object' ? String(w.id || '') : '';
  const entry = { keys: w && typeof w === 'object' ? Object.keys(w) : [], view: view(w) };
  if (id && /^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    try {
      const o = await call('OPTIONS', `/webhooks/${encodeURIComponent(id)}`);
      entry.optionsStatus = o.status;
      entry.allow = o.headers.get('allow') || o.headers.get('access-control-allow-methods') || '';
    } catch {
      entry.optionsStatus = 'ağ hatası';
    }
  }
  report.webhooks.push(entry);
}
console.log(JSON.stringify(report, null, 2));
