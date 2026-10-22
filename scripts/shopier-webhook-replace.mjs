#!/usr/bin/env node
/**
 * Shopier order.created aboneliğini eski Vercel adresinden Supabase billing-webhook'a TAŞIR.
 * Shopier aynı olay için ikinci aboneliğe izin vermiyor (409) ve aboneliği güncellemiyor (yalnız DELETE):
 * bu yüzden eskisi silinip hemen yenisi açılır.
 *
 *   $env:SHOPIER_PAT = "<Shopier erişim anahtarı>"
 *   node scripts/shopier-webhook-replace.mjs --eski 462e51eca1783e29            # kuru çalışma
 *   node scripts/shopier-webhook-replace.mjs --eski 462e51eca1783e29 --uygula   # YALNIZ onaydan sonra
 *
 * Güvenlik:
 * - Önce Supabase CLI'nin secret yazabildiği doğrulanır; yazamazsa hiçbir şey silinmez.
 * - Eski abonelik yalnız id + olay + eski adres birebir eşleşirse silinir; başka durumda dokunulmaz.
 * - Silme başarısızsa yeni abonelik açılmaz. Yeniden çalıştırma güvenlidir (eski yoksa yalnız yeni açılır,
 *   hedef zaten varsa hiçbir şey yapılmaz).
 * - Yeni token ekrana/loga yazılmaz: kısa ömürlü env dosyasıyla Supabase secret SHOPIER_WEBHOOK_TOKEN'a
 *   yazılır, dosya hemen silinir ve Supabase'in sha256 özetiyle doğrulanır.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = 'https://api.shopier.com/v1';
const OLD_URL = 'https://e-kocluk.vercel.app/api/shopier/webhook';
const TARGET_URL = 'https://naiakscryafhvcghjmzx.supabase.co/functions/v1/billing-webhook';
const EVENT = 'order.created';
const PROJECT_REF = 'naiakscryafhvcghjmzx';
const apply = process.argv.includes('--uygula');
// Token'ı Supabase'e yazılamamış Supabase aboneliğini silip yeniden açar (token yalnız açılışta bir kez verilir).
const renewTarget = process.argv.includes('--hedefi-yenile');
const EXPECTED_OLD_URL = renewTarget ? TARGET_URL : OLD_URL;
const oldIdArg = (() => {
  const i = process.argv.indexOf('--eski');
  return i > 0 ? String(process.argv[i + 1] || '').trim() : '';
})();

const pat = String(process.env.SHOPIER_PAT || '').trim();
if (!pat) {
  console.error('SHOPIER_PAT ortam değişkeni yok. Hiçbir şey yapılmadı.');
  process.exit(2);
}
if (!/^[A-Za-z0-9_-]{6,80}$/.test(oldIdArg)) {
  console.error('Kullanım: --eski <eski abonelik id> [--uygula]. Hiçbir şey yapılmadı.');
  process.exit(2);
}

async function call(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    return await fetch(`${API}${path}`, {
      method,
      headers: { accept: 'application/json', authorization: `Bearer ${pat}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}
const listOf = (b) => (Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : Array.isArray(b?.webhooks) ? b.webhooks : []);
const eventsOf = (w) => (Array.isArray(w?.events) ? w.events : w?.event ? [w.event] : []).map(String);
const safe = (w) => ({ id: String(w?.id || ''), url: String(w?.url || ''), events: eventsOf(w) });
function reasonOf(text) {
  let r = '';
  try {
    const e = JSON.parse(text);
    const pick = (o) => (o && typeof o === 'object' ? ['message', 'error', 'detail', 'code'].map((k) => (typeof o[k] === 'string' || typeof o[k] === 'number' ? `${k}=${o[k]}` : '')).filter(Boolean) : []);
    r = [...pick(e), ...pick(e?.error)].join(' | ');
  } catch {
    r = '';
  }
  return r.replace(/[A-Za-z0-9_\-.]{32,}/g, '<maskelendi>').slice(0, 300);
}
// shell:true: Node, cmd.exe'ye argüman dizisi verirken iç tırnakları \" yapar ve --env-file yolu bozulur.
function cli(args) {
  return spawnSync(`npx.cmd --yes supabase ${args}`, { encoding: 'utf8', shell: true });
}
function setSecretViaEnvFile(name, value) {
  const envFile = join(tmpdir(), `yks_wh_${randomBytes(8).toString('hex')}.env`);
  const quoted = value.includes("'") ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `'${value}'`;
  try {
    writeFileSync(envFile, `${name}=${quoted}\n`, { mode: 0o600 });
    return cli(`secrets set --env-file "${envFile}" --project-ref ${PROJECT_REF}`).status === 0;
  } finally {
    rmSync(envFile, { force: true });
  }
}
function secretNames() {
  const r = cli(`secrets list --project-ref ${PROJECT_REF} -o json`);
  if (r.status !== 0) return null;
  try {
    const out = String(r.stdout || '');
    return JSON.parse(out.slice(out.indexOf('['))).map((x) => String(x.name));
  } catch {
    return null;
  }
}
function readSecretDigest() {
  const r = cli(`secrets list --project-ref ${PROJECT_REF} -o json`);
  if (r.status !== 0) return { ok: false, digest: '' };
  try {
    const out = String(r.stdout || '');
    const rows = JSON.parse(out.slice(out.indexOf('[')));
    const row = rows.find((x) => x.name === 'SHOPIER_WEBHOOK_TOKEN');
    return { ok: true, digest: String(row?.value || '').toLowerCase() };
  } catch {
    return { ok: false, digest: '' };
  }
}
async function listNow() {
  const res = await call('GET', '/webhooks');
  if (!res.ok) return null;
  try { return listOf(JSON.parse(await res.text())); } catch { return null; }
}

// 0) Supabase CLI secret okuyabiliyor mu. Okuyamıyorsa hiçbir şey silinmez.
const pre = readSecretDigest();
if (!pre.ok) {
  console.error('ON_KONTROL BASARISIZ: Supabase CLI secret listesine erişemedi (giriş/bağlantı). Hiçbir şey silinmedi.');
  process.exit(1);
}
console.log('ON_KONTROL: Supabase CLI erişimi tamam.');
// 0b) YALNIZ --uygula: token yazımıyla AYNI yol (env dosyası) zararsız bir deneme secret'ıyla sınanır, sonra silinir.
if (apply) {
  const probeOk = setSecretViaEnvFile('YKS_CLI_PRECHECK', `ok-${randomBytes(4).toString('hex')}`);
  const names = secretNames();
  const seen = Boolean(names && names.includes('YKS_CLI_PRECHECK'));
  const unset = cli(`secrets unset YKS_CLI_PRECHECK --project-ref ${PROJECT_REF} --yes`).status === 0;
  if (!probeOk || !seen) {
    console.error(`ON_KONTROL BASARISIZ: secret yazma denemesi calismadi (set=${probeOk}, liste=${seen}). Hicbir abonelik silinmedi.`);
    process.exit(1);
  }
  console.log(`ON_KONTROL: secret yazma yolu calisiyor (deneme secret'i ${unset ? 'silindi' : 'SILINEMEDI - elle sil: YKS_CLI_PRECHECK'}).`);
}

// 1) Mevcut abonelikler
const current = await listNow();
if (!current) {
  console.error('GET /webhooks başarısız. Hiçbir şey silinmedi.');
  process.exit(1);
}
console.log('Mevcut abonelikler:');
console.log(JSON.stringify(current.map(safe), null, 2));

const target = current.find((w) => String(w?.url || '') === TARGET_URL && eventsOf(w).includes(EVENT));
if (target && !renewTarget) {
  console.log(`\nHedef abonelik zaten var: ${target.id}. Hiçbir şey yapılmadı.`);
  process.exit(0);
}
const old = current.find((w) => String(w?.id || '') === oldIdArg);
const others = current.filter((w) => String(w?.id || '') !== oldIdArg);
if (old && !(String(old.url || '') === EXPECTED_OLD_URL && eventsOf(old).includes(EVENT))) {
  console.error(`\nDURDU: ${oldIdArg} beklenen eski abonelik değil (adres/olay farklı). Hiçbir şey silinmedi.`);
  process.exit(1);
}
if (others.some((w) => eventsOf(w).includes(EVENT))) {
  console.error(`\nDURDU: ${EVENT} için beklenmeyen başka bir abonelik var. Hiçbir şey silinmedi.`);
  process.exit(1);
}

console.log(`\nPlan: ${old ? `DELETE /webhooks/${oldIdArg} → ` : '(eski abonelik zaten yok) '}POST /webhooks ${JSON.stringify({ event: EVENT, url: TARGET_URL })}`);
if (!apply) {
  console.log('KURU ÇALIŞMA: hiçbir şey silinmedi veya açılmadı. Uygulamak için --uygula.');
  process.exit(0);
}

// 2) Eskiyi sil
if (old) {
  let del;
  try {
    del = await call('DELETE', `/webhooks/${encodeURIComponent(oldIdArg)}`);
  } catch {
    console.error('DELETE ağ hatası. Yeni abonelik açılmadı; durumu salt okuma listesiyle kontrol et.');
    process.exit(1);
  }
  const dtext = await del.text();
  if (!del.ok) {
    console.error(`DELETE → HTTP ${del.status}${reasonOf(dtext) ? ` | ${reasonOf(dtext)}` : ''}. Eski abonelik duruyor; yeni abonelik açılmadı.`);
    process.exit(1);
  }
  console.log(`ESKI_SILINDI: ${oldIdArg} (HTTP ${del.status})`);
}

// 3) Yeniyi aç
let created;
try {
  created = await call('POST', '/webhooks', { event: EVENT, url: TARGET_URL });
} catch {
  console.error('YENI_ACILAMADI (ağ hatası). Şu an aktif abonelik olmayabilir: scripti aynı komutla tekrar çalıştır.');
  process.exit(1);
}
const ctext = await created.text();
if (!created.ok) {
  console.error(`YENI_ACILAMADI: POST → HTTP ${created.status}${reasonOf(ctext) ? ` | ${reasonOf(ctext)}` : ''}. Scripti aynı komutla tekrar çalıştır.`);
  process.exit(1);
}
let data;
try { data = JSON.parse(ctext); } catch { data = null; }
const w = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
console.log('\nYENI_ABONELIK:');
console.log(JSON.stringify(safe(w), null, 2));
const token = String(w?.token || w?.initial_token || '');
if (!token) {
  console.error('UYARI: Yanıtta imza anahtarı (token) yok. Webhook imzası doğrulanamaz; canlı teste geçme.');
  process.exit(1);
}

// 4) Token → Supabase secret (ekrana basılmadan) + özet doğrulama
const stored = setSecretViaEnvFile('SHOPIER_WEBHOOK_TOKEN', token);
const after = readSecretDigest();
const digestOk = after.ok && after.digest === createHash('sha256').update(token).digest('hex');
if (stored && digestOk) {
  console.log('\nSUPABASE_SECRET SHOPIER_WEBHOOK_TOKEN: KAYDEDILDI ve ozet eslesti (deger yazdirilmadi).');
} else {
  console.error(`\nSUPABASE_SECRET SHOPIER_WEBHOOK_TOKEN: BASARISIZ (set=${stored}, ozet=${digestOk}). Token yazdirilmadi.`);
  console.error(`Yeni abonelik (${safe(w).id}) imzası doğrulanamaz: o aboneliği silip bu scripti yeniden çalıştırmak gerekir.`);
  process.exit(1);
}

// 5) Son durum
const final = await listNow();
console.log('\nSon abonelikler:');
console.log(JSON.stringify((final || []).map(safe), null, 2));
// Shopier silinen aboneliğin id'sini yeniden verebiliyor: doğrulama id'ye değil adrese bakar.
const ok = (final || []).some((x) => String(x?.url || '') === TARGET_URL && eventsOf(x).includes(EVENT))
  && !(final || []).some((x) => String(x?.url || '') === OLD_URL);
console.log(ok ? '\nTASIMA_TAMAM' : '\nTASIMA_DOGRULANAMADI: listeyi kontrol et.');
process.exit(ok ? 0 : 1);
