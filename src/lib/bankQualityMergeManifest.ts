import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { QUALITY_FIX_ITEMS, type QualityFixItem } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { resolvedQualityPriorityNextItems } from '../data/bankQualityPriorityNextRevisionItems';
import { MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { fillerInventory } from './bankQualityInventory';
import {
  dryRunQualityMerge,
  type DryCandidate,
  type PackName,
} from './bankQualityDryRunMergePlan';

/** Mevcut merge-manifest.json kazananları. Yeniden sıralama yok. */
export const LOCKED_COLLISION_WINNERS: Record<string, string | null> = {
  'cv-16e53184': 'qpn-s1-ad-cm',
  'cv-17e53317': 'qpn-s1-ad-ms',
  'cv-83b39fda': 'qfp-s1-sb-01',
  'vm-abs-2': 'qpn-tyt-sy-01',
  'cv-ec0f4721': 'qpn-s1-sy-r5',
  'vm-fn-1--5-2': 'qpn-tyt-fn-01',
  'vm-abs-3': 'qpn-tyt-sy-02',
  'vm-abs-4': 'qpn-tyt-sy-03',
  'vm-abs-5': 'qfp-tyt-sy-04',
  'vm-abs-6': 'qpn-tyt-sy-05',
  'vm-abs-7': 'qpn-tyt-sy-06',
  'vm-fn-1--4-3': 'qpn-tyt-fn-02',
  'vm-fn-1--3-4': 'qfp-tyt-fn-03',
  'vm-fn-1--2-5': 'qpn-tyt-fn-04',
  'ay-vm-fn-1--5-2-0': 'qpn-ayt-fn-01',
  'ay-vm-fn-1--4-3-1': 'qpn-ayt-fn-02',
  'ay-vm-fn-1--3-4-2': 'qfp-ayt-fn-03',
  'ay-vm-fn-1--2-5-3': 'qpn-ayt-fn-04',
  'cv-236c514e': null,
  'cv-7f21640e': null,
  'cv-802165a1': null,
  'cv-5020af23': null,
  'cv-eb0f458e': 'qpn-s1-sy-r10',
  'cv-d4fa352a': 'qpn-s1-geo-cs',
  'cv-d5fa36bd': 'qpn-s1-geo-or',
  'cv-9b25363b': 'qpn-s1-ol-ns',
};

export type ManifestReplacement = {
  quality_id: string;
  target_filler_id: string;
  level: string;
  subject: string;
  topic: string;
  status: QualityFixItem['status'];
  reason: string;
  pack: PackName;
};

export type CollisionResolution = {
  filler_id: string;
  contenders: string[];
  winner: string | null;
  excluded: string[];
  reason: string;
};

const PACK_RANK: Record<PackName, number> = {
  QPN_REVISION: 3,
  QFP: 2,
  QUALITY_FIX_PACK: 1,
};

function itemById(id: string): QualityFixItem | undefined {
  return (
    QUALITY_FIX_ITEMS.find((x) => x.row.id === id) ||
    QUALITY_PRIORITY_ITEMS.find((x) => x.row.id === id) ||
    resolvedQualityPriorityNextItems().find((x) => x.row.id === id)
  );
}

function autoMergeOk(c: DryCandidate): boolean {
  if (c.status === 'needs_source_verification' || c.status === 'needs_human') return false;
  return c.math_ok && c.structure_ok && c.duplicate_ok && c.curriculum_ok && c.source_ok;
}

function originalityScore(c: DryCandidate): number {
  const row = itemById(c.id)?.row;
  const stem = String(row?.q || '');
  const bare = /işleminin sonucu kaçtır/.test(stem) ? 0 : 2;
  const rich = /(tablo|karo|ritmik|şeker|pinpon|örüntü|parmak|karış|KOŞMA|yer değiştir|onluk|bileşke|görüntü|tanım kümesi)/i.test(
    stem,
  )
    ? 3
    : 0;
  return bare + rich;
}

function rankTuple(c: DryCandidate): number[] {
  return [
    c.status === 'source_verified' ? 1 : 0,
    c.curriculum_ok ? 1 : 0,
    c.structure_ok ? 1 : 0,
    c.duplicate_ok ? 1 : 0,
    originalityScore(c),
    PACK_RANK[c.pack],
  ];
}

function better(a: DryCandidate, b: DryCandidate): DryCandidate {
  const ra = rankTuple(a);
  const rb = rankTuple(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b;
  }
  return a;
}

function splitTopic(topic: string) {
  const [level, subject, ...rest] = topic.split('|');
  return { level: level || '', subject: subject || '', topic: rest.join('|') || topic };
}

export type BankApplyOp = {
  action: 'replace_filler';
  quality_id: string;
  target_filler_id: string;
  topic: string;
  dropStemPrefix: string;
  addStemPrefix: string;
  qpnOverlay: boolean;
};

function previewBankDiff(bank: Record<string, BankQuestion[]>, replacements: ManifestReplacement[], overlayIds: string[]) {
  const inv = fillerInventory(bank);
  const ops: BankApplyOp[] = [];
  const missing: string[] = [];
  const notFiller: string[] = [];
  const topicMismatch: string[] = [];
  for (const r of replacements) {
    const topic = `${r.level}|${r.subject}|${r.topic}`;
    const list = bank[topic] || [];
    const drop = list.find((q) => q.id === r.target_filler_id);
    const elsewhere = drop
      ? undefined
      : Object.entries(bank).find(([, qs]) => qs.some((q) => q.id === r.target_filler_id));
    const add = itemById(r.quality_id);
    if (!drop) {
      missing.push(r.target_filler_id);
      if (elsewhere) topicMismatch.push(`${r.quality_id}:${r.target_filler_id}->${elsewhere[0]}`);
    } else if (!isFillerQuestion(drop)) notFiller.push(r.target_filler_id);
    ops.push({
      action: 'replace_filler',
      quality_id: r.quality_id,
      target_filler_id: r.target_filler_id,
      topic,
      dropStemPrefix: String(drop?.q || '').replace(/\s+/g, ' ').trim().slice(0, 72),
      addStemPrefix: String(add?.row.q || '').replace(/\s+/g, ' ').trim().slice(0, 72),
      qpnOverlay: overlayIds.includes(r.quality_id),
    });
  }
  const topicsTouched = [...new Set(ops.map((o) => o.topic))].sort();
  const uniqueFillers = new Set(replacements.map((r) => r.target_filler_id)).size;
  return {
    writesBank: false as const,
    applied: false as const,
    addCount: 0,
    replaceCount: replacements.length,
    uniqueFillerAssignments: uniqueFillers,
    questionsBefore: inv.questions,
    questionsAfter: inv.questions,
    fillerBefore: inv.filler,
    fillerAfter: inv.filler - replacements.length,
    topicsTouchedCount: topicsTouched.length,
    topicsTouched,
    missingFillers: missing,
    targetsNotFiller: notFiller,
    topicMismatch,
    operations: ops,
  };
}

function replacementRow(c: DryCandidate, fillerId: string, reason: string): ManifestReplacement {
  const parts = splitTopic(c.topic);
  return {
    quality_id: c.id,
    target_filler_id: fillerId,
    level: parts.level,
    subject: parts.subject,
    topic: parts.topic,
    status: c.status,
    reason,
    pack: c.pack,
  };
}

export function buildMergeManifest(bank: Record<string, BankQuestion[]>) {
  const dry = dryRunQualityMerge(bank);
  const byId = new Map(dry.candidates.map((c) => [c.id, c]));
  const overlay = dry.overlayCheck.revisedIds;

  const collisions: CollisionResolution[] = dry.collidingFillers.map((g) => {
    const locked = Object.prototype.hasOwnProperty.call(LOCKED_COLLISION_WINNERS, g.fillerId)
      ? LOCKED_COLLISION_WINNERS[g.fillerId]
      : undefined;
    const empty = (reason: string): CollisionResolution => ({
      filler_id: g.fillerId,
      contenders: g.qualityIds,
      winner: null,
      excluded: g.qualityIds,
      reason,
    });
    if (locked === null) {
      return empty('Kilit: otomatik seçilemez (nsv / insan / kapsam).');
    }
    const lockedCand = locked ? byId.get(locked) : undefined;
    if (locked && lockedCand && g.qualityIds.includes(locked) && autoMergeOk(lockedCand)) {
      const excluded = g.qualityIds.filter((id) => id !== locked);
      const why = [
        'kilitli kazanan',
        lockedCand.status === 'source_verified' ? 'source_verified' : 'source_ok(math machine_ok)',
        'curriculum_ok',
        'structure_ok',
        'duplicate_ok',
        `özgünlük=${originalityScore(lockedCand)}`,
        `paket=${lockedCand.pack}`,
      ].join('; ');
      return { filler_id: g.fillerId, contenders: g.qualityIds, winner: locked, excluded, reason: why };
    }
    if (locked) return empty(`Kilitli kazanan ${locked} artık otomatik birleşemez; yeni kazanan seçilmedi.`);
    const contenders = g.qualityIds.map((id) => byId.get(id)!).filter(Boolean);
    const ok = contenders.filter((c) => autoMergeOk(c) && c.action === 'replace_filler');
    if (!ok.length) {
      return empty('Otomatik seçilemez: kaynak/insan bekliyor, kapsam hatası veya kapı düştü.');
    }
    let win = ok[0];
    for (const c of ok.slice(1)) win = better(win, c);
    const excluded = g.qualityIds.filter((id) => id !== win.id);
    const why = [
      win.status === 'source_verified' ? 'source_verified' : 'source_ok(math machine_ok)',
      'curriculum_ok',
      'structure_ok',
      'duplicate_ok',
      `özgünlük=${originalityScore(win)}`,
      `paket=${win.pack}`,
    ].join('; ');
    return { filler_id: g.fillerId, contenders: g.qualityIds, winner: win.id, excluded, reason: why };
  });

  const usedFillers = new Set<string>();
  const replacements: ManifestReplacement[] = [];
  const starting84 = dry.eligible.ids;

  for (const id of starting84) {
    const c = byId.get(id)!;
    if (c.action !== 'replace_filler' || !c.dropFillerId || !autoMergeOk(c)) continue;
    usedFillers.add(c.dropFillerId);
    replacements.push(replacementRow(c, c.dropFillerId, 'Başlangıç 84: çakışmasız sıralı replace + tüm kapılar.'));
  }

  for (const col of collisions) {
    if (!col.winner) continue;
    const c = byId.get(col.winner)!;
    if (!autoMergeOk(c)) continue;
    if (usedFillers.has(col.filler_id)) continue;
    if (replacements.some((r) => r.quality_id === col.winner)) continue;
    usedFillers.add(col.filler_id);
    replacements.push(replacementRow(c, col.filler_id, `Çakışma çözümü ${col.filler_id}: ${col.reason}`));
  }

  const fillerOwners = new Map<string, string[]>();
  for (const r of replacements) {
    fillerOwners.set(r.target_filler_id, [...(fillerOwners.get(r.target_filler_id) || []), r.quality_id]);
  }
  const dupFillers = [...fillerOwners.entries()].filter(([, ids]) => ids.length > 1);

  const winnerSet = new Set(replacements.map((r) => r.quality_id));
  const allIds = dry.candidates.map((c) => c.id);
  const excluded = allIds
    .filter((id) => !winnerSet.has(id))
    .map((id) => {
      const c = byId.get(id)!;
      const col = collisions.find((x) => x.contenders.includes(id));
      let reason: string = c.bucket;
      if (c.status === 'needs_source_verification') reason = 'needs_source_verification';
      else if (c.status === 'needs_human') reason = 'needs_human';
      else if (!c.curriculum_ok) reason = 'curriculum_block';
      else if (col) reason = col.winner ? `çakışma kaybeden; kazanan ${col.winner}` : 'çakışma, geçerli kazanan yok';
      else if (c.action === 'no_action') reason = 'no_action (konuda yeterli gerçek soru / filler yok)';
      else if (!c.source_ok) reason = 'source_ok değil';
      return { quality_id: id, pack: c.pack, topic: c.topic, status: c.status, reason };
    });

  const source_pending = dry.candidates
    .filter((c) => c.status === 'needs_source_verification')
    .map((c) => c.id);
  const human_pending = dry.candidates.filter((c) => c.status === 'needs_human').map((c) => c.id);
  const bankDiff = previewBankDiff(bank, replacements, overlay);
  const blocked = replacements.filter((r) => {
    const c = byId.get(r.quality_id)!;
    return (
      r.status === 'needs_source_verification' ||
      r.status === 'needs_human' ||
      !c.curriculum_ok ||
      c.action === 'no_action' ||
      c.action === 'add_if_no_filler'
    );
  });

  return {
    applied: false,
    writesBank: false,
    writesPackJson: false,
    qpnUsesRevisionOverlay: true,
    qpnRevisedIds: overlay,
    mainPackSha256: MAIN_PACK_SHA256,
    starting84Count: starting84.length,
    starting84,
    collisions,
    collisionCount: collisions.length,
    replacements,
    replacementCount: replacements.length,
    excluded,
    excludedCount: excluded.length,
    source_pending,
    human_pending,
    duplicateFillerAssignments: dupFillers,
    projectedQuestions: 7007,
    projectedFillerDelta: -replacements.length,
    verification: {
      applied: false,
      writesBank: false,
      uniqueFillers: bankDiff.uniqueFillerAssignments,
      uniqueEqualsCount: bankDiff.uniqueFillerAssignments === replacements.length,
      blockedInReplacements: blocked.map((r) => r.quality_id),
      missingFillers: bankDiff.missingFillers,
      targetsNotFiller: bankDiff.targetsNotFiller,
      topicMismatch: bankDiff.topicMismatch,
      lockedWinnersHonored: collisions.every(
        (c) => LOCKED_COLLISION_WINNERS[c.filler_id] === c.winner,
      ),
      addCount: 0,
    },
    bankDiff,
  };
}

export function mergeManifestJson(bank: Record<string, BankQuestion[]>) {
  const m = buildMergeManifest(bank);
  return {
    applied: m.applied,
    writesBank: m.writesBank,
    writesPackJson: m.writesPackJson,
    qpnUsesRevisionOverlay: m.qpnUsesRevisionOverlay,
    qpnRevisedIds: m.qpnRevisedIds,
    mainPackSha256: m.mainPackSha256,
    starting84Count: m.starting84Count,
    starting84: m.starting84,
    collisions: m.collisions,
    replacements: m.replacements.map(({ pack: _p, ...rest }) => rest),
    excluded: m.excluded,
    source_pending: m.source_pending,
    human_pending: m.human_pending,
    replacementCount: m.replacementCount,
    projectedQuestions: m.projectedQuestions,
    projectedFillerDelta: m.projectedFillerDelta,
    verification: m.verification,
    bankDiff: {
      ...m.bankDiff,
      operations: m.bankDiff.operations,
    },
  };
}
