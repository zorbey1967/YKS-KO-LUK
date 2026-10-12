import type { AppData, MistakeEntry, MistakeReason } from './types';
import { enqueueReview, markReviewResult } from './spacedReview';

export const MISTAKE_REASONS: { id: MistakeReason; label: string }[] = [
  { id: 'bilgi', label: 'Bilgi eksiği' },
  { id: 'islem', label: 'İşlem hatası' },
  { id: 'sure', label: 'Süre' },
  { id: 'dikkatsizlik', label: 'Dikkatsizlik' },
];

export type QuizResultInput = {
  questionId: string;
  correct: boolean;
  subject: string;
  topic: string;
  level?: string;
  at?: string;
  reason?: MistakeReason | '';
};

/** Soru istatistiğini artırmaz; banka zaten questionStats yazar. Aynı soru id’si çoğalmaz. */
export function applyQuizResult(data: AppData, input: QuizResultInput): AppData {
  const qid = String(input.questionId || '').trim();
  if (!qid) return data;
  const at = input.at || new Date().toISOString();
  const existing = data.mistakes.find((m) => m.questionId === qid || m.id === qid);
  if (input.correct) {
    if (!existing) return data;
    const nextMistake: MistakeEntry = {
      ...existing,
      lastCorrectAt: at,
      status: existing.wrongCount <= 1 ? 'resolved' : 'reviewing',
    };
    const mistakes = data.mistakes.map((m) => (m.id === existing.id ? nextMistake : m));
    return markReviewResult({ ...data, mistakes }, {
      id: reviewIdForQuestion(qid),
      correct: true,
      at,
      subject: existing.subject,
      topic: existing.topic,
      level: existing.level,
      questionId: qid,
    });
  }
  const row: MistakeEntry = existing
    ? {
      ...existing,
      subject: input.subject || existing.subject,
      topic: input.topic || existing.topic,
      level: input.level || existing.level,
      reason: input.reason !== undefined ? input.reason : existing.reason,
      wrongCount: existing.wrongCount + 1,
      lastWrongAt: at,
      status: 'open',
    }
    : {
      id: qid,
      questionId: qid,
      subject: input.subject,
      topic: input.topic,
      level: input.level,
      reason: input.reason || '',
      wrongCount: 1,
      lastWrongAt: at,
      status: 'open',
    };
  const mistakes = existing
    ? data.mistakes.map((m) => (m.id === existing.id ? row : m))
    : [...data.mistakes, row];
  return enqueueReview({ ...data, mistakes }, {
    kind: 'mistake',
    questionId: qid,
    subject: row.subject,
    topic: row.topic,
    level: row.level,
    at,
    resetInterval: true,
  });
}

export function setMistakeReason(data: AppData, questionId: string, reason: MistakeReason | ''): AppData {
  return {
    ...data,
    mistakes: data.mistakes.map((m) => (m.questionId === questionId || m.id === questionId ? { ...m, reason } : m)),
  };
}

export function openMistakes(data: AppData): MistakeEntry[] {
  return data.mistakes.filter((m) => m.status !== 'resolved').sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));
}

export function reviewIdForQuestion(questionId: string) {
  return `q:${questionId}`;
}

export function reviewIdForTopic(level: string, subject: string, topic: string) {
  return `t:${level}|${subject}|${topic}`;
}
