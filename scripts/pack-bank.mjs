/**
 * src/data bankasından edge paketi üretir. İstemci JS’ye gömmez.
 * Kullanım: npm run pack:bank
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'supabase', 'functions', 'bank-pack');
const packPath = join(outDir, 'pack.json');
const metaPath = join(outDir, 'pack.meta.json');

function slugify(name) {
  return String(name)
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i').replaceAll('ğ', 'g').replaceAll('ü', 'u')
    .replaceAll('ş', 's').replaceAll('ö', 'o').replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stripQuestion(q) {
  return {
    id: q.id,
    q: q.q,
    o: q.o,
    a: q.a,
    e: q.e,
    ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    ...(q.kind ? { kind: q.kind } : {}),
  };
}

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await vite.ssrLoadModule('/src/data/bankData.ts');
  const BANK = mod.BANK;
  const CURRICULUM = mod.CURRICULUM;
  const manifest = mod.bundledManifest();

  const levels = {};
  for (const row of manifest.levels) {
    const questions = {};
    for (const [key, list] of Object.entries(BANK)) {
      if (key.startsWith(`${row.name}|`)) {
        questions[key] = list.map(stripQuestion);
      }
    }
    levels[row.slug || slugify(row.name)] = { name: row.name, questions };
  }

  const pack = {
    schema: 'yks-bank-pack-v7',
    version: 7,
    generatedAt: manifest.generatedAt,
    source: 'src/data/bankData.ts',
    manifest: {
      version: manifest.version,
      generatedAt: manifest.generatedAt,
      questionCount: manifest.questionCount,
      levels: manifest.levels,
      curriculum: CURRICULUM,
      topicCounts: manifest.topicCounts,
    },
    levels,
  };

  mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(pack);
  writeFileSync(packPath, json);
  const bytes = statSync(packPath).size;
  const sha256 = createHash('sha256').update(json).digest('hex');
  const meta = {
    schema: pack.schema,
    version: pack.version,
    generatedAt: pack.generatedAt,
    questionCount: manifest.questionCount,
    levelCount: manifest.levels.length,
    topicCount: Object.keys(manifest.topicCounts || {}).length,
    bytes,
    sha256,
    packFile: 'supabase/functions/bank-pack/pack.json',
    uploadTarget: 'Supabase Edge Function bank-pack (fonksiyon klasöründeki pack.json; istemci dist değil)',
    access: 'JWT + caller_account_active + studentFeatureOk; koç 403; askı 403; üyeliksiz 402',
    repro: ['npm run pack:bank', 'npm run verify:bank'],
    gitignored: true,
    liveDeployed: false,
  };
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`BANK_PACK_OK questions=${meta.questionCount} levels=${meta.levelCount} bytes=${bytes}`);
} finally {
  await vite.close();
}
