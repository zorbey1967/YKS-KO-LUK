import type { AppData } from './types';
import type { StudyKind } from './studyTimer';
import { dueReviews } from './spacedReview';
import { openMistakes } from './mistakeBook';
import { weakBankTopics } from './practice';
import { eliteReport } from './elite';

export type SuggestEvidence = { kind: string; id: string; label: string };

export type StudySuggestion = {
  subject: string;
  topic: string;
  kind: StudyKind | 'onboard';
  minutes: number;
  reason: string;
  evidence: SuggestEvidence[];
  action: 'timer' | 'bank' | 'onboard';
  level?: string;
  questionId?: string;
  taskId?: string;
  reviewId?: string;
};

function dailyMin(data: AppData) {
  const n = eliteReport(data).dailyMin;
  return Math.min(50, Math.max(20, n));
}

export function nextStudySuggestion(data: AppData, today: string): StudySuggestion {
  const minutes = dailyMin(data);
  const due = dueReviews(data, today);
  if (due[0]) {
    const r = due[0];
    return {
      subject: r.subject,
      topic: r.topic,
      kind: 'review',
      minutes: Math.min(25, minutes),
      reason: 'Bu konu için tekrar zamanın geldi.',
      evidence: [{ kind: 'review', id: r.id, label: `Tekrar ${r.dueDate}` }],
      action: r.questionId ? 'bank' : 'timer',
      level: r.level,
      questionId: r.questionId,
      reviewId: r.id,
    };
  }
  const overdue = data.tasks.filter((t) => !t.done && t.date && t.date < today);
  if (overdue[0]) {
    const t = overdue[0];
    return {
      subject: t.subject || 'Odak',
      topic: t.title,
      kind: 'custom',
      minutes: t.minutes || minutes,
      reason: 'Planındaki görev gecikti.',
      evidence: [{ kind: 'task', id: t.id, label: `${t.date} • ${t.title}` }],
      action: 'timer',
      taskId: t.id,
    };
  }
  const miss = openMistakes(data)[0];
  if (miss) {
    return {
      subject: miss.subject,
      topic: miss.topic,
      kind: 'questions',
      minutes: 20,
      reason: 'Kayıtlı yanlışın var; aynı soruyu çoğaltmadan tekrar çöz.',
      evidence: [{ kind: 'mistake', id: miss.id, label: `${miss.wrongCount} yanlış` }],
      action: 'bank',
      level: miss.level,
      questionId: miss.questionId,
    };
  }
  const weak = weakBankTopics(data, 1)[0];
  if (weak) {
    return {
      subject: weak.subject,
      topic: weak.topic,
      kind: 'questions',
      minutes: 25,
      reason: 'Bu konuda yanlış cevapların var.',
      evidence: [{ kind: 'qb', id: weak.key, label: `${weak.wrong} yanlış • %${weak.acc}` }],
      action: 'bank',
      level: weak.levelName,
    };
  }
  const calc = data.calcs[0];
  const weakSub = calc?.subjects?.length
    ? calc.subjects.slice().sort((a, b) => a.net - b.net)[0]
    : null;
  if (weakSub && (weakSub.wrong > 0 || weakSub.net < 8)) {
    return {
      subject: weakSub.subject,
      topic: '',
      kind: 'questions',
      minutes: 30,
      reason: 'Son net kaydında bu ders düşük.',
      evidence: [{ kind: 'calc', id: String(calc!.id), label: `${weakSub.subject} net ${weakSub.net}` }],
      action: 'bank',
    };
  }
  const todayTask = data.tasks.find((t) => !t.done && t.date === today);
  if (todayTask) {
    return {
      subject: todayTask.subject || 'Odak',
      topic: todayTask.title,
      kind: 'free',
      minutes: todayTask.minutes || minutes,
      reason: 'Bugünkü görev sırada.',
      evidence: [{ kind: 'task', id: todayTask.id, label: todayTask.title }],
      action: 'timer',
      taskId: todayTask.id,
    };
  }
  return {
    subject: '',
    topic: '',
    kind: 'onboard',
    minutes: 10,
    reason: 'Henüz öneri üretecek kayıt yok. Kısa bir konu seç veya 10 soruluk set çöz.',
    evidence: [],
    action: 'onboard',
  };
}
