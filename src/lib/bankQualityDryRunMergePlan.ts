import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS, type QualityFixItem } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_NEXT_ITEMS, type QualityNextItem } from '../data/bankQualityPriorityNextItems';
import { resolvedQualityPriorityNextItems } from '../data/bankQualityPriorityNextRevisionItems';
import { independentMathValue } from './bankQualityGateAudit';
import { independentPriorityMath } from './bankQualityPriorityAudit';
import { independentRevisionMath } from './bankQualityPriorityNextRevisionAudit';
import { conceptKey } from './bankQualityPriorityNextAudit';
import { CONCEPTUAL_OVERLAPS, SOURCE_CONTRADICTIONS } from './bankQualitySourceAudit';
import { PRIORITY_SCOPE_REMEDIATION } from './bankQualityPriorityNextRemediation';
import { fillerInventory } from './bankQualityInventory';

export type DryAction = 'replace_filler' | 'add_if_no_filler' | 'no_action';
export type PackName = 'QUALITY_FIX_PACK' | 'QFP' | 'QPN_REVISION';
export type Bucket = 'A_safe' | 'B_source' | 'C_human' | 'D_collision_manual' | 'E_do_not_merge';

const TARGET_NON_FILLER = 12;
const CURRICULUM_BLOCK = new Set<string>([
  ...SOURCE_CONTRADICTIONS.map((c) => c.id),
  ...CONCEPTUAL_OVERLAPS.map((c) => c.qualityId),
  ...PRIORITY_SCOPE_REMEDIATION.map((r) => r.id),
  'qpn-s1-go-13',
  'qpn-s1-go-19',
]);

export type DryCandidate = {
  pack: PackName;
  id: string;
  topic: string;
  status: QualityFixItem['status'];
  verify: QualityFixItem['verify'];
  action: DryAction;
  dropFillerId: string | null;
  math_ok: boolean;
  structure_ok: boolean;
  duplicate_ok: boolean;
  curriculum_ok: boolean;
  source_ok: boolean;
  merge_eligible: boolean;
  bucket: Bucket;
  notes: string[];
};

function asFix(item: QualityFixItem | QualityNextItem): QualityFixItem {
  return item;
}

function mathOk(pack: PackName, item: QualityFixItem): boolean {
  if (item.verify !== 'math') return true;
  if (pack === 'QUALITY_FIX_PACK') return independentMathValue(item).ok;
  if (pack === 'QFP') return independentPriorityMath(item).ok;
  return independentRevisionMath(item as QualityNextItem).ok;
}

function sourceOk(item: QualityFixItem): boolean {
  if (item.status === 'needs_source_verification' || item.status === 'needs_human') return false;
  if (item.verify === 'math' && item.status === 'machine_ok') return true;
  return item.status === 'source_verified';
}

function mapIndependent(
  _pack: PackName,
  items: QualityFixItem[],
  bank: Record<string, BankQuestion[]>,
): { action: DryAction; dropFillerId: string | null; topic: string; id: string }[] {
  const used = new Set<string>();
  return items.map((item) => {
    const list = bank[item.topic] || [];
    const fillers = list.filter((q) => isFillerQuestion(q) && !used.has(q.id));
    const nonFiller = list.filter((q) => !isFillerQuestion(q)).length;
    const drop = fillers[0] || null;
    if (drop) {
      used.add(drop.id);
      return { action: 'replace_filler' as const, dropFillerId: drop.id, topic: item.topic, id: item.row.id };
    }
    if (nonFiller >= TARGET_NON_FILLER) {
      return { action: 'no_action' as const, dropFillerId: null, topic: item.topic, id: item.row.id };
    }
    return { action: 'add_if_no_filler' as const, dropFillerId: null, topic: item.topic, id: item.row.id };
  });
}

function mapSequential(
  packs: { pack: PackName; items: QualityFixItem[] }[],
  bank: Record<string, BankQuestion[]>,
) {
  const used = new Set<string>();
  const out: { pack: PackName; action: DryAction; dropFillerId: string | null; topic: string; id: string }[] = [];
  for (const { pack, items } of packs) {
    for (const item of items) {
      const list = bank[item.topic] || [];
      const fillers = list.filter((q) => isFillerQuestion(q) && !used.has(q.id));
      const nonFiller = list.filter((q) => !isFillerQuestion(q)).length;
      const drop = fillers[0] || null;
      if (drop) {
        used.add(drop.id);
        out.push({ pack, action: 'replace_filler', dropFillerId: drop.id, topic: item.topic, id: item.row.id });
      } else if (nonFiller >= TARGET_NON_FILLER) {
        out.push({ pack, action: 'no_action', dropFillerId: null, topic: item.topic, id: item.row.id });
      } else {
        out.push({ pack, action: 'add_if_no_filler', dropFillerId: null, topic: item.topic, id: item.row.id });
      }
    }
  }
  return { rows: out, usedFillers: used };
}

type DryCandidateInternal = DryCandidate & { rowKindOsym?: boolean };

function bucketOf(c: DryCandidateInternal, collidingIds: Set<string>): Bucket {
  if (!c.structure_ok || !c.duplicate_ok || c.rowKindOsym) return 'E_do_not_merge';
  if (CONCEPTUAL_OVERLAPS.some((o) => o.qualityId === c.id) || !c.curriculum_ok) return 'E_do_not_merge';
  if (c.status === 'needs_human') return 'C_human';
  if (c.status === 'needs_source_verification') return 'B_source';
  if (collidingIds.has(c.id)) return 'D_collision_manual';
  if (c.merge_eligible) return 'A_safe';
  return 'D_collision_manual';
}

export function dryRunQualityMerge(bank: Record<string, BankQuestion[]>) {
  const qpnResolved = resolvedQualityPriorityNextItems();
  const packs: { pack: PackName; items: QualityFixItem[] }[] = [
    { pack: 'QUALITY_FIX_PACK', items: QUALITY_FIX_ITEMS },
    { pack: 'QFP', items: QUALITY_PRIORITY_ITEMS },
    { pack: 'QPN_REVISION', items: qpnResolved.map(asFix) },
  ];

  const bankList = Object.entries(bank).flatMap(([topic, list]) => list.map((q) => ({ topic, q })));
  const bankFp = new Map<string, string[]>();
  for (const { q } of bankList) {
    const fp = questionFingerprint(q);
    bankFp.set(fp, [...(bankFp.get(fp) || []), q.id]);
  }
  const allQuality = packs.flatMap((p) => p.items.map((item) => ({ pack: p.pack, item })));
  const qualityFp = new Map<string, string[]>();
  for (const { item } of allQuality) {
    const fp = questionFingerprint(item.row);
    qualityFp.set(fp, [...(qualityFp.get(fp) || []), item.row.id]);
  }

  const indep = packs.map((p) => ({ pack: p.pack, maps: mapIndependent(p.pack, p.items, bank) }));
  const fillerClaims = new Map<string, string[]>();
  for (const p of indep) {
    for (const m of p.maps) {
      if (!m.dropFillerId) continue;
      fillerClaims.set(m.dropFillerId, [...(fillerClaims.get(m.dropFillerId) || []), m.id]);
    }
  }
  const collidingFillerIds = [...fillerClaims.entries()].filter(([, ids]) => ids.length > 1);
  const collidingQualityIds = new Set(collidingFillerIds.flatMap(([, ids]) => ids));

  const seq = mapSequential(packs, bank);
  const seqById = new Map(seq.rows.map((r) => [r.id, r]));

  const exactFpHits: { id: string; near: string[] }[] = [];
  const conceptualNear: { id: string; bankIds: string[]; note: string }[] = [];
  const bankByConcept = new Map<string, string[]>();
  for (const { q } of bankList) {
    if (isFillerQuestion(q)) continue;
    const k = conceptKey(q);
    bankByConcept.set(k, [...(bankByConcept.get(k) || []), q.id]);
  }

  const candidates: DryCandidateInternal[] = [];
  for (const { pack, item } of allQuality) {
    const seqRow = seqById.get(item.row.id)!;
    const notes: string[] = [];
    const structure_ok =
      isValidQuestion(item.row) &&
      item.row.o.length === 5 &&
      !isFillerQuestion(item.row) &&
      item.row.kind !== 'osym' &&
      Boolean(bank[item.topic]);
    const fp = questionFingerprint(item.row);
    const bankHit = (bankFp.get(fp) || []).filter((id) => id !== seqRow.dropFillerId);
    const packHit = (qualityFp.get(fp) || []).filter((id) => id !== item.row.id);
    const duplicate_ok = bankHit.length === 0 && packHit.length === 0;
    if (bankHit.length) {
      notes.push(`bank_fp:${bankHit.join(',')}`);
      exactFpHits.push({ id: item.row.id, near: bankHit });
    }
    if (packHit.length) notes.push(`pack_fp:${packHit.join(',')}`);
    const math_ok = mathOk(pack, item);
    const source_ok = sourceOk(item);
    const curriculum_ok = Boolean(bank[item.topic]) && !CURRICULUM_BLOCK.has(item.row.id);
    if (!curriculum_ok) notes.push('curriculum_block');
    const merge_eligible =
      math_ok &&
      structure_ok &&
      duplicate_ok &&
      curriculum_ok &&
      source_ok &&
      seqRow.action !== 'no_action';
    const nearConcept = (bankByConcept.get(conceptKey(item.row)) || []).slice(0, 6);
    if (nearConcept.length) {
      conceptualNear.push({
        id: item.row.id,
        bankIds: nearConcept,
        note: 'sayı silinmiş kök eşitliği; otomatik kopya sayılmadı',
      });
    }
    const c: DryCandidateInternal = {
      pack,
      id: item.row.id,
      topic: item.topic,
      status: item.status,
      verify: item.verify,
      action: seqRow.action,
      dropFillerId: seqRow.dropFillerId,
      math_ok,
      structure_ok,
      duplicate_ok,
      curriculum_ok,
      source_ok,
      merge_eligible,
      bucket: 'D_collision_manual',
      notes,
      rowKindOsym: item.row.kind === 'osym',
    };
    c.bucket = bucketOf(c, collidingQualityIds);
    candidates.push(c);
  }

  for (const c of candidates) {
    c.bucket = bucketOf(c, collidingQualityIds);
    c.merge_eligible =
      c.bucket === 'A_safe' &&
      c.math_ok &&
      c.structure_ok &&
      c.duplicate_ok &&
      c.curriculum_ok &&
      c.source_ok &&
      c.action !== 'no_action';
  }

  const byPack = (pack: PackName) => {
    const list = candidates.filter((c) => c.pack === pack);
    return {
      pack,
      total: list.length,
      safeReplace: list.filter((c) => c.merge_eligible && c.action === 'replace_filler').length,
      safeAdd: list.filter((c) => c.merge_eligible && c.action === 'add_if_no_filler').length,
      sourcePending: list.filter((c) => c.status === 'needs_source_verification').length,
      needsHuman: list.filter((c) => c.status === 'needs_human').length,
      noAction: list.filter((c) => c.action === 'no_action').length,
      colliding: list.filter((c) => collidingQualityIds.has(c.id)).length,
      indepReplace: indep.find((p) => p.pack === pack)!.maps.filter((m) => m.action === 'replace_filler').length,
      indepAdd: indep.find((p) => p.pack === pack)!.maps.filter((m) => m.action === 'add_if_no_filler').length,
      indepNone: indep.find((p) => p.pack === pack)!.maps.filter((m) => m.action === 'no_action').length,
    };
  };

  const tables = [byPack('QUALITY_FIX_PACK'), byPack('QFP'), byPack('QPN_REVISION')];
  const ids = (b: Bucket) => candidates.filter((c) => c.bucket === b).map((c) => c.id);

  const eligible = candidates.filter((c) => c.merge_eligible);
  const safeReplace = eligible.filter((c) => c.action === 'replace_filler');
  const safeAdd = eligible.filter((c) => c.action === 'add_if_no_filler');

  const inv = fillerInventory(bank);
  const bankCount = bankList.length;
  const projectedCount = bankCount + safeAdd.length;
  const projectedFiller = inv.filler - safeReplace.length;

  const levels = new Set(bankList.map((r) => r.topic.split('|')[0]));
  const topics = new Set(bankList.map((r) => r.topic));
  const subjects = new Map<string, number>();
  for (const r of bankList) {
    const s = r.topic.split('|')[1] || '';
    subjects.set(s, (subjects.get(s) || 0) + 1);
  }
  const projSubjects = new Map(subjects);
  for (const c of safeAdd) {
    const s = c.topic.split('|')[1] || '';
    projSubjects.set(s, (projSubjects.get(s) || 0) + 1);
  }

  const fpNow = new Map<string, number>();
  for (const { q } of bankList) {
    const fp = questionFingerprint(q);
    fpNow.set(fp, (fpNow.get(fp) || 0) + 1);
  }
  const dupNow = [...fpNow.values()].filter((n) => n > 1).length;

  const remaining = new Map(bankList.map((r) => [r.q.id, r]));
  for (const c of safeReplace) {
    if (c.dropFillerId) remaining.delete(c.dropFillerId);
  }
  const addedRows = eligible.map((c) => {
    const item = allQuality.find((x) => x.item.row.id === c.id)!.item;
    return item.row;
  });
  const fpProj = new Map<string, number>();
  for (const r of remaining.values()) {
    const fp = questionFingerprint(r.q);
    fpProj.set(fp, (fpProj.get(fp) || 0) + 1);
  }
  for (const q of addedRows) {
    const fp = questionFingerprint(q);
    fpProj.set(fp, (fpProj.get(fp) || 0) + 1);
  }
  const dupProj = [...fpProj.values()].filter((n) => n > 1).length;

  const overlayCheck = {
    qpnOriginal: QUALITY_PRIORITY_NEXT_ITEMS.length,
    qpnResolved: qpnResolved.length,
    revisedIds: qpnResolved
      .filter((x, i) => questionFingerprint(x.row) !== questionFingerprint(QUALITY_PRIORITY_NEXT_ITEMS[i].row))
      .map((x) => x.row.id),
  };

  return {
    mergeThisTurn: false as const,
    overlayCheck,
    tables,
    buckets: {
      A_safe: ids('A_safe'),
      B_source: ids('B_source'),
      C_human: ids('C_human'),
      D_collision_manual: ids('D_collision_manual'),
      E_do_not_merge: ids('E_do_not_merge'),
    },
    collidingFillers: collidingFillerIds.map(([fillerId, qualityIds]) => ({ fillerId, qualityIds })),
    exactFpHits,
    conceptualNear: [
      ...CONCEPTUAL_OVERLAPS.map((o) => ({ id: o.qualityId, bankIds: [...o.bankIds], note: o.note })),
      ...conceptualNear.filter((n) => !CONCEPTUAL_OVERLAPS.some((o) => o.qualityId === n.id)),
    ],
    sequential: {
      replace: seq.rows.filter((r) => r.action === 'replace_filler').length,
      add: seq.rows.filter((r) => r.action === 'add_if_no_filler').length,
      none: seq.rows.filter((r) => r.action === 'no_action').length,
    },
    eligible: {
      count: eligible.length,
      replace: safeReplace.length,
      add: safeAdd.length,
      ids: eligible.map((c) => c.id),
    },
    projection: {
      questionsNow: bankCount,
      questionsAfter: projectedCount,
      levelsNow: levels.size,
      levelsAfter: levels.size,
      topicsNow: topics.size,
      topicsAfter: topics.size,
      fillerNow: inv.filler,
      fillerAfter: projectedFiller,
      fillerReplaced: safeReplace.length,
      dupFpGroupsNow: dupNow,
      dupFpGroupsAfter: dupProj,
      subjectsNow: Object.fromEntries(subjects),
      subjectsAfter: Object.fromEntries(projSubjects),
    },
    candidates,
  };
}

export const DRY_RUN_MERGE_META = {
  mergeThisTurn: false,
  writesBank: false,
  writesPackJson: false,
} as const;
