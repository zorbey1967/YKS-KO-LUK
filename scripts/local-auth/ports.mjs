/**
 * Yalnız _yerel_auth_test.cmd'nin %TEMP%\rk-local-auth altında oluşturduğu GEÇİCİ config.toml'u yazar.
 * Repo supabase/config.toml'una dokunmaz. Başka yerel Supabase yığınının portlarıyla çakışmasın diye
 * boş bir 10'luk port aralığı seçer: her port 0.0.0.0, 127.0.0.1 ve ::1 üzerinde dinlenebiliyorsa boştur.
 * Kullanım: node ports.mjs <geçici config.toml>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const file = resolve(process.argv[2] || '');
if (!file.toLowerCase().startsWith(resolve(tmpdir()).toLowerCase())) {
  console.log(`RESULT ports BLOCKED: yalniz gecici klasordeki config yazilir (${file})`);
  process.exit(2);
}

const BASES = [55320, 56320, 57320, 58320];
const OFFSETS = {
  'api.port': 1,
  'db.port': 2,
  'db.shadow_port': 0,
  'db.pooler.port': 9,
  'studio.port': 3,
  'inbucket.port': 4,
  'inbucket.smtp_port': 5,
  'inbucket.pop3_port': 6,
  'local_smtp.port': 4,
  'local_smtp.smtp_port': 5,
  'local_smtp.pop3_port': 6,
  'analytics.port': 7,
  'edge_runtime.inspector_port': 8,
};

function canListen(port, host) {
  return new Promise((done) => {
    const srv = createServer();
    srv.once('error', (e) => done(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT'));
    srv.listen({ port, host, exclusive: true }, () => srv.close(() => done(true)));
  });
}

async function free(port) {
  for (const host of ['0.0.0.0', '127.0.0.1', '::1']) {
    if (!await canListen(port, host)) return false;
  }
  return true;
}

let base = 0;
for (const b of BASES) {
  const busy = [];
  for (let p = b; p <= b + 9; p += 1) if (!await free(p)) busy.push(p);
  if (!busy.length) {
    base = b;
    break;
  }
  console.log(`port araligi ${b}-${b + 9} dolu: ${busy.join(', ')}`);
}
if (!base) {
  console.log('RESULT ports BLOCKED: bos port araligi bulunamadi');
  process.exit(2);
}

const lines = readFileSync(file, 'utf8').split(/\r?\n/);
let section = '';
const done = new Set();
const out = lines.map((line) => {
  const sec = line.match(/^\s*\[([^\]]+)\]\s*$/);
  if (sec) {
    section = sec[1].trim();
    return line;
  }
  const kv = line.match(/^(\s*)(port|shadow_port|inspector_port|smtp_port|pop3_port)(\s*=\s*)\d+(.*)$/);
  if (!kv) return line;
  const key = `${section}.${kv[2]}`;
  if (!(key in OFFSETS)) return line;
  done.add(key);
  return `${kv[1]}${kv[2]}${kv[3]}${base + OFFSETS[key]}${kv[4]}`;
});
for (const required of ['api.port', 'db.port']) {
  if (!done.has(required)) {
    console.log(`RESULT ports FAIL: ${required} gecici config'te bulunamadi`);
    process.exit(1);
  }
}
// Bilinmeyen bölüm adıyla varsayılan aralıkta (543xx) kalan etkin port olursa çakışma olur; sessiz geçme.
let sectionNow = '';
const leftovers = [];
for (const line of out) {
  const sec = line.match(/^\s*\[([^\]]+)\]\s*$/);
  if (sec) sectionNow = sec[1].trim();
  const m = line.match(/^\s*([a-z_]*port)\s*=\s*(543\d\d)\b/);
  if (m) leftovers.push(`${sectionNow}.${m[1]}=${m[2]}`);
}
if (leftovers.length) {
  console.log(`RESULT ports FAIL: varsayilan aralikta kalan port: ${leftovers.join(', ')}`);
  process.exit(1);
}
writeFileSync(file, out.join('\n'));
const projectId = (lines.find((l) => /^\s*project_id\s*=/.test(l)) || '').split('=')[1]?.trim() || '?';
console.log(`RESULT ports PASS base=${base} project_id=${projectId} ${[...done].sort().map((k) => `${k}=${base + OFFSETS[k]}`).join(' ')}`);
