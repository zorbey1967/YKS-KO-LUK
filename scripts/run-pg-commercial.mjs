/**
 * 055 ticari hazırlık provası (throwaway PostgreSQL; canlıya/staging'e bağlanmaz).
 *   npm run test:pg:commercial
 * Varsayılan: Docker'da postgres:16-alpine. Alternatif: YKS_PG_TEST_URL (yerel, supabase.co olmayan) + psql.
 *
 * İki senaryo, aynı test dosyası (supabase/tests/055_commercial_pg.sql):
 *   A) Canlıya yakın: 001–010 + üyelik/ödeme parçaları (013, 014, 016, 017) + 041–049 + 050–054 + 055 (iki kez)
 *   B) Tam zincir:     001–010 + 011–040 (atlananlar hariç) + 041–049 + 050–054 + 055 (iki kez)
 * Her senaryoda 058 (paket yetkisi) de iki kez uygulanır; 058 testi Pro/Premium yetkisini ve Shopier ödemesini sınar.
 * Ayrıca negatif kontroller: 055 olmadan 055 testi; 058 olmadan ve Pro'ya yapay zekâ açan 058 ile 058 testi başarısız olmalı.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = 'naiakscryafhvcghjmzx';
const name = 'yks-pg-commercial';
const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
if (pgUrl && (pgUrl.includes(LIVE) || /supabase\.co/i.test(pgUrl))) {
  console.error('CANLI_URL_REDDEDILDI');
  process.exit(1);
}

const MIG = join(root, 'supabase', 'migrations');
const files = readdirSync(MIG).filter((f) => f.endsWith('.sql'));
function mig(prefix) {
  const hit = files.find((f) => f.startsWith(`${prefix}_`));
  if (!hit) throw new Error(`migration yok: ${prefix}`);
  return `supabase/migrations/${hit}`;
}

const LIVE010 = ['001', '002', '003', '004', '005', '007', '008', '009', '010'].map(mig);
const FEATURE = ['041', '042', '043', '044', '045', '046', '047', '048', '049', '050', '051', '052', '053', '054'].map(mig);
/** Atlananlar: 013, 017, 018, 019 (yerine 020), 023 (027 kapsar). 027 hem başta hem 026'dan sonra. */
const FULL_CHAIN = ['027', '011', '012', '014', '015', '020', '021', '016', '022', '026', '027', '024', '025',
  '028', '029', '030', '031', '032', '033', '034', '035', '036', '037', '038', '039', '040'].map(mig);
const LIVE_LIKE = ['013', '014', '016', '017'].map(mig);
const M055 = mig('055');
const M058 = mig('058');
const M059 = mig('059');
const M060 = mig('060');
const M061 = mig('061');
const M062 = mig('062');
const M063 = mig('063');

function load(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function dockerBin() {
  const home = process.env.LOCALAPPDATA || '';
  const binDir = join(home, 'Programs', 'DockerDesktop', 'resources', 'bin');
  if (home) process.env.PATH = `${binDir};${process.env.PATH || ''}`;
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore', timeout: 15_000 });
    return 'docker';
  } catch {
    const fallback = join(binDir, 'docker.exe');
    execFileSync(fallback, ['version'], { stdio: 'ignore', timeout: 15_000 });
    return fallback;
  }
}

let docker = '';
function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}
function psql(db, sql, extra = []) {
  // Container yeni açıldığında soket kısa süre kaybolabilir; yalnız bağlantı hatasında birkaç kez tekrar dener.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return psqlOnce(db, sql, extra);
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e);
      if (attempt >= 10 || !/connection to server|No such file or directory|starting up/i.test(msg)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
}
function psqlOnce(db, sql, extra = []) {
  if (pgUrl) {
    const u = new URL(pgUrl);
    u.pathname = `/${db}`;
    return sh('psql', [u.toString(), '-v', 'ON_ERROR_STOP=1', '-q', ...extra], { input: sql });
  }
  return sh(docker, ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', ...extra], { input: sql });
}

function fresh(db) {
  psql('postgres', `drop database if exists ${db};`);
  psql('postgres', `create database ${db};`);
  psql(db, load('supabase/tests/supabase_like_bootstrap.sql'));
  for (const f of LIVE010) psql(db, load(f), ['--single-transaction']);
  psql(db, load('supabase/tests/live010_seed.sql'));
}

function apply(db, list) {
  for (const f of list) {
    try {
      psql(db, load(f), ['--single-transaction']);
    } catch (e) {
      throw new Error(`${f}: ${String(e?.stderr || e?.message || e).split('\n').filter(Boolean).slice(-3).join(' | ')}`);
    }
  }
}

function runTest(db) {
  return psql(db, load('supabase/tests/055_commercial_pg.sql'));
}

function scenario(label, db, list) {
  process.stdout.write(`• ${label}\n`);
  fresh(db);
  apply(db, [...list, ...FEATURE, M055, M055, M058, M058, M059, M059]);
  const out = runTest(db);
  if (!out.includes('OK 055_commercial_pg')) throw new Error(`${label}: test sonucu yok`);
  const out58 = psql(db, load('supabase/tests/058_plan_access_pg.sql'));
  if (!out58.includes('OK 058_plan_access_pg')) throw new Error(`${label}: 058 test sonucu yok`);
  const out59 = psql(db, load('supabase/tests/059_guest_checkout_pg.sql'));
  if (!out59.includes('OK 059_guest_checkout_pg')) throw new Error(`${label}: 059 test sonucu yok`);
  // 060 (deneme = tüm özellikler) ve 061 (yeni Google kaydı kapalı): 058/059 testlerinden SONRA, iki kez.
  apply(db, [M060, M060, M061, M061]);
  const out61 = psql(db, load('supabase/tests/060_061_trial_google_pg.sql'));
  if (!out61.includes('OK 060_061_pg')) throw new Error(`${label}: 060/061 test sonucu yok`);
  apply(db, [M062, M062]);
  const out62 = psql(db, load('supabase/tests/062_dual_role_pg.sql'));
  if (!out62.includes('OK 062_dual_role_pg')) throw new Error(`${label}: 062 test sonucu yok`);
  apply(db, [M063, M063]);
  const out62b = psql(db, load('supabase/tests/062_dual_role_pg.sql'));
  if (!out62b.includes('OK 062_dual_role_pg')) throw new Error(`${label}: 063 sonrası 062 test sonucu yok`);
  const out63 = psql(db, load('supabase/tests/063_coach_flow_pg.sql'));
  if (!out63.includes('OK 063_coach_flow_pg')) throw new Error(`${label}: 063 test sonucu yok`);
  console.log(`  OK${out58.includes('(zorro_rls)') ? ' (058 ZORRO yazma kapısı dahil)' : ''} + 060/061 + 062 + 063`);
}

try {
  if (!pgUrl) {
    docker = dockerBin();
    try { sh(docker, ['rm', '-f', name]); } catch { /* yok */ }
    sh(docker, ['run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=test', 'postgres:16-alpine']);
    // postgres imajı önce geçici bir sunucuyla ilk kurulumu yapar, sonra yeniden başlar.
    // Geçici sunucuya bağlanıp erken başlamamak için kurulumun bittiği log satırı beklenir.
    const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    let ready = false;
    for (let i = 0; i < 120 && !ready; i += 1) {
      try {
        // Postgres logları stderr'e yazar; ikisini birlikte oku.
        const out = spawnSync(docker, ['logs', name], { encoding: 'utf8' });
        const logs = `${out.stdout || ''}${out.stderr || ''}`;
        // "ready to accept connections" önce geçici sunucuda, sonra asıl sunucuda yazılır; ikincisi beklenir.
        const readyCount = (logs.match(/ready to accept connections/gi) || []).length;
        const done = /init process complete/i.test(logs) && readyCount >= 2;
        if (done) {
          sh(docker, ['exec', name, 'pg_isready', '-U', 'postgres']);
          psql('postgres', 'select 1;');
          ready = true;
        }
      } catch { /* henüz hazır değil */ }
      if (!ready) pause(500);
    }
    if (!ready) throw new Error('Postgres hazır olmadı');
  }

  scenario('A) canlıya yakın: 001–010 + 013/014/016/017 + 041–054 + 055', 'c055a', LIVE_LIKE);
  scenario('B) tam zincir: 001–010 + 011–040 + 041–054 + 055', 'c055b', FULL_CHAIN);

  process.stdout.write('• Negatif kontrol: 055 olmadan test başarısız olmalı\n');
  fresh('c055n');
  apply('c055n', [...LIVE_LIKE, ...FEATURE]);
  let failed = false;
  try { runTest('c055n'); } catch { failed = true; }
  if (!failed) throw new Error('055 olmadan test geçti; test açığı yakalamıyor');
  console.log('  OK (beklenen hata)');

  process.stdout.write('• Negatif kontrol: 058 olmadan ve Pro\'ya yapay zekâ açan 058 ile test başarısız olmalı\n');
  fresh('c058n');
  apply('c058n', [...LIVE_LIKE, ...FEATURE, M055]);
  let f58 = false;
  try { psql('c058n', load('supabase/tests/058_plan_access_pg.sql')); } catch { f58 = true; }
  if (!f58) throw new Error('058 olmadan 058 testi geçti');
  const leaky = load(M058).replace("in ('premium', 'staff')", "in ('premium', 'staff', 'pro')");
  if (leaky === load(M058)) throw new Error('mutasyon uygulanamadı');
  psql('c058n', leaky, ['--single-transaction']);
  f58 = false;
  try { psql('c058n', load('supabase/tests/058_plan_access_pg.sql')); } catch { f58 = true; }
  if (!f58) throw new Error('Pro\'ya yapay zekâ açan 058 ile test geçti; test açığı yakalamıyor');
  console.log('  OK (beklenen hata)');

  process.stdout.write('• Negatif kontrol: 061 olmadan 060/061 testi başarısız olmalı\n');
  fresh('c061n');
  apply('c061n', [...LIVE_LIKE, ...FEATURE, M055, M058, M059, M060]);
  let f61 = false;
  try { psql('c061n', load('supabase/tests/060_061_trial_google_pg.sql')); } catch { f61 = true; }
  if (!f61) throw new Error('061 olmadan 060/061 testi geçti; test açığı yakalamıyor');
  console.log('  OK (beklenen hata)');

  process.stdout.write('• Negatif kontrol: 011 sürümüyle (onay rolü koç yapar) 062 testi başarısız olmalı\n');
  fresh('c062n');
  apply('c062n', [...FULL_CHAIN, ...FEATURE, M055, M058, M059, M060, M061]);
  let f62 = false;
  try { psql('c062n', load('supabase/tests/062_dual_role_pg.sql')); } catch { f62 = true; }
  if (!f62) throw new Error('062 olmadan 062 testi geçti; test açığı yakalamıyor');
  console.log('  OK (beklenen hata)');

  process.stdout.write('• Negatif kontrol: 063 olmadan 063 testi başarısız olmalı\n');
  fresh('c063n');
  apply('c063n', [...LIVE_LIKE, ...FEATURE, M055, M058, M059, M060, M061, M062]);
  let f63 = false;
  try { psql('c063n', load('supabase/tests/063_coach_flow_pg.sql')); } catch { f63 = true; }
  if (!f63) throw new Error('063 olmadan 063 testi geçti; test açığı yakalamıyor');
  console.log('  OK (beklenen hata)');

  console.log('PG_COMMERCIAL_OK');
} catch (e) {
  console.error('PG_COMMERCIAL_FAIL', e instanceof Error ? e.message.split('\n').slice(0, 8).join('\n') : e);
  process.exitCode = 1;
} finally {
  if (!pgUrl && docker) {
    try { sh(docker, ['rm', '-f', name]); } catch { /* yok */ }
  }
}
