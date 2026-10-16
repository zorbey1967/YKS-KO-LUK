import type { AppData } from './types';
import { addDays } from './spacedReview';
import { dueReviews } from './spacedReview';
import { weakBankTopics } from './practice';
import { formatMinutes, getStudentProgress } from './studentProgress';

export type CoachStudyBrief = {
  todayMinutes: number | null;
  weekMinutes: number | null;
  sessionCountToday: number;
  sessionCountWeek: number;
  tasksOpen: number;
  tasksDone: number;
  tasksOverdue: number;
  openTitles: string[];
  overdueTitles: string[];
  dueReviews: { subject: string; topic: string; dueDate: string }[];
  weakTopics: { subject: string; topic: string; wrong: number; answered: number }[];
  exams: { name: string; date: string; tyt: number; ayt: number }[];
  examDelta: { tyt: number | null; ayt: number | null };
  difficulties: { subject: string; difficulty: string; date: string }[];
  notes: { topic: string; note: string; at: string }[];
  agenda: string[];
  empty: boolean;
  todayTimer: number | null;
  todayLibrary: number | null;
  weekLibrary: number | null;
  topicRate: number | null;
  dept: string;
  narrative: string;
  topicLines: string[];
  monthLibrary: number | null;
  monthTimer: number | null;
  monthTotal: number | null;
};

export function coachStudyBrief(data: AppData, today: string): CoachStudyBrief {
  const weekFrom = addDays(today, -6);
  const todayS = data.sessions.filter((s) => s.date === today);
  const weekS = data.sessions.filter((s) => s.date >= weekFrom && s.date <= today);
  const hasSessions = data.sessions.length > 0;
  const open = data.tasks.filter((t) => !t.done);
  const done = data.tasks.filter((t) => t.done);
  const overdue = open.filter((t) => t.date && t.date < today);
  const due = dueReviews(data, today).map((r) => ({ subject: r.subject, topic: r.topic, dueDate: r.dueDate }));
  const weak = weakBankTopics(data, 5).map((w) => ({ subject: w.subject, topic: w.topic, wrong: w.wrong, answered: w.answered }));
  const exams = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    .map((e) => ({ name: e.name, date: e.date, tyt: e.tyt, ayt: e.ayt }));
  const examDelta = {
    tyt: exams.length >= 2 ? exams[0].tyt - exams[1].tyt : null,
    ayt: exams.length >= 2 ? exams[0].ayt - exams[1].ayt : null,
  };
  const difficulties = data.sessions
    .filter((s) => s.difficulty)
    .slice(-8)
    .map((s) => ({ subject: s.subject, difficulty: String(s.difficulty), date: s.date }));
  const notes = data.learningNotes.slice(0, 8).map((n) => ({ topic: n.topic, note: n.note, at: n.at }));
  const agenda: string[] = [];
  if (due[0]) agenda.push(`Tekrar: ${due[0].topic}`);
  if (overdue[0]) agenda.push(`Geciken görev: ${overdue[0].title}`);
  if (weak[0]) agenda.push(`Banka: ${weak[0].topic} (${weak[0].wrong} yanlış kaydı)`);
  if (difficulties[0]) agenda.push(`Öğrenci zorluk belirtti: ${difficulties[0].subject} / ${difficulties[0].difficulty}`);
  if (notes[0]) agenda.push(`Not: ${notes[0].topic}`);
  const empty = !hasSessions && open.length === 0 && due.length === 0 && weak.length === 0 && exams.length === 0 && notes.length === 0;
  const progress = getStudentProgress(data);
  const taskPct = data.tasks.length ? Math.round((done.length / data.tasks.length) * 100) : null;
  const narrative = [
    progress.capacity.weekMinutes ? `Bu hafta ${formatMinutes(progress.capacity.weekMinutes)} çalıştı.` : '',
    progress.capacity.weekLibrary ? `Sessiz Kütüphane: ${formatMinutes(progress.capacity.weekLibrary)}.` : '',
    taskPct != null ? `Görev tamamlama: %${taskPct}.` : '',
    progress.lastExam?.delta != null ? `Son deneme: ${progress.lastExam.delta > 0 ? '+' : ''}${progress.lastExam.delta} net.` : '',
    progress.insights.strengths[0] ? `En çok gelişen ders: ${progress.insights.strengths[0]}.` : '',
    progress.gaps[0] ? `Öncelikli eksik: ${progress.gaps[0].subject} / ${progress.gaps[0].name}.` : '',
  ].filter(Boolean).join(' ');
  return {
    todayMinutes: hasSessions ? todayS.reduce((a, s) => a + s.minutes, 0) : null,
    weekMinutes: hasSessions ? weekS.reduce((a, s) => a + s.minutes, 0) : null,
    todayTimer: progress.capacity.todayTimer || null,
    todayLibrary: progress.capacity.todayLibrary || null,
    weekLibrary: progress.capacity.weekLibrary || null,
    topicRate: data.grade ? progress.topicRate : null,
    dept: progress.dept,
    narrative,
    monthLibrary: progress.capacity.monthLibrary || null,
    monthTimer: progress.capacity.monthTimer || null,
    monthTotal: progress.capacity.monthTotal || null,
    topicLines: progress.subjects.slice(0, 6).map((c) => (
      `${c.subject}: 🟢 ${c.done} · 🟡 ${c.inProgress} · ⚪ ${c.notStarted}`
    )),
    sessionCountToday: todayS.length,
    sessionCountWeek: weekS.length,
    tasksOpen: open.length,
    tasksDone: done.length,
    tasksOverdue: overdue.length,
    openTitles: open.slice(0, 8).map((t) => t.title),
    overdueTitles: overdue.slice(0, 8).map((t) => t.title),
    dueReviews: due.slice(0, 8),
    weakTopics: weak,
    exams,
    examDelta,
    difficulties,
    notes,
    agenda: agenda.slice(0, 6),
    empty,
  };
}
