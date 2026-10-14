import type { BankQuestion } from './types';

export function curriculumTopicKeys(curriculum: Record<string, Record<string, string[]>>) {
  const keys: string[] = [];
  for (const [level, subjects] of Object.entries(curriculum)) {
    for (const [subject, topics] of Object.entries(subjects)) {
      for (const topic of topics) keys.push(`${level}|${subject}|${topic}`);
    }
  }
  return keys;
}

export function isFillerQuestion(row: BankQuestion) {
  return / — .+ \(\d+\)\s*$/.test(row.q) || /seçenek \d/i.test((row.o || []).join(' '));
}

/** `kind=osym` doğrulanmış ÖSYM sorusu değildir; şablon ve derleme de bu etiketi kullanır. */
export function isOsymLabelNotVerifiedExam(row: BankQuestion) {
  return row.kind === 'osym';
}

export type CoverageRow = {
  key: string;
  level: string;
  subject: string;
  topic: string;
  count: number;
  /** Doldurma olmayan veya original/bilgi/osym etiketli. osym kanıtı değildir. */
  original: number;
  osymLabel: number;
  filler: number;
};

export function bankCoverage(
  curriculum: Record<string, Record<string, string[]>>,
  bank: Record<string, BankQuestion[]>,
): CoverageRow[] {
  return curriculumTopicKeys(curriculum).map((key) => {
    const [level, subject, topic] = key.split('|');
    const list = bank[key] || [];
    return {
      key,
      level,
      subject,
      topic,
      count: list.length,
      original: list.filter((q) => q.kind === 'original' || q.kind === 'bilgi' || q.kind === 'osym' || !isFillerQuestion(q)).length,
      osymLabel: list.filter(isOsymLabelNotVerifiedExam).length,
      filler: list.filter(isFillerQuestion).length,
    };
  });
}

export function coverageSummary(rows: CoverageRow[]) {
  const missing = rows.filter((r) => r.count === 0).length;
  const thin = rows.filter((r) => r.count > 0 && r.count < 12).length;
  const byLevel: Record<string, { topics: number; questions: number; missing: number }> = {};
  for (const r of rows) {
    const cur = byLevel[r.level] || { topics: 0, questions: 0, missing: 0 };
    cur.topics += 1;
    cur.questions += r.count;
    if (r.count === 0) cur.missing += 1;
    byLevel[r.level] = cur;
  }
  return { topics: rows.length, missing, thin, byLevel };
}
