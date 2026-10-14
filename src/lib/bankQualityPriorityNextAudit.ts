import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS, type QualityFixItem } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';
import { QUALITY_PRIORITY_NEXT_META } from '../data/bankQualityPriorityNextPack';
import { numericOption } from '../data/bankQualityFixPack';
import { reauditGateSafeMappings } from './bankQualityInventory';
import { PRIORITY_SCOPE_REMEDIATION } from './bankQualityPriorityNextRemediation';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

export function independentPriorityNextMath(item: QualityFixItem): { ok: boolean; computed?: number | string; reason: string } {
  const id = item.row.id;
  const chosen = item.row.o[item.row.a];
  const num = () => numericOption(item.row);
  const table: Record<string, () => { ok: boolean; computed?: number | string; reason: string }> = {
    'qpn-tyt-sy-01': () => {
      const v = Math.sqrt(12) + Math.sqrt(27);
      return { ok: Math.abs(v - 5 * Math.sqrt(3)) < 1e-9 && chosen === '5√3', computed: '5√3', reason: '√12+√27' };
    },
    'qpn-tyt-sy-02': () => ({
      ok: Math.abs(Math.sqrt(8) * Math.sqrt(18) - 12) < 1e-9 && num() === 12,
      computed: 12,
      reason: '√8·√18',
    }),
    'qpn-tyt-sy-03': () => ({
      ok: Math.abs(3.6 * 10 ** -4 - 0.00036) < 1e-12 && Math.abs(num() - 0.00036) < 1e-12,
      computed: 0.00036,
      reason: '3.6e-4',
    }),
    'qpn-tyt-sy-04': () => ({
      ok: (5 * 10 ** 3) * (4 * 10 ** -2) === 200 && num() === 200,
      computed: 200,
      reason: 'bilimsel çarpım',
    }),
    'qpn-tyt-sy-05': () => ({
      ok: 120 * (1 - 0.15) === 102 && num() === 102,
      computed: 102,
      reason: '%15 indirim',
    }),
    'qpn-tyt-sy-06': () => ({
      ok: gcd(24, 36) === 12 && num() === 12,
      computed: 12,
      reason: 'EBOB(24,36)',
    }),
    'qpn-tyt-sy-07': () => ({
      ok: lcm(8, 12) === 24 && num() === 24,
      computed: 24,
      reason: 'EKOK(8,12)',
    }),
    'qpn-tyt-sy-08': () => ({
      ok: 3 ** 8 / 3 ** 5 === 27 && num() === 27,
      computed: 27,
      reason: '3^8/3^5',
    }),
    'qpn-tyt-fn-01': () => ({
      ok: -5 - 1 === -6 && num() === -6,
      computed: -6,
      reason: 'grafik f(4)-f(0)',
    }),
    'qpn-tyt-fn-02': () => ({
      ok: chosen.includes('−2') && chosen.includes('2') && !chosen.includes('1}'),
      computed: 'R\\{-2,2}',
      reason: 'payda x^2-4',
    }),
    'qpn-tyt-fn-03': () => ({
      ok: 3 + 5 + 4 === 12 && num() === 12,
      computed: 12,
      reason: 'parçalı',
    }),
    'qpn-tyt-fn-04': () => {
      const img = [4 - 1, 4 - 0, 4 - 4];
      return { ok: chosen === '{0, 3, 4}' && img.sort((a, b) => a - b).join() === '0,3,4', computed: '{0,3,4}', reason: 'görüntü' };
    },
    'qpn-ayt-fn-01': () => {
      const vertex = 4 - 8 + 7;
      return { ok: vertex === 3 && chosen.includes('[3'), computed: '[3,∞)', reason: 'tepe' };
    },
    'qpn-ayt-fn-02': () => ({
      ok: 5 * 5 === 25 && num() === 5 && chosen !== '−5',
      computed: 5,
      reason: 'x^2 ters x≥0',
    }),
    'qpn-ayt-fn-03': () => ({
      ok: (3 - 1) ** 3 === 8 && num() === 3,
      computed: 3,
      reason: '(f∘g)^{-1}(8)',
    }),
    'qpn-ayt-fn-04': () => ({
      ok: 2 + -2 === 0 && num() === 0,
      computed: 0,
      reason: 'tek f(-5)+f(5)',
    }),
    'qpn-s1-sy-r5': () => ({ ok: 15 + 5 === 20 && num() === 20, computed: 20, reason: 'beşer' }),
    'qpn-s1-sy-r10': () => ({ ok: 10 + 10 === 20 && num() === 20, computed: 20, reason: 'onar' }),
    'qpn-s1-sy-ob': () => ({ ok: 10 + 6 === 16 && num() === 16, computed: 16, reason: 'onluk birlik' }),
    'qpn-s1-ad-cm': () => ({
      ok: 6 + 9 === 9 + 6 && chosen.includes('eşittir'),
      computed: 'eşit',
      reason: 'yer değiştirme',
    }),
    'qpn-s1-ad-ms': () => ({ ok: 9 + 6 === 15 && num() === 6, computed: 6, reason: 'verilmeyen toplanan' }),
    'qpn-s1-geo-cs': () => ({
      ok: chosen.includes('Yuvarlak'),
      computed: 'yuvarlak',
      reason: 'pinpon',
    }),
    'qpn-s1-geo-or': () => ({ ok: chosen === 'Üçgen', computed: 'üçgen', reason: 'örüntü' }),
    'qpn-s1-ol-ns': () => ({
      ok: chosen === 'Parmak' && item.row.o.includes('Metre') && item.row.a !== item.row.o.indexOf('Metre'),
      computed: 'parmak',
      reason: 'M.1.3.1.2',
    }),
  };
  const fn = table[id];
  if (!fn) return { ok: false, reason: `next matematik tablosu yok: ${id}` };
  return fn();
}

export function conceptKey(q: BankQuestion) {
  return String(q.q || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[0-9]+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export function auditPriorityNextPack(bank: Record<string, BankQuestion[]>) {
  const structuralFail: string[] = [];
  const mathFail: string[] = [];
  const fps = new Map<string, string>();
  const bankList = Object.values(bank).flat();
  const bankFp = new Set(bankList.map((q) => questionFingerprint(q)));
  const oldPackFp = new Set(QUALITY_FIX_ITEMS.map((x) => questionFingerprint(x.row)));
  const qfpFp = new Set(QUALITY_PRIORITY_ITEMS.map((x) => questionFingerprint(x.row)));
  const bankConcept = new Map<string, string[]>();
  for (const q of bankList) {
    const k = conceptKey(q);
    bankConcept.set(k, [...(bankConcept.get(k) || []), q.id]);
  }
  const packConcept = new Map<string, string[]>();
  for (const x of [...QUALITY_FIX_ITEMS, ...QUALITY_PRIORITY_ITEMS]) {
    const k = conceptKey(x.row);
    packConcept.set(k, [...(packConcept.get(k) || []), x.row.id]);
  }

  const exactBank: string[] = [];
  const exactOldPack: string[] = [];
  const exactQfp: string[] = [];
  const conceptualBank: { id: string; near: string[] }[] = [];
  const conceptualPack: { id: string; near: string[] }[] = [];
  const idCollisions = QUALITY_PRIORITY_NEXT_ITEMS.filter(
    (x) =>
      QUALITY_FIX_ITEMS.some((y) => y.row.id === x.row.id) ||
      QUALITY_PRIORITY_ITEMS.some((y) => y.row.id === x.row.id) ||
      bankList.some((q) => q.id === x.row.id),
  ).map((x) => x.row.id);

  for (const item of QUALITY_PRIORITY_NEXT_ITEMS) {
    const q = item.row;
    if (!String(q.id).startsWith('qpn-')) structuralFail.push(`prefix:${q.id}`);
    if (!isValidQuestion(q) || isFillerQuestion(q) || q.kind === 'osym') structuralFail.push(q.id);
    if (q.o.length !== 5) structuralFail.push(`opts:${q.id}`);
    const fp = questionFingerprint(q);
    if (fps.has(fp)) structuralFail.push(`fp:${q.id}/${fps.get(fp)}`);
    else fps.set(fp, q.id);
    if (bankFp.has(fp)) exactBank.push(q.id);
    if (oldPackFp.has(fp)) exactOldPack.push(q.id);
    if (qfpFp.has(fp)) exactQfp.push(q.id);
    const ck = conceptKey(q);
    const nearB = (bankConcept.get(ck) || []).filter((id) => id !== q.id);
    if (nearB.length) conceptualBank.push({ id: q.id, near: nearB });
    const nearP = (packConcept.get(ck) || []).filter((id) => id !== q.id);
    if (nearP.length) conceptualPack.push({ id: q.id, near: nearP });
    if (item.verify === 'math') {
      const r = independentPriorityNextMath(item);
      if (!r.ok) mathFail.push(`${q.id}:${r.reason}`);
    }
    if (item.status === 'source_verified') structuralFail.push(`unearned_source:${q.id}`);
  }

  const existingFix = reauditGateSafeMappings(bank);
  const bannedStems = QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => {
    const t = x.row.q.toLocaleLowerCase('tr-TR');
    const ans = x.row.o[x.row.a].toLocaleLowerCase('tr-TR');
    if (t.includes('eş anlamlı') || t.includes('anlamca en yakın')) return true;
    if (t.includes('tabloda') && x.topic.includes('Türkçe')) return true;
    if (t.includes('yeşil ışık') && ans.includes('geç')) return true;
    if (x.topic.startsWith('1. Sınıf|Matematik|Ölçme') && ans === 'metre') return true;
    return false;
  }).map((x) => x.row.id);

  return {
    count: QUALITY_PRIORITY_NEXT_ITEMS.length,
    byTopic: Object.fromEntries(
      [...new Set(QUALITY_PRIORITY_NEXT_ITEMS.map((x) => x.topic))].map((t) => [
        t,
        QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.topic === t).length,
      ]),
    ),
    byStatus: {
      machine_ok: QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.status === 'machine_ok').length,
      source_verified: QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.status === 'source_verified').length,
      needs_source_verification: QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.status === 'needs_source_verification').length,
      needs_human: QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.status === 'needs_human').length,
    },
    mathCount: QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.verify === 'math').length,
    mathFail,
    structuralFail: [...new Set(structuralFail)],
    exactBank,
    exactOldPack,
    exactQfp,
    conceptualBank,
    conceptualPack,
    idCollisions,
    bannedStems,
    existingStillSafe: existingFix.stillSafe,
    existingGateSafe: existingFix.gateSafe,
    existingFixPackCount: QUALITY_FIX_ITEMS.length,
    existingPriorityCount: QUALITY_PRIORITY_ITEMS.length,
    mergedIntoBank: QUALITY_PRIORITY_NEXT_META.mergedIntoBank,
    remediation: PRIORITY_SCOPE_REMEDIATION.map((r) => r.id),
  };
}
