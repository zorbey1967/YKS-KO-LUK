import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS, type QualityFixItem } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { numericOption } from '../data/bankQualityFixPack';
import { QUALITY_PRIORITY_META } from '../data/bankQualityPriorityPack';
import { reauditGateSafeMappings } from './bankQualityInventory';
import { SOURCE_CONTRADICTIONS } from './bankQualitySourceAudit';

export const PRIORITY_TOPICS = [
  'YKS TYT|Matematik|Sayılar',
  'YKS TYT|Matematik|Fonksiyon',
  'YKS AYT|Matematik|Fonksiyonlar',
  '1. Sınıf|Türkçe|Sözcük dağarcığı',
  '1. Sınıf|Türkçe|Görsel okuma',
  '1. Sınıf|Türkçe|Kısa metin',
  '1. Sınıf|Matematik|Sayılar 1-20',
  '1. Sınıf|Matematik|Toplama',
  '1. Sınıf|Matematik|Çıkarma',
  '1. Sınıf|Matematik|Geometrik şekiller',
  '1. Sınıf|Matematik|Ölçme',
] as const;

export function topicSplit(bank: Record<string, BankQuestion[]>, topic: string) {
  const list = bank[topic] || [];
  const filler = list.filter(isFillerQuestion);
  const real = list.filter((q) => !isFillerQuestion(q));
  return {
    topic,
    total: list.length,
    filler: filler.length,
    real: real.length,
    realIds: real.map((q) => q.id),
    realStemPrefixes: real.map((q) => String(q.q || '').replace(/\s+/g, ' ').trim().slice(0, 72)),
  };
}

export function independentPriorityMath(item: QualityFixItem): { ok: boolean; computed?: number | string; reason: string } {
  const id = item.row.id;
  const chosen = item.row.o[item.row.a];
  const num = () => numericOption(item.row);
  const table: Record<string, () => { ok: boolean; computed?: number | string; reason: string }> = {
    'qfp-tyt-sy-01': () => ({ ok: 3 * (8 - 5) + 4 === 13 && num() === 13, computed: 13, reason: '3*(8-5)+4' }),
    'qfp-tyt-sy-02': () => ({ ok: Math.abs(2 / 5 + 1 / 10 - 0.5) < 1e-9 && Math.abs(num() - 0.5) < 1e-9, computed: 0.5, reason: '2/5+1/10' }),
    'qfp-tyt-sy-03': () => ({ ok: (-2) ** 3 === -8 && num() === -8, computed: -8, reason: '(-2)^3' }),
    'qfp-tyt-sy-04': () => ({ ok: 47 % 5 === 2 && num() === 2, computed: 2, reason: '47%5' }),
    'qfp-tyt-sy-05': () => ({ ok: 3 / 7 < 1 / 2 && chosen.includes('3/7 < 1/2'), computed: '3/7<1/2', reason: 'kesir karşılaştır' }),
    'qfp-tyt-sy-06': () => ({ ok: Math.abs(0.25 - 1 / 4) < 1e-9 && Math.abs(num() - 0.25) < 1e-9, computed: 0.25, reason: '0.25=1/4' }),
    'qfp-tyt-fn-01': () => ({ ok: 2 * 3 - 4 === 2 && num() === 2, computed: 2, reason: 'g(f(2))' }),
    'qfp-tyt-fn-02': () => ({ ok: Math.abs(2 * 1 - 6) === 4 && num() === 4, computed: 4, reason: '|2-6|' }),
    'qfp-tyt-fn-03': () => ({ ok: chosen === '{1,2,3}' && [0, 1, 2].every((x) => [1, 2, 3].includes(x + 1)), computed: '{1,2,3}', reason: 'görüntü kümesi' }),
    'qfp-tyt-fn-04': () => ({ ok: 10 - (10 - 3) === 3 && num() === 3, computed: 3, reason: 'f(f(3))' }),
    'qfp-tyt-fn-05': () => ({ ok: chosen.includes('(1,3)') || chosen.includes('(1,2),(1,3)'), computed: 'not-function', reason: 'çift görüntü' }),
    'qfp-ayt-fn-01': () => ({ ok: (2 * 2 + 5) === 9 && num() === 2, computed: 2, reason: 'f^{-1}(9)' }),
    'qfp-ayt-fn-02': () => ({ ok: num() === 4 && chosen === '4', computed: 4, reason: 'çift f(-3)' }),
    'qfp-ayt-fn-03': () => ({ ok: chosen.includes('[1'), computed: '[1,∞)', reason: 'kök tanım' }),
    'qfp-ayt-fn-04': () => ({ ok: chosen === '2x+1', computed: '2x+1', reason: 'f(u)=2u+1' }),
    'qfp-ayt-fn-05': () => ({ ok: chosen === 'g⁻¹ ∘ f⁻¹', computed: 'g^{-1}∘f^{-1}', reason: 'bileşke ters' }),
    'qfp-ayt-fn-06': () => ({ ok: chosen.includes('Birebir'), computed: '1-1', reason: 'x^3+x artan' }),
    'qfp-s1-sy-01': () => ({ ok: 8 < 9 && 9 < 10 && num() === 9, computed: 9, reason: 'arasında' }),
    'qfp-s1-sy-02': () => ({ ok: 15 > 12 && num() === 15, computed: 15, reason: 'max' }),
    'qfp-s1-ad-01': () => ({ ok: 4 + 5 === 9 && num() === 9, computed: 9, reason: '4+5' }),
    'qfp-s1-sb-01': () => ({ ok: 10 - 4 === 6 && num() === 6, computed: 6, reason: '10-4' }),
    'qfp-s1-geo-01': () => ({ ok: num() === 4, computed: 4, reason: 'kare kenar' }),
    'qfp-s1-geo-02': () => ({ ok: num() === 3, computed: 3, reason: 'üçgen köşe' }),
    'qfp-s1-ol-01': () => ({ ok: chosen === 'Metre', computed: 'metre', reason: 'uzunluk birimi' }),
    'qfp-s1-ol-02': () => ({ ok: 5 > 3 && num() === 5, computed: 5, reason: 'karış' }),
  };
  const fn = table[id];
  if (!fn) return { ok: false, reason: `öncelik matematik tablosu yok: ${id}` };
  return fn();
}

export function auditPriorityPack(bank: Record<string, BankQuestion[]>) {
  const structuralFail: string[] = [];
  const mathFail: string[] = [];
  const fps = new Map<string, string>();
  const bankFp = new Set(
    Object.values(bank).flatMap((list) => list.map((q) => questionFingerprint(q))),
  );
  const packFp = new Set(QUALITY_FIX_ITEMS.map((x) => questionFingerprint(x.row)));
  const exactBank: string[] = [];
  const exactOldPack: string[] = [];
  const idCollisions = QUALITY_PRIORITY_ITEMS.filter(
    (x) => QUALITY_FIX_ITEMS.some((y) => y.row.id === x.row.id) || Object.values(bank).some((l) => l.some((q) => q.id === x.row.id)),
  ).map((x) => x.row.id);

  for (const item of QUALITY_PRIORITY_ITEMS) {
    const q = item.row;
    if (!isValidQuestion(q) || isFillerQuestion(q) || q.kind === 'osym') structuralFail.push(q.id);
    if (q.o.length !== 5) structuralFail.push(q.id);
    const fp = questionFingerprint(q);
    if (fps.has(fp)) structuralFail.push(`fp:${q.id}/${fps.get(fp)}`);
    else fps.set(fp, q.id);
    if (bankFp.has(fp)) exactBank.push(q.id);
    if (packFp.has(fp)) exactOldPack.push(q.id);
    if (item.verify === 'math') {
      const r = independentPriorityMath(item);
      if (!r.ok) mathFail.push(`${q.id}:${r.reason}`);
    }
  }

  const splits = PRIORITY_TOPICS.map((t) => topicSplit(bank, t));
  const existingFix = reauditGateSafeMappings(bank);

  return {
    count: QUALITY_PRIORITY_ITEMS.length,
    byTopic: Object.fromEntries(
      [...new Set(QUALITY_PRIORITY_ITEMS.map((x) => x.topic))].map((t) => [
        t,
        QUALITY_PRIORITY_ITEMS.filter((x) => x.topic === t).length,
      ]),
    ),
    byStatus: {
      machine_ok: QUALITY_PRIORITY_ITEMS.filter((x) => x.status === 'machine_ok').length,
      source_verified: QUALITY_PRIORITY_ITEMS.filter((x) => x.status === 'source_verified').length,
      needs_source_verification: QUALITY_PRIORITY_ITEMS.filter((x) => x.status === 'needs_source_verification').length,
      needs_human: QUALITY_PRIORITY_ITEMS.filter((x) => x.status === 'needs_human').length,
    },
    mathCount: QUALITY_PRIORITY_ITEMS.filter((x) => x.verify === 'math').length,
    mathFail,
    structuralFail: [...new Set(structuralFail)],
    exactBank,
    exactOldPack,
    idCollisions,
    splits,
    existingFixPackCount: QUALITY_FIX_ITEMS.length,
    existingStillSafe: existingFix.stillSafe,
    existingGateSafe: existingFix.gateSafe,
    programContradictionsKept: SOURCE_CONTRADICTIONS.map((c) => c.id),
    mergedIntoBank: QUALITY_PRIORITY_META.mergedIntoBank,
    existingFixUntouched: QUALITY_PRIORITY_META.existingFixPackUntouched,
  };
}
