import type { AppData } from './types';
import { parseBankKey } from './practice';

/** 0 bilinmiyor … 5 ileri. Yetersiz denemede null. */
export type MasteryRow = {
  topic: string;
  subject: string;
  levelName: string;
  attempts: number;
  correct: number;
  incorrect: number;
  lastSeen: string;
  mastery: number | null;
  enough: boolean;
};

const MIN_ATTEMPTS = 8;

export function masteryFromAccuracy(answered: number, correct: number): number | null {
  if (answered < MIN_ATTEMPTS) return null;
  const acc = correct / answered;
  if (acc < 0.35) return 1;
  if (acc < 0.5) return 2;
  if (acc < 0.7) return 3;
  if (acc < 0.85) return 4;
  return 5;
}

export function topicMastery(data: AppData, topicHint = ''): MasteryRow[] {
  const hint = topicHint.toLocaleLowerCase('tr-TR');
  const rows: MasteryRow[] = [];
  for (const m of Object.values(data.qb || {})) {
    const p = parseBankKey(m.key);
    if (!p.topic) continue;
    if (hint && !`${p.topic} ${p.subject}`.toLocaleLowerCase('tr-TR').includes(hint)) continue;
    const mastery = masteryFromAccuracy(m.answered, m.correct);
    rows.push({
      topic: p.topic,
      subject: p.subject,
      levelName: p.level,
      attempts: m.answered,
      correct: m.correct,
      incorrect: m.wrong,
      lastSeen: m.updatedAt || '',
      mastery,
      enough: mastery != null,
    });
  }
  rows.sort((a, b) => b.attempts - a.attempts);
  return rows.slice(0, 8);
}

export function masteryLine(row: MasteryRow) {
  if (!row.enough) {
    return `${row.subject} / ${row.topic}: ${row.attempts} deneme — bu konu hakkında henüz yeterli veri yok.`;
  }
  return `${row.subject} / ${row.topic}: seviye ${row.mastery}/5 (${row.correct}/${row.attempts} doğru).`;
}
