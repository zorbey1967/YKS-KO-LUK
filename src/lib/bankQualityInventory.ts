import type { BankQuestion } from './types';
import { isFillerQuestion, isOsymLabelNotVerifiedExam } from './bankCoverage';
import { questionFingerprint } from '../data/bankDedupe';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { auditQualityPack, independentMathValue } from './bankQualityGateAudit';
import { CONCEPTUAL_OVERLAPS } from './bankQualitySourceAudit';

const TARGET_NON_FILLER_PER_TOPIC = 12;

export function fillerInventory(bank: Record<string, BankQuestion[]>) {
  const rows = Object.entries(bank).flatMap(([topic, list]) => list.map((q) => ({ topic, q })));
  const fillerRows = rows.filter((r) => isFillerQuestion(r.q));
  const byLevel: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const byTopic: Record<string, { total: number; filler: number; nonFiller: number; osymLabel: number; dupGroups: number }> = {};
  const fpByTopic = new Map<string, Map<string, number>>();

  for (const { topic, q } of rows) {
    const [level, subject] = topic.split('|');
    const cur = byTopic[topic] || { total: 0, filler: 0, nonFiller: 0, osymLabel: 0, dupGroups: 0 };
    cur.total += 1;
    if (isFillerQuestion(q)) {
      cur.filler += 1;
      byLevel[level] = (byLevel[level] || 0) + 1;
      bySubject[subject] = (bySubject[subject] || 0) + 1;
    } else cur.nonFiller += 1;
    if (isOsymLabelNotVerifiedExam(q)) cur.osymLabel += 1;
    byTopic[topic] = cur;
    const fps = fpByTopic.get(topic) || new Map<string, number>();
    const fp = questionFingerprint(q);
    fps.set(fp, (fps.get(fp) || 0) + 1);
    fpByTopic.set(topic, fps);
  }
  for (const [topic, fps] of fpByTopic) {
    byTopic[topic].dupGroups = [...fps.values()].filter((n) => n > 1).length;
  }

  const top20 = Object.entries(byTopic)
    .map(([topic, s]) => ({
      topic,
      ...s,
      neededFor12NonFiller: Math.max(0, TARGET_NON_FILLER_PER_TOPIC - s.nonFiller),
    }))
    .sort((a, b) => b.filler - a.filler || b.dupGroups - a.dupGroups)
    .slice(0, 20);

  return {
    questions: rows.length,
    filler: fillerRows.length,
    nonFiller: rows.length - fillerRows.length,
    osymLabel: rows.filter((r) => isOsymLabelNotVerifiedExam(r.q)).length,
    osymNote: 'kind=osym doğrulanmış ÖSYM maddesi değildir.',
    byLevel,
    bySubject,
    top20,
    targetNonFillerPerTopic: TARGET_NON_FILLER_PER_TOPIC,
  };
}

export function mathSkillClusters() {
  const math = QUALITY_FIX_ITEMS.filter((x) => x.verify === 'math');
  const byTopic = new Map<string, string[]>();
  for (const item of math) {
    const ids = byTopic.get(item.topic) || [];
    ids.push(item.row.id);
    byTopic.set(item.topic, ids);
  }
  return [...byTopic.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([topic, ids]) => ({ topic, ids, sameKazanımCluster: true }));
}

export function reauditGateSafeMappings(bank: Record<string, BankQuestion[]>) {
  const audit = auditQualityPack(bank);
  const gateSafe = audit.mappingAudits.filter((m) => m.safe);
  const clusters = new Map(mathSkillClusters().map((c) => [c.topic, c.ids]));
  const detail = gateSafe.map((row) => {
    const flags: string[] = [];
    const item = QUALITY_FIX_ITEMS.find((x) => x.row.id === row.addQualityId);
    const drop = (bank[row.topic] || []).find((q) => q.id === row.dropFillerId);
    if (!item) flags.push('paket_satırı_yok');
    else if (item.topic !== row.topic) flags.push('konu_uyuşmazlığı');
    if (row.action !== 'replace_filler' || !row.dropFillerId) flags.push('doldurma_yok');
    if (!drop) flags.push('eski_satır_yok');
    else if (!isFillerQuestion(drop)) flags.push('eski_doldurma_değil');
    if (item?.verify === 'math') {
      const m = independentMathValue(item);
      if (!m.ok) flags.push('cevap_doğrulanmadı');
    } else if (item?.status !== 'source_verified') flags.push('kaynak_eksik');
    if (CONCEPTUAL_OVERLAPS.some((c) => c.qualityId === row.addQualityId)) flags.push('kavramsal_kopya');
    const packCluster = clusters.get(row.topic);
    if (packCluster && packCluster.length > 1) flags.push(`paket_aynı_kazanım:${packCluster.length}`);
    const nonFillers = (bank[row.topic] || []).filter((q) => !isFillerQuestion(q));
    const stem = String(item?.row.q || '').toLowerCase();
    const near = nonFillers.filter((q) => {
      const t = String(q.q || '').toLowerCase();
      if (!stem || !t) return false;
      if (item?.verify === 'math') {
        return /işleminin sonucu|kaçtır/.test(stem) && /işleminin sonucu|kaçtır/.test(t);
      }
      const keys = stem.split(/[^a-zA-ZçğıöşüÇĞİÖŞÜ0-9]+/).filter((w) => w.length > 4).slice(0, 4);
      return keys.length >= 2 && keys.filter((k) => t.includes(k)).length >= 2;
    }).slice(0, 4);
    if (near.length) {
      flags.push(
        item?.verify === 'math'
          ? `banka_aynı_işlem_kalıbı:${near.map((q) => q.id).join(',')}`
          : `banka_yazar_yakın:${near.map((q) => q.id).join(',')}`,
      );
    }
    const blocking = flags.filter(
      (f) => !f.startsWith('paket_aynı_kazanım:') && !f.startsWith('banka_aynı_işlem_kalıbı:'),
    );
    return {
      addQualityId: row.addQualityId,
      topic: row.topic,
      dropFillerId: row.dropFillerId,
      verify: item?.verify,
      flags,
      stillSafe: blocking.length === 0,
    };
  });
  return {
    gateSafe: gateSafe.length,
    gateUnsafe: audit.mappingUnsafe.length,
    stillSafe: detail.filter((d) => d.stillSafe).length,
    stillSafeDropped: detail.filter((d) => !d.stillSafe),
    sameSkillClusters: mathSkillClusters(),
    mathReplaceOk: detail.filter((d) => d.verify === 'math' && d.stillSafe).length,
    sourceReplaceOk: detail.filter((d) => d.verify !== 'math' && d.stillSafe).length,
  };
}

export const STAGED_QUALITY_PLAN = {
  generateFillerQuestions: false,
  applyUnsafeMappings: false,
  mergeThisTurn: false,
  phases: [
    {
      id: 1,
      name: 'Onaylı güvenli değiştirme',
      topics: '70 matematik + 13 kaynak doğrulamalı doldurma değiştirme',
      estimate: 83,
      gate: 'Sahip onayı; pack.json yedeği + SHA; BANK yazımı yok bu turda.',
    },
    {
      id: 2,
      name: 'Kaynak kuyruğu',
      topics: '34 needs_source_verification + 2 needs_human (İpek Yolu, Misak-ı Millî)',
      estimate: 36,
      gate: 'Resmî metin doğru şıkkı yazmadan source_verified yok; çelişenler (basınç formülü, diş sıklığı, sınıf kayması) üretilmez.',
    },
    {
      id: 3,
      name: 'En yoğun doldurma konuları',
      topics: 'fillerInventory.top20; hedef konu başı 12 doldurma-olmayan, sayı için üretim yok',
      estimate: 'top20.neededFor12NonFiller toplamı (hesap; üretim yok)',
      gate: 'kind=osym kanıt sayılmaz. Kavramsal kopya eklenmez.',
    },
  ],
} as const;
