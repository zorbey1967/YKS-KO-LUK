import type { CatalogExam } from '../data/examCatalog';
import { tytNet } from './weekPlan';

export type Mark = 0 | 1 | 2 | 3 | 4 | null;

export function scoreCatalogExam(exam: CatalogExam, marks: Mark[]) {
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  const byTopic: Record<string, { correct: number; wrong: number; blank: number }> = {};
  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    const key = `${q.subject}|${q.topic}`;
    const bucket = byTopic[key] || { correct: 0, wrong: 0, blank: 0 };
    const m = marks[i];
    if (m == null) {
      blank += 1;
      bucket.blank += 1;
    } else if (m === q.answer) {
      correct += 1;
      bucket.correct += 1;
    } else {
      wrong += 1;
      bucket.wrong += 1;
    }
    byTopic[key] = bucket;
  }
  const net = exam.kind === 'TYT' || exam.kind === 'AYT' || exam.kind === 'LGS' || exam.kind === 'KPSS'
    ? tytNet(correct, wrong)
    : correct;
  const weak = Object.entries(byTopic)
    .map(([k, v]) => ({ topic: k, ...v, acc: v.correct + v.wrong + v.blank ? v.correct / (v.correct + v.wrong + v.blank) : 0 }))
    .filter((x) => x.wrong + x.blank > 0)
    .sort((a, b) => a.acc - b.acc);
  return { correct, wrong, blank, net, byTopic, weak, verifiedKey: true as const };
}
