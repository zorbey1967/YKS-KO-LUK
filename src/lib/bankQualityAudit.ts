import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';

export type AuditRow = {
  id: string;
  topic: string;
  kind: string;
  optionCount: number;
  answerIndexOk: boolean;
  filler: boolean;
  dupGroupSize: number;
  stemPrefix: string;
  suspicion: string;
  auto: string;
  needsHuman: boolean;
};

export function flattenBank(bank: Record<string, BankQuestion[]>) {
  return Object.entries(bank).flatMap(([topic, list]) => list.map((q) => ({ topic, q })));
}

export function fingerprintGroups(rows: { topic: string; q: BankQuestion }[]) {
  const map = new Map<string, { topic: string; q: BankQuestion }[]>();
  for (const row of rows) {
    const fp = questionFingerprint(row.q);
    const cur = map.get(fp) || [];
    cur.push(row);
    map.set(fp, cur);
  }
  return map;
}

export function auditOne(row: { topic: string; q: BankQuestion }, dupGroupSize: number): AuditRow {
  const q = row.q;
  const filler = isFillerQuestion(q);
  const valid = isValidQuestion(q);
  const optionCount = Array.isArray(q.o) ? q.o.length : 0;
  const answerIndexOk = Number.isInteger(q.a) && q.a >= 0 && q.a < optionCount;
  const reasons: string[] = [];
  if (filler) reasons.push('şablon/doldurma metni');
  if (dupGroupSize > 1) reasons.push(`aynı parmak izi ${dupGroupSize} konuda`);
  if (!valid) reasons.push('yapı geçersiz');
  if (optionCount !== 5) reasons.push(`seçenek sayısı ${optionCount}`);
  if (!answerIndexOk) reasons.push('cevap indeksi geçersiz');
  if (q.kind === 'original' || q.kind === 'osym' || q.kind === 'bilgi') {
    reasons.push('ÖSYM tarzı otomatik doğrulanamaz; kind=osym sınav arşivi kanıtı değil');
  }
  const suspicion = reasons.join('; ') || 'otomatik yapı tamam';
  return {
    id: q.id,
    topic: row.topic,
    kind: String(q.kind || ''),
    optionCount,
    answerIndexOk,
    filler,
    dupGroupSize,
    stemPrefix: String(q.q || '').replace(/\s+/g, ' ').trim().slice(0, 72),
    suspicion,
    auto: valid && answerIndexOk ? 'yapı OK (içerik kanıtı yok)' : 'yapı HATA',
    needsHuman: true,
  };
}

/** Konu çeşitliliğiyle en az 20 örnek; bankayı değiştirmez. */
export function pickAuditSample(bank: Record<string, BankQuestion[]>, n = 20): AuditRow[] {
  const rows = flattenBank(bank);
  const groups = fingerprintGroups(rows);
  const sizeOf = (q: BankQuestion) => groups.get(questionFingerprint(q))?.length || 1;
  const scored = rows.map((r) => auditOne(r, sizeOf(r.q)));
  const picked: AuditRow[] = [];
  const seenTopic = new Set<string>();
  const fillers = scored.filter((r) => r.filler);
  const dups = scored.filter((r) => r.dupGroupSize > 1 && !r.filler);
  const authored = scored.filter((r) => !r.filler && (r.kind === 'original' || r.kind === 'osym' || r.kind === 'bilgi'));
  const rest = scored.filter((r) => !r.filler && r.dupGroupSize === 1 && r.kind !== 'original' && r.kind !== 'osym' && r.kind !== 'bilgi');
  const quotas: { list: AuditRow[]; max: number }[] = [
    { list: fillers, max: 6 },
    { list: dups, max: 6 },
    { list: authored, max: 6 },
    { list: rest, max: 4 },
  ];
  for (const { list, max } of quotas) {
    let took = 0;
    for (const r of list) {
      if (picked.length >= n || took >= max) break;
      if (picked.some((p) => p.id === r.id)) continue;
      if (seenTopic.has(r.topic)) continue;
      picked.push(r);
      seenTopic.add(r.topic);
      took += 1;
    }
  }
  for (const r of scored) {
    if (picked.length >= n) break;
    if (picked.some((p) => p.id === r.id)) continue;
    picked.push(r);
  }
  return picked.slice(0, n);
}

export function auditSummary(bank: Record<string, BankQuestion[]>) {
  const rows = flattenBank(bank);
  const groups = fingerprintGroups(rows);
  let filler = 0;
  let invalid = 0;
  let notFive = 0;
  for (const r of rows) {
    if (isFillerQuestion(r.q)) filler += 1;
    if (!isValidQuestion(r.q)) invalid += 1;
    if ((r.q.o || []).length !== 5) notFive += 1;
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1).length;
  return {
    questions: rows.length,
    filler,
    invalid,
    notFiveOptions: notFive,
    dupFingerprintGroups: dupGroups,
  };
}

/** Aynı parmak izinin birden fazla müfredat anahtarında görünmesi (ana bankayı değiştirmez). */
export function crossTopicDupExamples(bank: Record<string, BankQuestion[]>, limit = 8) {
  const groups = [...fingerprintGroups(flattenBank(bank)).values()]
    .filter((g) => new Set(g.map((x) => x.topic)).size > 1)
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
  return groups.map((g) => ({
    size: g.length,
    topics: [...new Set(g.map((x) => x.topic))],
    ids: g.map((x) => x.q.id),
    filler: g.every((x) => isFillerQuestion(x.q)),
    stemPrefix: String(g[0]?.q.q || '').replace(/\s+/g, ' ').trim().slice(0, 72),
  }));
}
