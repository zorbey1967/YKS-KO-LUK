import type { BankQuestion } from '../lib/types';
import { isFillerQuestion } from '../lib/bankCoverage';
import { QUALITY_APPLIED_REPLACEMENTS } from './bankQualityAppliedReplacements';

export function applyQualityReplacements(bank: Record<string, BankQuestion[]>) {
  const ops = QUALITY_APPLIED_REPLACEMENTS;
  if (ops.length !== 106) throw new Error(`expected 106 replacements, got ${ops.length}`);
  const fillers = ops.map((o) => o.target_filler_id);
  if (new Set(fillers).size !== 106) throw new Error('duplicate target_filler_id');
  const qids = ops.map((o) => o.quality_id);
  if (new Set(qids).size !== 106) throw new Error('duplicate quality_id');

  const out: Record<string, BankQuestion[]> = {};
  for (const [topic, list] of Object.entries(bank)) out[topic] = list.slice();

  let replaced = 0;
  let already = 0;
  for (const op of ops) {
    const list = out[op.topic];
    if (!list) throw new Error(`missing topic ${op.topic}`);
    const dropAt = list.findIndex((q) => q.id === op.target_filler_id);
    const haveQuality = list.some((q) => q.id === op.quality_id);
    if (dropAt < 0) {
      if (haveQuality) {
        already += 1;
        continue;
      }
      throw new Error(`missing filler ${op.target_filler_id} in ${op.topic}`);
    }
    if (!isFillerQuestion(list[dropAt])) throw new Error(`not filler ${op.target_filler_id}`);
    if (isFillerQuestion(op.row)) throw new Error(`quality is filler ${op.quality_id}`);
    if (op.row.id !== op.quality_id) throw new Error(`row id mismatch ${op.quality_id}`);
    list[dropAt] = op.row;
    replaced += 1;
  }

  const questions = Object.values(out).reduce((n, l) => n + l.length, 0);
  if (questions !== Object.values(bank).reduce((n, l) => n + l.length, 0)) {
    throw new Error('question count changed');
  }
  return { bank: out, replaced, already };
}
