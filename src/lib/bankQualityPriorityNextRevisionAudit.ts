import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_NEXT_ITEMS, type QualityNextItem } from '../data/bankQualityPriorityNextItems';
import {
  QUALITY_PRIORITY_NEXT_REVISION_ITEMS,
  QPN_REVISE_IDS,
  resolvedQualityPriorityNextItems,
} from '../data/bankQualityPriorityNextRevisionItems';
import { QUALITY_PRIORITY_NEXT_REVISION_META } from '../data/bankQualityPriorityNextRevisionPack';
import { numericOption } from '../data/bankQualityFixPack';
import { independentPriorityNextMath } from './bankQualityPriorityNextAudit';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

export function independentRevisionMath(item: QualityNextItem) {
  const id = item.row.id;
  const chosen = item.row.o[item.row.a];
  const num = () => numericOption(item.row);
  const table: Record<string, () => { ok: boolean; reason: string }> = {
    'qpn-tyt-sy-07': () => ({
      ok: lcm(8, 12) === 24 && num() === 24 && chosen === '24' && !item.row.o.includes('4'),
      reason: 'EKOK(8,12)=24; EBOB şıkkı yok',
    }),
    'qpn-tyt-fn-01': () => ({
      ok: -5 - 1 === -6 && num() === -6 && !/grafik/i.test(item.row.q),
      reason: 'tablo f(4)-f(0)',
    }),
    'qpn-s1-sy-r5': () => ({
      ok: 15 + 5 === 20 && num() === 20 && item.row.o.every((o) => Number(o) >= 1 && Number(o) <= 20),
      reason: 'beşer ≤20',
    }),
    'qpn-s1-sy-r10': () => ({
      ok: 10 + 10 === 20 && num() === 20 && item.row.o.every((o) => Number(o) >= 1 && Number(o) <= 20),
      reason: 'onar ≤20',
    }),
  };
  const fn = table[id];
  if (fn) return fn();
  if (item.verify !== 'math') return { ok: true, reason: 'not-math' };
  return independentPriorityNextMath(item);
}

export function auditPriorityNextRevision(bank: Record<string, BankQuestion[]>) {
  const resolved = resolvedQualityPriorityNextItems();
  const structuralFail: string[] = [];
  const mathFail: string[] = [];
  const fps = new Map<string, string>();
  const bankFp = new Set(Object.values(bank).flat().map((q) => questionFingerprint(q)));
  const oldFp = new Set(QUALITY_FIX_ITEMS.map((x) => questionFingerprint(x.row)));
  const qfpFp = new Set(QUALITY_PRIORITY_ITEMS.map((x) => questionFingerprint(x.row)));
  const origKeepFp = new Set(
    QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => !QPN_REVISE_IDS.includes(x.row.id as (typeof QPN_REVISE_IDS)[number])).map(
      (x) => questionFingerprint(x.row),
    ),
  );
  const exactBank: string[] = [];
  const exactOld: string[] = [];
  const exactQfp: string[] = [];
  const exactKeepQpn: string[] = [];

  if (resolved.length !== 28) structuralFail.push(`count:${resolved.length}`);
  if (QUALITY_PRIORITY_NEXT_REVISION_ITEMS.length !== 6) structuralFail.push('reviseCount');
  const origById = new Map(QUALITY_PRIORITY_NEXT_ITEMS.map((x) => [x.row.id, x]));

  for (const item of resolved) {
    const q = item.row;
    if (!isValidQuestion(q) || isFillerQuestion(q) || q.kind === 'osym' || q.o.length !== 5) structuralFail.push(q.id);
    const fp = questionFingerprint(q);
    if (fps.has(fp)) structuralFail.push(`fp:${q.id}`);
    else fps.set(fp, q.id);
    if (bankFp.has(fp)) exactBank.push(q.id);
    if (oldFp.has(fp)) exactOld.push(q.id);
    if (qfpFp.has(fp)) exactQfp.push(q.id);
    if (origKeepFp.has(fp) && QPN_REVISE_IDS.includes(q.id as (typeof QPN_REVISE_IDS)[number])) exactKeepQpn.push(q.id);
    if (item.verify === 'math') {
      const r = independentRevisionMath(item);
      if (!r.ok) mathFail.push(`${q.id}:${r.reason}`);
    }
    if (item.status === 'source_verified') structuralFail.push(`unearned:${q.id}`);
  }

  for (const id of QPN_REVISE_IDS) {
    const orig = origById.get(id);
    const rev = QUALITY_PRIORITY_NEXT_REVISION_ITEMS.find((x) => x.row.id === id);
    if (!orig || !rev) structuralFail.push(`missing:${id}`);
    else if (questionFingerprint(orig.row) === questionFingerprint(rev.row)) structuralFail.push(`unchanged:${id}`);
  }

  const keepSame = QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => !QPN_REVISE_IDS.includes(x.row.id as (typeof QPN_REVISE_IDS)[number])).every(
    (x) => resolved.find((y) => y.row.id === x.row.id) === x,
  );

  const go13 = resolved.find((x) => x.row.id === 'qpn-s1-go-13')!;
  const go19 = resolved.find((x) => x.row.id === 'qpn-s1-go-19')!;
  const pretendVisual =
    /resim:|görsel|grafik/i.test(go13.row.q) || /figür|kırmızı daire|yeşil ışık/i.test(go19.row.q + go19.row.o.join(' '));

  return {
    count: resolved.length,
    mathFail,
    structuralFail: [...new Set(structuralFail)],
    exactBank,
    exactOld,
    exactQfp,
    exactKeepQpn,
    keepSame,
    pretendVisual,
    mergedIntoBank: QUALITY_PRIORITY_NEXT_REVISION_META.mergedIntoBank,
    originalUntouched: QUALITY_PRIORITY_NEXT_REVISION_META.originalQpnItemsUntouched,
    go13Status: go13.status,
    go19Status: go19.status,
  };
}
