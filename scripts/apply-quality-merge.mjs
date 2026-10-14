/**
 * 106 replace_filler uygular. add/delete yok. pack.json yedek SHA kilitli değilse DURUR.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLD_SHA = '734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2';
const packPath = join(root, 'supabase/functions/bank-pack/pack.json');
const backupPath = join(root, 'supabase/.temp/pack.json.pre-merge.734e471add09');
const manifestPath = join(root, 'merge-manifest.json');
const outTs = join(root, 'src/data/bankQualityAppliedReplacements.ts');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

if (!existsSync(backupPath)) {
  console.error('STOP backup missing');
  process.exit(1);
}
const packSha = sha256(readFileSync(packPath));
const bakSha = sha256(readFileSync(backupPath));
if (packSha !== OLD_SHA) {
  console.error(`STOP pack sha ${packSha}`);
  process.exit(1);
}
if (bakSha !== OLD_SHA) {
  console.error(`STOP backup sha ${bakSha}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.applied === true) {
  console.error('STOP manifest already applied');
  process.exit(1);
}
if (manifest.replacementCount !== 106 || (manifest.replacements || []).length !== 106) {
  console.error(`STOP replacements ${manifest.replacementCount}`);
  process.exit(1);
}
if (manifest.bankDiff?.addCount !== 0) {
  console.error('STOP addCount');
  process.exit(1);
}

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const bankMod = await vite.ssrLoadModule('/src/data/bankData.ts');
  const fixMod = await vite.ssrLoadModule('/src/data/bankQualityFixItems.ts');
  const qfpMod = await vite.ssrLoadModule('/src/data/bankQualityPriorityItems.ts');
  const revMod = await vite.ssrLoadModule('/src/data/bankQualityPriorityNextRevisionItems.ts');
  const origMod = await vite.ssrLoadModule('/src/data/bankQualityPriorityNextItems.ts');
  const covMod = await vite.ssrLoadModule('/src/lib/bankCoverage.ts');

  const BANK = bankMod.BANK_PRE_QUALITY_MERGE || bankMod.BANK;
  const items = new Map();
  for (const x of fixMod.QUALITY_FIX_ITEMS) items.set(x.row.id, x);
  for (const x of qfpMod.QUALITY_PRIORITY_ITEMS) items.set(x.row.id, x);
  for (const x of revMod.resolvedQualityPriorityNextItems()) items.set(x.row.id, x);

  const origQpn = new Map(origMod.QUALITY_PRIORITY_NEXT_ITEMS.map((x) => [x.row.id, x.row]));
  const overlayIds = new Set(revMod.QPN_REVISE_IDS);
  const blocked = new Set([
    'needs_source_verification',
    'needs_human',
  ]);
  const curriculumBlock = new Set([
    'qf-8-fen-p', 'qf-n051', 'qf-n073', 'qf-n082', 'qf-n085', 'qf-n097', 'qf-n099',
    'qfp-s1-sz-02', 'qfp-s1-go-01', 'qfp-s1-go-02', 'qfp-s1-ol-01',
    'qpn-s1-go-13', 'qpn-s1-go-19',
  ]);

  const ops = [];
  for (const r of manifest.replacements) {
    if (r.status === 'needs_source_verification' || r.status === 'needs_human') {
      console.error(`STOP blocked ${r.quality_id}`);
      process.exit(1);
    }
    if (curriculumBlock.has(r.quality_id)) {
      console.error(`STOP curriculum ${r.quality_id}`);
      process.exit(1);
    }
    const item = items.get(r.quality_id);
    if (!item) {
      console.error(`STOP unknown ${r.quality_id}`);
      process.exit(1);
    }
    if (blocked.has(item.status)) {
      console.error(`STOP item status ${r.quality_id}`);
      process.exit(1);
    }
    const topic = `${r.level}|${r.subject}|${r.topic}`;
    if (item.topic !== topic) {
      console.error(`STOP topic ${r.quality_id} ${item.topic} != ${topic}`);
      process.exit(1);
    }
    if (overlayIds.has(r.quality_id)) {
      const orig = origQpn.get(r.quality_id);
      if (orig && JSON.stringify(orig) === JSON.stringify(item.row)) {
        console.error(`STOP original defective QPN used ${r.quality_id}`);
        process.exit(1);
      }
    }
    if (covMod.isFillerQuestion(item.row)) {
      console.error(`STOP quality filler ${r.quality_id}`);
      process.exit(1);
    }
    ops.push({
      quality_id: r.quality_id,
      target_filler_id: r.target_filler_id,
      topic,
      row: item.row,
    });
  }

  const src = `import type { BankQuestion } from '../lib/types';

export type AppliedReplacement = {
  quality_id: string;
  target_filler_id: string;
  topic: string;
  row: BankQuestion;
};

/** Manifest 106 replace_filler. Yeni soru yok. */
export const QUALITY_APPLIED_REPLACEMENTS: AppliedReplacement[] = ${JSON.stringify(ops, null, 2)};
`;
  writeFileSync(outTs, src, 'utf8');
  console.log(`WROTE ${outTs} ops=${ops.length}`);
} finally {
  await vite.close();
}
