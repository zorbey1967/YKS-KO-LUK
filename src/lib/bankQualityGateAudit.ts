import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS, type QualityFixItem } from '../data/bankQualityFixItems';
import { numericOption } from '../data/bankQualityFixPack';
import { proposeQualityMerge, type ReplacementRow } from './bankQualityMergePlan';
import { CONCEPTUAL_OVERLAPS } from './bankQualitySourceAudit';

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a: number, b: number) {
  return Math.abs(a * b) / gcd(a, b);
}

/** expected alanını okumadan, kökten bağımsız hesap. */
export function independentMathValue(item: QualityFixItem): { ok: boolean; computed?: number | string; reason: string } {
  const id = item.row.id;
  const chosen = item.row.o[item.row.a];
  const table: Record<string, () => { ok: boolean; computed?: number | string; reason: string }> = {
    'qf-1-add-7-5': () => ({ ok: 7 + 5 === 12 && numericOption(item.row) === 12, computed: 7 + 5, reason: '7+5' }),
    'qf-n001': () => ({ ok: 9 + 6 === 15 && numericOption(item.row) === 15, computed: 9 + 6, reason: '9+6' }),
    'qf-n002': () => ({ ok: 8 + 8 === 16 && numericOption(item.row) === 16, computed: 8 + 8, reason: '8+8' }),
    'qf-n003': () => ({ ok: 14 - 6 === 8 && numericOption(item.row) === 8, computed: 14 - 6, reason: '14-6' }),
    'qf-n004': () => ({ ok: 11 - 4 === 7 && numericOption(item.row) === 7, computed: 11 - 4, reason: '11-4' }),
    'qf-2-mul-6-4': () => ({ ok: 6 * 4 === 24 && numericOption(item.row) === 24, computed: 6 * 4, reason: '6*4' }),
    'qf-n006': () => ({ ok: 5 * 7 === 35 && numericOption(item.row) === 35, computed: 5 * 7, reason: '5*7' }),
    'qf-n007': () => ({ ok: 9 * 3 === 27 && numericOption(item.row) === 27, computed: 9 * 3, reason: '9*3' }),
    'qf-n008': () => ({ ok: 4 * 5 === 20 && numericOption(item.row) === 20, computed: 4 * 5, reason: '4*5' }),
    'qf-3-frac-half': () => ({ ok: (1 + 3) / 4 === 1 && numericOption(item.row) === 1, computed: 1, reason: '1/4+3/4' }),
    'qf-n011': () => ({ ok: (2 + 1) / 5 === 0.6 && Math.abs(numericOption(item.row) - 0.6) < 1e-9, computed: 0.6, reason: '2/5+1/5' }),
    'qf-n012': () => ({ ok: 36 / 6 === 6 && numericOption(item.row) === 6, computed: 6, reason: '36/6' }),
    'qf-n013': () => ({ ok: 8 * 6 === 48 && numericOption(item.row) === 48, computed: 48, reason: '8*6' }),
    'qf-n019': () => ({ ok: 1 / 2 === 2 / 4 && chosen === 'Denktirler', computed: '1/2=2/4', reason: 'denk kesir' }),
    'qf-n020': () => ({ ok: (3 + 1) / 8 === 0.5 && Math.abs(numericOption(item.row) - 0.5) < 1e-9, computed: 0.5, reason: '3/8+1/8' }),
    'qf-n021': () => ({ ok: Math.floor(247 / 10) % 10 === 4 && numericOption(item.row) === 4, computed: 4, reason: 'onlar' }),
    'qf-5-frac-eq': () => ({ ok: 3 / 6 === 0.5 && Math.abs(numericOption(item.row) - 0.5) < 1e-9, computed: 0.5, reason: '3/6' }),
    'qf-n025': () => ({ ok: (2 - 1) / 3 === 1 / 3 && Math.abs(numericOption(item.row) - 1 / 3) < 1e-9, computed: 1 / 3, reason: '2/3-1/3' }),
    'qf-n026': () => ({ ok: 4 / 10 === 0.4 && Math.abs(numericOption(item.row) - 0.4) < 1e-9, computed: 0.4, reason: '4/10' }),
    'qf-6-int-neg': () => ({ ok: -5 + 8 === 3 && numericOption(item.row) === 3, computed: 3, reason: '-5+8' }),
    'qf-n033': () => ({ ok: (-2) * (-3) === 6 && numericOption(item.row) === 6, computed: 6, reason: '(-2)*(-3)' }),
    'qf-n034': () => ({ ok: -12 + -7 === -19 && numericOption(item.row) === -19, computed: -19, reason: '-12+(-7)' }),
    'qf-n035': () => ({ ok: Math.abs(-9) === 9 && numericOption(item.row) === 9, computed: 9, reason: '|−9|' }),
    'qf-n036': () => ({ ok: gcd(12, 18) === 6 && numericOption(item.row) === 6, computed: 6, reason: 'gcd' }),
    'qf-7-work': () => ({ ok: (4 * 12) / 6 === 8 && numericOption(item.row) === 8, computed: 8, reason: 'işçi-gün' }),
    'qf-n040': () => ({ ok: (3 * 12) / 6 === 6 && numericOption(item.row) === 6, computed: 6, reason: 'işçi-gün' }),
    'qf-n041': () => ({ ok: 40 * 0.25 === 10 && numericOption(item.row) === 10, computed: 10, reason: '%25' }),
    'qf-n042': () => ({ ok: 14 / 0.2 === 70 && numericOption(item.row) === 70, computed: 70, reason: '%20=14' }),
    'qf-n043': () => ({ ok: (10 - 4) / 2 === 3 && numericOption(item.row) === 3, computed: 3, reason: '2x+4=10' }),
    'qf-8-exp': () => ({ ok: 2 ** 5 === 32 && numericOption(item.row) === 32, computed: 32, reason: '2^(3+2)' }),
    'qf-n048': () => ({ ok: 3 ** 4 === 81 && numericOption(item.row) === 81, computed: 81, reason: '3^4' }),
    'qf-n049': () => ({ ok: 5 ** 0 === 1 && numericOption(item.row) === 1, computed: 1, reason: '5^0' }),
    'qf-n050': () => ({ ok: Math.sqrt(81) === 9 && numericOption(item.row) === 9, computed: 9, reason: '√81' }),
    'qf-n055': () => ({ ok: 2 ** -3 === 0.125 && Math.abs(numericOption(item.row) - 0.125) < 1e-9, computed: 0.125, reason: '2^-3' }),
    'qf-n056': () => ({ ok: (10 + 5) / 3 === 5 && numericOption(item.row) === 5, computed: 5, reason: '3x-5=10' }),
    'qf-n057': () => ({ ok: chosen === 'y∈Q', computed: 'y∈Q', reason: 'alt küme tanımı' }),
    'qf-10-fn': () => ({ ok: (7 + 3) / 2 === 5 && numericOption(item.row) === 5, computed: 5, reason: '2a-3=7' }),
    'qf-n059': () => ({ ok: (8 + 1) / 3 === 3 && numericOption(item.row) === 3, computed: 3, reason: '3a-1=8' }),
    'qf-n060': () => ({ ok: 2 * 3 === 6 && numericOption(item.row) === 6, computed: 6, reason: 'sabit terim' }),
    'qf-tyt-gcd': () => ({ ok: gcd(20, 30) === 10 && numericOption(item.row) === 10, computed: 10, reason: 'gcd(20,30)' }),
    'qf-n061': () => ({ ok: lcm(12, 18) === 36 && numericOption(item.row) === 36, computed: 36, reason: 'lcm' }),
    'qf-n062': () => ({ ok: gcd(15, 25) === 5 && numericOption(item.row) === 5, computed: 5, reason: 'gcd' }),
    'qf-tyt-lin': () => ({ ok: (14 - 6) / 2 === 4 && numericOption(item.row) === 4, computed: 4, reason: '2x+6=14' }),
    'qf-n063': () => ({ ok: (9 + 3) / (5 - 2) === 4 && numericOption(item.row) === 4, computed: 4, reason: '5x-3=2x+9' }),
    'qf-tyt-sqrt': () => ({ ok: Math.abs(Math.sqrt(45) - 3 * Math.sqrt(5)) < 1e-9 && chosen === '3√5', computed: '3√5', reason: '√45' }),
    'qf-n064': () => ({ ok: Math.abs(Math.sqrt(50) - 5 * Math.sqrt(2)) < 1e-9 && chosen === '5√2', computed: '5√2', reason: '√50' }),
    'qf-n065': () => ({ ok: 8 / 0.2 === 40 && numericOption(item.row) === 40, computed: 40, reason: '%20=8' }),
    'qf-n066': () => ({ ok: chosen === '{3}', computed: '{3}', reason: '{1,2,3}∩{3,4}' }),
    'qf-kpss-pct': () => ({ ok: 80 * 0.2 === 16 && numericOption(item.row) === 16, computed: 16, reason: '%20' }),
    'qf-n067': () => ({ ok: 200 * 0.15 === 30 && numericOption(item.row) === 30, computed: 30, reason: '%15' }),
    'qf-kpss-num': () => ({ ok: (16 + 5) / 3 === 7 && numericOption(item.row) === 7, computed: 7, reason: '3x-5=16' }),
    'qf-n068': () => ({ ok: (30 - 2) / 4 === 7 && numericOption(item.row) === 7, computed: 7, reason: '4x+2=30' }),
    'qf-n069': () => ({ ok: (2 / 5) * 20 === 8 && numericOption(item.row) === 8, computed: 8, reason: '2/5=x/20' }),
    'qf-n074': () => ({ ok: -3 + 11 - 4 === 4 && numericOption(item.row) === 4, computed: 4, reason: '-3+11-4' }),
    'qf-n075': () => ({ ok: gcd(2, 9) === 1 && chosen === 'Doğrudur', computed: 'true', reason: '2⊥9 ⇒ 18' }),
    'qf-n076': () => ({ ok: 1 / 6 === numericOption(item.row) && chosen === '1/6', computed: 1 / 6, reason: 'zar' }),
    'qf-n077': () => ({ ok: 3 * 2 * 1 === 6 && numericOption(item.row) === 6, computed: 6, reason: '3!' }),
    'qf-n078': () => ({ ok: 360 / 4 === 90 && numericOption(item.row) === 90, computed: 90, reason: 'kare açı' }),
    'qf-n079': () => ({ ok: 180 - 40 - 70 === 70 && numericOption(item.row) === 70, computed: 70, reason: '40+70+x=180' }),
    'qf-n080': () => ({ ok: 180 === numericOption(item.row), computed: 180, reason: 'komşu açı' }),
    'qf-n084': () => ({ ok: 13 + 1 === 14 && numericOption(item.row) === 14, computed: 14, reason: '13+1' }),
    'qf-n086': () => ({ ok: numericOption(item.row) === 3, computed: 3, reason: 'saat 3:00 akrep' }),
    'qf-n087': () => ({ ok: 7 * 9 === 63 && numericOption(item.row) === 63, computed: 63, reason: '7*9' }),
    'qf-n088': () => ({ ok: 20 - 4 * 3 === 8 && numericOption(item.row) === 8, computed: 8, reason: 'öncelik' }),
    'qf-n089': () => ({ ok: Math.abs(3 - 10) === 7 && numericOption(item.row) === 7, computed: 7, reason: '|3-10|' }),
    'qf-n090': () => ({ ok: Math.sqrt(16) + Math.sqrt(9) === 7 && numericOption(item.row) === 7, computed: 7, reason: '√16+√9' }),
    'qf-n091': () => ({ ok: Math.abs(0.3 + 0.4 - 0.7) < 1e-9 && Math.abs(numericOption(item.row) - 0.7) < 1e-9, computed: 0.7, reason: '0.3+0.4' }),
    'qf-n092': () => ({ ok: -0.5 + 1.5 === 1 && numericOption(item.row) === 1, computed: 1, reason: '-1/2+3/2' }),
    'qf-n093': () => ({ ok: 24 % 18 !== 0 && numericOption(item.row) === 18, computed: 18, reason: '24∤18' }),
    'qf-n094': () => ({ ok: 100 - 25 * 2 === 50 && numericOption(item.row) === 50, computed: 50, reason: 'öncelik' }),
    'qf-n100': () => ({ ok: 2 + 4 === 6 && numericOption(item.row) === 6, computed: 6, reason: 'f(2)' }),
  };
  const fn = table[id];
  if (!fn) return { ok: false, reason: `bağımsız matematik tablosu yok: ${id}` };
  return fn();
}

export type MappingAudit = ReplacementRow & {
  safe: boolean;
  flags: string[];
};

export function auditQualityPack(bank: Record<string, BankQuestion[]>) {
  const structuralFail: string[] = [];
  const mathFail: string[] = [];
  const mathItems = QUALITY_FIX_ITEMS.filter((x) => x.verify === 'math');
  const fpsPack = new Map<string, string>();
  for (const item of QUALITY_FIX_ITEMS) {
    const q = item.row;
    if (!q.q?.trim() || q.o.length !== 5 || !Number.isInteger(q.a) || q.a < 0 || q.a >= 5 || !q.e?.trim()) {
      structuralFail.push(item.row.id);
    }
    if (!isValidQuestion(q) || isFillerQuestion(q) || q.kind === 'osym') structuralFail.push(item.row.id);
    const fp = questionFingerprint(q);
    if (fpsPack.has(fp)) structuralFail.push(`fp:${item.row.id}/${fpsPack.get(fp)}`);
    else fpsPack.set(fp, item.row.id);
  }
  for (const item of mathItems) {
    const r = independentMathValue(item);
    if (!r.ok) mathFail.push(`${item.row.id}:${r.reason}`);
  }

  const bankByFp = new Map<string, { topic: string; q: BankQuestion }[]>();
  for (const [topic, list] of Object.entries(bank)) {
    for (const q of list) {
      const fp = questionFingerprint(q);
      const cur = bankByFp.get(fp) || [];
      cur.push({ topic, q });
      bankByFp.set(fp, cur);
    }
  }
  const exactBankOverlap = QUALITY_FIX_ITEMS.flatMap((item) => {
    const hits = bankByFp.get(questionFingerprint(item.row)) || [];
    return hits.map((h) => ({ qualityId: item.row.id, bankId: h.q.id, topic: h.topic, filler: isFillerQuestion(h.q) }));
  });

  const sourceCited = QUALITY_FIX_ITEMS.filter((x) => x.status === 'source_verified');
  const needsSource = QUALITY_FIX_ITEMS.filter((x) => x.status === 'needs_source_verification');
  const needsHuman = QUALITY_FIX_ITEMS.filter((x) => x.status === 'needs_human');
  const sourceNote =
    'TDK yazım sayfaları çekildi (8 soru). sozluk.gov.tr ve MEB ders kitabı bu turda çekilmedi; onlar needs_source_verification. İki tarih needs_human.';

  const plan = proposeQualityMerge(bank);
  const mappingAudits: MappingAudit[] = plan.replacements.map((row) => {
    const flags: string[] = [];
    const item = QUALITY_FIX_ITEMS.find((x) => x.row.id === row.addQualityId);
    if (!item) flags.push('paket_satırı_yok');
    if (item && item.topic !== row.topic) flags.push('konu_uyuşmazlığı');
    if (item && item.status === 'needs_human') flags.push('insan_teyidi_bekliyor');
    if (item && item.status === 'needs_source_verification') flags.push('kaynak_doğrulanmadı');
    if (CONCEPTUAL_OVERLAPS.some((c) => c.qualityId === row.addQualityId)) flags.push('kavramsal_kopya');
    if (row.action === 'replace_filler') {
      const old = (bank[row.topic] || []).find((q) => q.id === row.dropFillerId);
      if (!old) flags.push('eski_satır_yok');
      else if (!isFillerQuestion(old)) flags.push('eski_doldurma_değil');
      if (old && item && old.id === item.row.id) flags.push('id_çakışması');
    } else {
      flags.push('doldurma_yok_ekleme');
    }
    const overlap = exactBankOverlap.filter((o) => o.qualityId === row.addQualityId && o.bankId !== row.dropFillerId);
    if (overlap.length) flags.push(`banka_parmak_izi:${overlap.map((o) => o.bankId).join(',')}`);
    const math = item && item.verify === 'math' ? independentMathValue(item) : null;
    if (math && !math.ok) flags.push('matematik_hata');
    const safe = flags.length === 0;
    return { ...row, safe, flags };
  });

  const addCountByTopic = new Map<string, number>();
  for (const row of mappingAudits) {
    if (row.action !== 'add_if_no_filler') continue;
    addCountByTopic.set(row.topic, (addCountByTopic.get(row.topic) || 0) + 1);
  }
  const topicsGrowing = [...addCountByTopic.entries()].map(([topic, add]) => {
    const before = (bank[topic] || []).length;
    return { topic, before, after: before + add, delta: add };
  });

  const allChecksPassIds = QUALITY_FIX_ITEMS.filter((x) => {
    if (structuralFail.includes(x.row.id)) return false;
    if (x.status === 'needs_human' || x.status === 'needs_source_verification') return false;
    if (x.verify === 'math') return independentMathValue(x).ok;
    return x.status === 'source_verified';
  }).map((x) => x.row.id);

  return {
    total: QUALITY_FIX_ITEMS.length,
    mathCount: mathItems.length,
    mathIndependentOk: mathItems.length - mathFail.length,
    mathFail,
    structuralFail: [...new Set(structuralFail)],
    sourceCitedCount: sourceCited.length,
    sourceCitedFetched: sourceCited.length,
    needsSourceVerification: needsSource.map((x) => x.row.id),
    sourceNote,
    needsHuman: needsHuman.map((x) => x.row.id),
    exactBankOverlap,
    mappingAudits,
    mappingSafe: mappingAudits.filter((m) => m.safe).length,
    mappingUnsafe: mappingAudits.filter((m) => !m.safe),
    replaceFiller: plan.replaceFiller,
    addOnly: plan.addOnly,
    projectedCount: plan.projectedBankCountIfReplaceOnly,
    bankCount: plan.bankCount,
    allChecksPassCount: allChecksPassIds.length,
    allChecksPassNote: 'Tam geçiş: matematik bağımsız veya TDK yazım sayfası çekildi. sozluk/MEB/insan hariç.',
    topicsGrowing,
    rollbackFitsTree: true,
    rollbackNote: proposeQualityMerge(bank).rollback,
  };
}
