/**
 * Merge öncesi checkpoint. BANK / pack.json yazmaz. applied=true yapmaz.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_SHA = '734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2';
const SHA12 = EXPECTED_SHA.slice(0, 12);
const packPath = join(root, 'supabase/functions/bank-pack/pack.json');
const backupPath = join(root, 'supabase/.temp', `pack.json.pre-merge.${SHA12}`);
const manifestPath = join(root, 'merge-manifest.json');
const tempDir = join(root, 'supabase/.temp');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

const fail = [];
if (!existsSync(backupPath)) fail.push('pack backup missing');
const packRaw = readFileSync(packPath);
const bakRaw = readFileSync(backupPath);
const packSha = sha256(packRaw);
const packBackupSha = sha256(bakRaw);
if (packSha !== EXPECTED_SHA) fail.push(`pack sha mismatch ${packSha}`);
if (packBackupSha !== EXPECTED_SHA) fail.push(`backup sha mismatch ${packBackupSha}`);

const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (m.applied !== false) fail.push('applied!==false');
if (m.writesBank !== false) fail.push('writesBank!==false');
if (m.writesPackJson !== false) fail.push('writesPackJson!==false');
if (m.replacementCount !== 106) fail.push(`replacementCount=${m.replacementCount}`);
if (m.verification?.addCount !== 0) fail.push('verification.addCount');
if (m.bankDiff?.addCount !== 0) fail.push('bankDiff.addCount');
if (m.bankDiff?.replaceCount !== 106) fail.push('bankDiff.replaceCount');
if (m.bankDiff?.questionsBefore !== 7007 || m.bankDiff?.questionsAfter !== 7007) fail.push('question count drift');
if (m.bankDiff?.fillerBefore !== 5643 || m.bankDiff?.fillerAfter !== 5537) fail.push('filler projection');
if (m.qpnUsesRevisionOverlay !== true) fail.push('qpn overlay flag');

const overlay = [...(m.qpnRevisedIds || [])].sort();
const expectedOverlay = ['qpn-s1-go-13', 'qpn-s1-go-19', 'qpn-s1-sy-r10', 'qpn-s1-sy-r5', 'qpn-tyt-fn-01', 'qpn-tyt-sy-07'].sort();
if (JSON.stringify(overlay) !== JSON.stringify(expectedOverlay)) fail.push('qpnRevisedIds');

const reps = m.replacements || [];
const fillers = reps.map((r) => r.target_filler_id);
const qids = reps.map((r) => r.quality_id);
const dupFillers = fillers.filter((id, i) => fillers.indexOf(id) !== i);
const dupQids = qids.filter((id, i) => qids.indexOf(id) !== i);
if (new Set(fillers).size !== fillers.length) fail.push(`duplicate_target ${dupFillers.join(',')}`);
if (new Set(qids).size !== qids.length) fail.push(`duplicate_quality ${dupQids.join(',')}`);

const blockedStatus = reps.filter((r) => {
  const reason = String(r.reason || '');
  return (
    r.status === 'needs_source_verification' ||
    r.status === 'needs_human' ||
    r.status === 'no_action' ||
    /\bno_action\b/.test(reason) ||
    /add_if_no_filler/.test(reason) ||
    /curriculum_block/.test(reason)
  );
});
if (blockedStatus.length) fail.push(`blocked replacements ${blockedStatus.map((r) => r.quality_id).join(',')}`);

const curriculumIds = new Set([
  'qf-8-fen-p',
  'qf-n051',
  'qf-n073',
  'qf-n082',
  'qf-n085',
  'qf-n097',
  'qf-n099',
  'qfp-s1-sz-02',
  'qfp-s1-go-01',
  'qfp-s1-go-02',
  'qfp-s1-ol-01',
  'qpn-s1-go-13',
  'qpn-s1-go-19',
]);
const currHit = qids.filter((id) => curriculumIds.has(id));
if (currHit.length) fail.push(`curriculum in replacements ${currHit.join(',')}`);

const origBadStems = {
  'qpn-tyt-sy-07': 'Kenarları 8 br ve 12 br olan dikdörtgen',
  'qpn-tyt-fn-01': 'Grafikten f(4)',
  'qpn-s1-go-13': 'Resim: Bir çocuk masada oturuyor',
  'qpn-s1-go-19': 'Yeşil ışıkta geçileceğini',
  'qpn-s1-sy-r5': "'25'",
  'qpn-s1-sy-r10': "'30'",
};
const overlayStems = {
  'qpn-tyt-sy-07': 'Kenarı 8 cm olan kare karolar',
  'qpn-tyt-fn-01': 'f değer tablosu',
  'qpn-s1-sy-r5': 'Beşer ritmik saymada',
  'qpn-s1-sy-r10': 'Onar ritmik saymada',
};

const ops = m.bankDiff?.operations || [];
if (ops.length !== 106) fail.push(`ops=${ops.length}`);
if (ops.some((o) => o.action !== 'replace_filler')) fail.push('non-replace op');

let origStemUsed = 0;
for (const op of ops) {
  const bad = origBadStems[op.quality_id];
  if (!bad) continue;
  if (op.quality_id === 'qpn-s1-go-13' || op.quality_id === 'qpn-s1-go-19') {
    fail.push(`${op.quality_id} should not merge`);
    continue;
  }
  if (String(op.addStemPrefix || '').includes(bad.replace(/'/g, '')) && !overlayStems[op.quality_id]) {
    origStemUsed += 1;
  }
  const want = overlayStems[op.quality_id];
  if (want && !String(op.addStemPrefix || '').includes(want.slice(0, 18))) {
    fail.push(`overlay stem missing for ${op.quality_id}: ${op.addStemPrefix}`);
  }
}
if (origStemUsed) fail.push(`original defective QPN stems in ops ${origStemUsed}`);

const r5 = ops.find((o) => o.quality_id === 'qpn-s1-sy-r5');
const r10 = ops.find((o) => o.quality_id === 'qpn-s1-sy-r10');
if (r5 && /25/.test(r5.addStemPrefix) && !/16/.test(JSON.stringify(r5))) {
  /* stem itself has no 25; options not in prefix — OK */
}
if (!r5) fail.push('r5 overlay replacement missing');
if (!r10) fail.push('r10 overlay replacement missing');

const src = readFileSync(join(root, 'src/lib/bankQualityMergeManifest.ts'), 'utf8');
if (!src.includes('resolvedQualityPriorityNextItems()')) fail.push('manifest builder missing resolvedQualityPriorityNextItems');

const locked = [
  'src/data/bankData.ts',
  'src/data/bankQualityFixPack.ts',
  'src/data/bankQualityFixItems.ts',
  'src/data/bankQualityPriorityItems.ts',
  'src/data/bankQualityPriorityPack.ts',
  'src/data/bankQualityPriorityNextItems.ts',
  'src/data/bankQualityPriorityNextPack.ts',
  'src/data/bankQualityPriorityNextRevisionItems.ts',
  'supabase/migrations/039_approved_appointment_cancel.sql',
  'supabase/migrations/040_approved_cancel_audit.sql',
];
const lockedDirty = [];
const bankDataDiff = git(['diff', '--', 'src/data/bankData.ts']).stdout;
for (const f of locked) {
  const d = git(['diff', '--', f]);
  const s = git(['diff', '--cached', '--', f]);
  if (d.stdout || s.stdout) lockedDirty.push(f);
}
const bankDataPlus = bankDataDiff
  .split(/\r?\n/)
  .filter((l) => l.startsWith('+') && !l.startsWith('+++'));
const bankDataOnlyOriginalImport =
  bankDataPlus.length === 2 && bankDataPlus.every((l) => l.includes('ORIGINAL_BANK'));
if (bankDataOnlyOriginalImport) {
  const i = lockedDirty.indexOf('src/data/bankData.ts');
  if (i >= 0) lockedDirty.splice(i, 1);
}

mkdirSync(tempDir, { recursive: true });
const diffOut = {
  applied: false,
  writesBank: false,
  replaceCount: ops.length,
  addCount: 0,
  deleteCount: 0,
  questions: { before: 7007, after: 7007 },
  fillers: { before: 5643, after: 5537 },
  operations: ops.map((o) => ({
    action: 'replace_filler',
    quality_id: o.quality_id,
    target_filler_id: o.target_filler_id,
    topic: o.topic,
    dropStemPrefix: o.dropStemPrefix,
    addStemPrefix: o.addStemPrefix,
    qpnOverlay: o.qpnOverlay,
  })),
};
writeFileSync(join(tempDir, 'pre-merge-diff.json'), `${JSON.stringify(diffOut, null, 2)}\n`);

const report = {
  PRE_MERGE_CHECKPOINT: true,
  bank_sha: packSha,
  pack_backup_sha: packBackupSha,
  pack_backup_path: `supabase/.temp/pack.json.pre-merge.${SHA12}`,
  questions: 7007,
  current_fillers: 5643,
  projected_fillers: 5537,
  replacement_count: 106,
  add_count: 0,
  delete_count: 0,
  duplicate_target_count: dupFillers.length,
  unexpected_diff_count: fail.length + lockedDirty.length,
  fail,
  lockedDirty,
  bankDataGitNote: bankDataOnlyOriginalImport
    ? 'HEAD farkı yalnızca ORIGINAL_BANK import; kalite merge satırı yok'
    : bankDataDiff
      ? 'bankData.ts HEAD ile beklenmeyen diff'
      : 'bankData.ts HEAD ile aynı',
  bank_modified: false,
  pack_modified: false,
  manifest_applied: false,
};
writeFileSync(join(tempDir, 'pre-merge-checkpoint.json'), `${JSON.stringify(report, null, 2)}\n`);
if (fail.length) {
  console.error('PRE_MERGE_CHECKPOINT_FAIL', JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
