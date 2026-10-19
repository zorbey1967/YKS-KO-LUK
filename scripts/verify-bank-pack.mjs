/**
 * pack.json şema ve sayım doğrulaması. Git’e pack.json koymaz.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packPath = join(root, 'supabase/functions/bank-pack/pack.json');
const metaPath = join(root, 'supabase/functions/bank-pack/pack.meta.json');

if (!existsSync(packPath)) {
  console.error('BANK_PACK_MISSING pack.json yok. npm run pack:bank. Edge 503.');
  process.exit(1);
}

const raw = readFileSync(packPath, 'utf8');
const pack = JSON.parse(raw);
const sha256 = createHash('sha256').update(raw).digest('hex');
const bytes = statSync(packPath).size;
const levels = Object.keys(pack.levels || {});
const topics = Object.keys(pack.manifest?.topicCounts || {});

const fail = [];
if (pack.schema !== 'yks-bank-pack-v7') fail.push(`schema=${pack.schema}`);
if (pack.version !== 7) fail.push(`version=${pack.version}`);
if (pack.manifest?.questionCount !== 7007) fail.push(`questions=${pack.manifest?.questionCount}`);
if (levels.length !== 17) fail.push(`levels=${levels.length}`);
if (topics.length !== 501) fail.push(`topics=${topics.length}`);
if (!existsSync(metaPath)) fail.push('pack.meta.json yok');
else {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (meta.sha256 !== sha256) fail.push('sha256 meta uyumsuz');
  if (meta.bytes !== bytes) fail.push('bytes meta uyumsuz');
  if (meta.questionCount !== 7007) fail.push('meta questionCount');
}

const ignore = spawnSync('git', ['check-ignore', '-q', 'supabase/functions/bank-pack/pack.json'], { cwd: root });
if (ignore.status !== 0) fail.push('pack.json gitignore dışı');
const tracked = spawnSync('git', ['ls-files', 'supabase/functions/bank-pack/pack.json'], { cwd: root, encoding: 'utf8' });
if ((tracked.stdout || '').trim()) fail.push('pack.json git indeksinde');

const distDir = join(root, 'dist');
if (existsSync(distDir)) {
  const js = [];
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (/\.(js|mjs|css|html|map)$/.test(name.name)) js.push(p);
    }
  };
  walk(distDir);
  // Soru verisi istemciye hiç gitmemeli: bankData chunk’ı, export adları veya soru fabrikası çağrıları.
  const bankMarkers = ['questionsForLevel', 'BANK_PRE_QUALITY_MERGE', 'bundledManifest'];
  const factoryCall = /a\("s\d+-[a-z]+-\d+",/g;
  for (const p of js) {
    const rel = p.slice(root.length);
    if (/bankData/i.test(rel)) fail.push(`bankData chunk dist içinde: ${rel}`);
    const text = readFileSync(p, 'utf8');
    if (text.includes('yks-bank-pack-v7') && text.includes('"levels"') && text.length > 200_000) {
      fail.push(`pack istemci bundle: ${rel}`);
    }
    const marker = bankMarkers.find((m) => text.includes(m));
    if (marker) fail.push(`soru bankası işareti (${marker}) istemci bundle: ${rel}`);
    const calls = (text.match(factoryCall) || []).length;
    if (calls > 5) fail.push(`soru fabrikası çağrıları (${calls}) istemci bundle: ${rel}`);
  }
}

if (fail.length) {
  console.error(`BANK_PACK_FAIL ${fail.join('; ')}`);
  process.exit(1);
}

console.log(`BANK_PACK_VERIFIED questions=7007 levels=17 topics=501 bytes=${bytes} sha256=${sha256} gitignored=true live_deployed=false`);
