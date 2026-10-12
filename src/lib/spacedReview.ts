import type { AppData, ReviewItem } from './types';
import { localDateKey } from './util';

/** Varsayılan aralıklar (gün). Öğrenciye özel “ideal” iddiası yok. */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14] as const;

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return localDateKey(dt);
}

export function dueReviews(data: AppData, today: string): ReviewItem[] {
  return data.reviews.filter((r) => isDue(r, today));
}

export function isDue(r: ReviewItem, today: string): boolean {
  if (r.status === 'done') return false;
  if (r.status === 'snoozed' && r.snoozeUntil && r.snoozeUntil > today) return false;
  return r.dueDate <= today;
}

export function enqueueReview(data: AppData, input: {
  kind: ReviewItem['kind'];
  questionId?: string;
  subject: string;
  topic: string;
  level?: string;
  at?: string;
  resetInterval?: boolean;
}): AppData {
  const id = input.questionId ? `q:${input.questionId}` : `t:${input.level || ''}|${input.subject}|${input.topic}`;
  const today = localDateKey(input.at ? new Date(input.at) : new Date());
  const existing = data.reviews.find((r) => r.id === id);
  if (existing) {
    const next: ReviewItem = {
      ...existing,
      status: 'due',
      dueDate: input.resetInterval ? addDays(today, REVIEW_INTERVAL_DAYS[0]) : existing.dueDate,
      intervalIndex: input.resetInterval ? 0 : existing.intervalIndex,
      lastResult: input.resetInterval ? 'wrong' : existing.lastResult,
      snoozeUntil: undefined,
      subject: input.subject || existing.subject,
      topic: input.topic || existing.topic,
      level: input.level || existing.level,
    };
    return { ...data, reviews: data.reviews.map((r) => (r.id === id ? next : r)) };
  }
  const row: ReviewItem = {
    id,
    kind: input.kind,
    questionId: input.questionId,
    subject: input.subject,
    topic: input.topic,
    level: input.level,
    intervalIndex: 0,
    dueDate: addDays(today, REVIEW_INTERVAL_DAYS[0]),
    status: 'due',
    lastResult: 'wrong',
  };
  return { ...data, reviews: [...data.reviews, row] };
}

export function markReviewResult(data: AppData, input: {
  id: string;
  correct: boolean;
  at?: string;
  subject: string;
  topic: string;
  level?: string;
  questionId?: string;
}): AppData {
  const today = localDateKey(input.at ? new Date(input.at) : new Date());
  const existing = data.reviews.find((r) => r.id === input.id);
  if (!input.correct) {
    return enqueueReview(data, {
      kind: existing?.kind || (input.questionId ? 'mistake' : 'topic'),
      questionId: input.questionId || existing?.questionId,
      subject: input.subject,
      topic: input.topic,
      level: input.level,
      at: input.at,
      resetInterval: true,
    });
  }
  if (!existing) return data;
  const nextIndex = Math.min(REVIEW_INTERVAL_DAYS.length - 1, existing.intervalIndex + 1);
  const finished = existing.intervalIndex >= REVIEW_INTERVAL_DAYS.length - 1;
  const next: ReviewItem = {
    ...existing,
    intervalIndex: nextIndex,
    dueDate: addDays(today, REVIEW_INTERVAL_DAYS[nextIndex]),
    status: finished ? 'done' : 'waiting',
    lastResult: 'correct',
    completedOnce: true,
    snoozeUntil: undefined,
  };
  return { ...data, reviews: data.reviews.map((r) => (r.id === input.id ? next : r)) };
}

export function snoozeReview(data: AppData, id: string, today: string, days = 1): AppData {
  return {
    ...data,
    reviews: data.reviews.map((r) => (r.id === id ? {
      ...r,
      status: 'snoozed' as const,
      snoozeUntil: addDays(today, days),
      dueDate: addDays(today, days),
    } : r)),
  };
}

/** Ustalığı tekrar geçmişinden üretmez; qb cevap yoksa null. */
export function topicMastery(data: AppData, topicKey: string): { answered: number; acc: number } | null {
  const row = data.qb[topicKey];
  if (!row || row.answered <= 0) return null;
  return { answered: row.answered, acc: Math.round((row.correct / row.answered) * 100) };
}
