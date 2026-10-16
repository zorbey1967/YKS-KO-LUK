import type { AppData, ExamTarget, PlanBlock, Schedule, Session, Topic } from './types';
import { emptySchedule } from './types';
import { curriculumForStudent } from './curriculum';
import { academicPeriodLabel, aytFieldHint, getStudentEducationContext } from './studentEducation';
import { generatePlan, iconForTopic } from './coach';
import { weekdayName, weekdayNameIstanbul, weekGoalPct } from './insights';
import { calendarDaysUntil, istanbulDateKey } from './countdown';
import { buildAnalyticsBoard } from './studentAnalytics';
import { uid } from './util';

export type TopicStatus = 'done' | 'in_progress' | 'not_started';

export type TopicView = {
  name: string;
  subject: string;
  grade: string;
  level: number;
  status: TopicStatus;
  source: 'manual' | 'inferred' | 'curriculum';
  studyMinutes: number;
  lastStudy: string;
};

export type SubjectCard = {
  subject: string;
  progress: number;
  done: number;
  inProgress: number;
  notStarted: number;
  topics: TopicView[];
};

export type StudyDay = { date: string; day: string; minutes: number };

export type StudyCapacity = {
  typicalDayMinutes: number;
  todayTimer: number;
  todayLibrary: number;
  todaySchedule: number;
  todayTotal: number;
  weekMinutes: number;
  weekLibrary: number;
  weekTimer: number;
  monthTimer: number;
  monthLibrary: number;
  monthTotal: number;
  weekTrend: StudyDay[];
};

export type PlanChangeProposal = {
  needed: boolean;
  reason: string;
  subject?: string;
  conflictsCoach?: boolean;
};

export type ExamKindClass = 'yazili' | 'deneme' | 'yks' | 'diger';

export type ExamPrepPlan = {
  examId: string;
  title: string;
  date: string;
  daysLeft: number;
  subject: string;
  kind: ExamKindClass;
  period: string;
  missing: string[];
  ongoing: string[];
  done: string[];
  days: { title: string; body: string }[];
};

export type TodayFocus = {
  order: number;
  subject: string;
  minutes: number;
  topic: string;
  reason: string;
  clock?: string;
};

export type StudentState = {
  grade: string;
  track: string;
  dept: string;
  rank: number;
  subjects: SubjectCard[];
  gaps: TopicView[];
  capacity: StudyCapacity;
  lastExam: {
    name: string;
    date: string;
    tyt: number;
    ayt: number;
    delta: number | null;
    correct?: number;
    wrong?: number;
    blank?: number;
    subjects: { name: string; net: number }[];
  } | null;
  insights: { narrative: string; strengths: string[]; weaknesses: string[] };
  examFeedback: { ready: boolean; text: string; need: number };
  todayFocus: TodayFocus[];
  topicRate: number;
  monthMinutes: number;
  tasks: { done: number; open: number; overdue: number };
  coachTasks: string[];
  coachNotes: string[];
  upcomingExams: ExamPrepPlan[];
  weekFocus: { day: string; minutes: number; titles: string[] }[];
  coachWeekFocus: { day: string; minutes: number; titles: string[] }[];
  scheduleToday: { title: string; minutes: number }[];
  coachToday: { title: string; minutes: number }[];
  planChange: PlanChangeProposal;
  activity: { at: string; text: string }[];
  studyBreakdown: { name: string; minutes: number }[];
  weekGoal: { pct: number; hoursLabel: string };
  todayTopics: string[];
  todayTaskTitles: string[];
};

export const MIN_EXAMS_FOR_TREND = 2;

export function studentOwnedSchedule(data: AppData): Schedule {
  return data.schedule.source === 'coach' ? emptySchedule() : data.schedule;
}

export function coachOwnedSchedule(data: AppData): Schedule {
  const c = data.coachSchedule;
  if (c?.days?.some((d) => d.blocks?.length)) return c;
  return data.schedule.source === 'coach' ? data.schedule : emptySchedule();
}

function todayFrom(schedule: Schedule) {
  return schedule.days.find((x) => x.day === weekdayName());
}

export function formatMinutes(m: number) {
  const n = Math.max(0, Math.round(m));
  const h = Math.floor(n / 60);
  const d = n % 60;
  if (h && d) return `${h}s ${d}dk`;
  if (h) return `${h}s`;
  return `${d}dk`;
}

export function classifyExamKind(title: string, kind?: string): ExamKindClass {
  const t = `${title} ${kind || ''}`.toLocaleLowerCase('tr-TR');
  if (/yazılı|yazili/.test(t)) return 'yazili';
  if (/tyt|ayt|yks|osym|ösym/.test(t)) return 'yks';
  if (/deneme/.test(t)) return 'deneme';
  return 'diger';
}

export function statusFromLevel(level: number): TopicStatus {
  if (level >= 100) return 'done';
  if (level > 0) return 'in_progress';
  return 'not_started';
}

export function levelFromStatus(status: TopicStatus, percent?: number): number {
  if (status === 'done') return 100;
  if (status === 'not_started') return 0;
  const n = percent == null ? 50 : percent;
  return Math.min(99, Math.max(1, Math.round(n)));
}

function norm(s: string) {
  return s.toLocaleLowerCase('tr-TR').trim();
}

function topicKey(subject: string, name: string) {
  return `${norm(subject)}::${norm(name)}`;
}

export function prioritizeSubjects(subjects: string[], track: string): string[] {
  const t = norm(track);
  const prefer = t.includes('eşit') || t === 'ea'
    ? ['matematik', 'geometri', 'edebiyat', 'türk dili', 'tarih', 'coğrafya']
    : t.includes('sözel')
      ? ['edebiyat', 'türk dili', 'tarih', 'coğrafya', 'felsefe', 'türkçe']
      : t.includes('dil')
        ? ['ingilizce', 'almanca', 'fransızca', 'türkçe']
        : ['matematik', 'geometri', 'fizik', 'kimya', 'biyoloji'];
  return subjects.slice().sort((a, b) => {
    const ia = prefer.findIndex((p) => norm(a).includes(p));
    const ib = prefer.findIndex((p) => norm(b).includes(p));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'tr');
  });
}

function sessionMinutes(s: Session) {
  return Math.max(0, (s.minutes || 0) + Math.floor((s.seconds || 0) / 60));
}

function isLibrarySession(s: Session) {
  return s.kind === 'library' || norm(s.subject).includes('kütüphane');
}

function matchTopic(session: Session, subject: string, name: string) {
  const blob = `${session.subject} ${session.topic || ''}`;
  return norm(blob).includes(norm(name)) || (norm(blob).includes(norm(subject)) && norm(name).length > 3 && norm(blob).includes(norm(name)));
}

export function inferredLevel(data: AppData, subject: string, name: string, board = buildAnalyticsBoard(data)): { level: number; minutes: number; lastStudy: string } {
  const related = data.sessions.filter((s) => matchTopic(s, subject, name));
  const minutes = related.reduce((a, s) => a + sessionMinutes(s), 0);
  const lastStudy = related.slice().sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))[0]?.date || '';
  let level = 0;
  if (minutes >= 20) level = 40;
  if (minutes >= 60) level = 60;
  if (minutes >= 120) level = 80;
  const hit = board.subjects.find((x) => norm(x.name) === norm(subject) || norm(subject).includes(norm(x.name)) || norm(x.name).includes(norm(subject)));
  if (hit?.band === 'İyi' && minutes > 0) level = Math.max(level, 85);
  if (hit?.trend === 'down') level = Math.min(level || 30, 55);
  const qb = Object.entries(data.qb || {}).find(([k, q]) => {
    const key = norm(q.key || k);
    return key === topicKey(subject, name) || key.includes(norm(name));
  })?.[1];
  if (qb?.completed) level = 100;
  else if (qb && qb.answered > 0) {
    const acc = qb.answered ? qb.correct / qb.answered : 0;
    level = Math.max(level, Math.min(99, Math.round(acc * 100)));
  }
  return { level, minutes, lastStudy };
}

export function setTopicProgress(data: AppData, subject: string, name: string, status: TopicStatus, percent?: number): AppData {
  const level = levelFromStatus(status, percent);
  const grade = data.grade;
  const existing = data.topics.find((t) => norm(t.subject) === norm(subject) && norm(t.name) === norm(name) && (!t.grade || t.grade === grade));
  const row: Topic = existing
    ? { ...existing, level, subject, name, grade }
    : { id: uid('tp_'), name, subject, level, grade };
  const topics = existing
    ? data.topics.map((t) => (t.id === existing.id ? row : t))
    : [row, ...data.topics];
  return { ...data, topics };
}

function topicView(data: AppData, subject: string, name: string, board = buildAnalyticsBoard(data)): TopicView {
  const grade = data.grade;
  const manual = data.topics.find((t) => norm(t.subject) === norm(subject) && norm(t.name) === norm(name) && (!t.grade || t.grade === grade));
  const inferred = inferredLevel(data, subject, name, board);
  if (manual) {
    return {
      name, subject, grade,
      level: manual.level,
      status: statusFromLevel(manual.level),
      source: 'manual',
      studyMinutes: inferred.minutes,
      lastStudy: inferred.lastStudy,
    };
  }
  if (inferred.level > 0) {
    return {
      name, subject, grade,
      level: inferred.level,
      status: statusFromLevel(inferred.level),
      source: 'inferred',
      studyMinutes: inferred.minutes,
      lastStudy: inferred.lastStudy,
    };
  }
  return {
    name, subject, grade, level: 0, status: 'not_started', source: 'curriculum', studyMinutes: 0, lastStudy: '',
  };
}

export function curriculumSubjects(grade: string, track = ''): Record<string, string[]> {
  return curriculumForStudent(grade, track);
}

export function buildSubjectCards(data: AppData): SubjectCard[] {
  const curr = curriculumForStudent(data.grade, data.track);
  const names = prioritizeSubjects(Object.keys(curr), data.track);
  const board = buildAnalyticsBoard(data);
  return names.map((subject) => {
    const topics = (curr[subject] || []).map((name) => topicView(data, subject, name, board));
    const done = topics.filter((t) => t.status === 'done').length;
    const inProgress = topics.filter((t) => t.status === 'in_progress').length;
    const notStarted = topics.filter((t) => t.status === 'not_started').length;
    const progress = topics.length ? Math.round(topics.reduce((a, t) => a + t.level, 0) / topics.length) : 0;
    return { subject, progress, done, inProgress, notStarted, topics };
  });
}

function dayKeys(n: number, today = istanbulDateKey()) {
  const out: string[] = [];
  const [y, m, d] = today.split('-').map(Number);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) - i));
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
}

export function buildCapacity(data: AppData, liveLibraryMinutes = 0): StudyCapacity {
  const today = istanbulDateKey();
  const todaySessions = data.sessions.filter((s) => s.date === today);
  const todayTimer = todaySessions.filter((s) => !isLibrarySession(s)).reduce((a, s) => a + sessionMinutes(s), 0);
  const storedLibrary = todaySessions.filter(isLibrarySession).reduce((a, s) => a + sessionMinutes(s), 0);
  const todayLibrary = storedLibrary + Math.max(0, liveLibraryMinutes);
  const scheduledToday = (todayFrom(studentOwnedSchedule(data))?.blocks || []).reduce((a, b) => a + (b.minutes || 0), 0);
  const keys = dayKeys(7, today);
  const weekTrend = keys.map((date) => ({
    date,
    day: weekdayNameIstanbul(date),
    minutes: data.sessions.filter((s) => s.date === date).reduce((a, s) => a + sessionMinutes(s), 0) + (date === today ? liveLibraryMinutes : 0),
  }));
  const active = weekTrend.filter((d) => d.minutes > 0).map((d) => d.minutes);
  const typical = active.length
    ? Math.round(active.reduce((a, b) => a + b, 0) / active.length)
    : Math.max(60, (data.weekHours || 0) * 60 / 6 || 120);
  const weekSess = data.sessions.filter((s) => keys.includes(s.date));
  const weekTimer = weekSess.filter((s) => !isLibrarySession(s)).reduce((a, s) => a + sessionMinutes(s), 0);
  const weekLibrary = weekSess.filter(isLibrarySession).reduce((a, s) => a + sessionMinutes(s), 0) + liveLibraryMinutes;
  const monthKeys = dayKeys(30, today);
  const monthSet = new Set(monthKeys);
  const monthSess = data.sessions.filter((s) => monthSet.has(s.date));
  const monthTimer = monthSess.filter((s) => !isLibrarySession(s)).reduce((a, s) => a + sessionMinutes(s), 0);
  const monthLibrary = monthSess.filter(isLibrarySession).reduce((a, s) => a + sessionMinutes(s), 0) + liveLibraryMinutes;
  return {
    typicalDayMinutes: Math.min(480, Math.max(45, typical)),
    todayTimer,
    todayLibrary,
    todaySchedule: scheduledToday,
    todayTotal: todayTimer + todayLibrary,
    weekMinutes: weekTimer + weekLibrary,
    weekTimer,
    weekLibrary,
    monthTimer,
    monthLibrary,
    monthTotal: monthTimer + monthLibrary,
    weekTrend,
  };
}

export function scheduleConflicts(proposed: PlanBlock[], data: AppData): string[] {
  const day = todayFrom(studentOwnedSchedule(data));
  if (!day?.blocks.length || !proposed.length) return [];
  const covered = day.blocks.filter((b) => proposed.some((p) => norm(p.text).includes(norm(b.title))));
  if (covered.length) return [];
  return ['Ders Programım yok sayıldı'];
}

function assignTopicsToSchedule(_data: AppData, cards: SubjectCard[], schedule: Schedule): PlanBlock[] {
  const day = todayFrom(schedule);
  if (!day?.blocks.length) return [];
  const gaps = cards.flatMap((c) => c.topics.filter((t) => t.status !== 'done'));
  let i = 0;
  return day.blocks.map((b) => {
    const match = gaps.find((g) => norm(b.title).includes(norm(g.subject)) || norm(g.subject).includes(norm(b.title)));
    const topic = b.topic
      ? (gaps.find((g) => norm(g.name) === norm(b.topic || '')) || { name: b.topic })
      : (match || gaps[i++] || null);
    const text = topic ? `${b.title} / ${topic.name}` : b.title;
    return { text, minutes: b.minutes, icon: b.icon || iconForTopic(text) };
  });
}

export function generateLivingPlan(data: AppData, requestedMinutes?: number): PlanBlock[] {
  const cards = buildSubjectCards(data);
  const cap = buildCapacity(data);
  const board = buildAnalyticsBoard(data);
  const mins = Math.min(
    requestedMinutes || cap.typicalDayMinutes,
    Math.round(cap.typicalDayMinutes * 1.2),
    480,
  );
  const fromOwn = assignTopicsToSchedule(data, cards, studentOwnedSchedule(data));
  if (fromOwn.length) return fromOwn;
  const gaps = cards
    .flatMap((c) => c.topics.filter((t) => t.status !== 'done'))
    .sort((a, b) => {
      const ia = board.weakAreas.findIndex((w) => norm(w) === norm(a.subject) || norm(a.subject).includes(norm(w)));
      const ib = board.weakAreas.findIndex((w) => norm(w) === norm(b.subject) || norm(b.subject).includes(norm(w)));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.level - b.level;
    })
    .slice(0, 6);
  if (gaps.length) {
    const patched: AppData = {
      ...data,
      topics: gaps.map((g, i) => ({
        id: `tmp_${i}`,
        name: `${g.subject} / ${g.name}`,
        subject: g.subject,
        level: g.level,
        grade: data.grade,
      })),
    };
    return generatePlan(patched, Math.max(45, mins), 'Eksik konular');
  }
  return generatePlan(data, Math.max(45, mins), 'Eksik konular');
}

export function planChangeProposal(data: AppData): PlanChangeProposal {
  const board = buildAnalyticsBoard(data);
  const cap = buildCapacity(data);
  const cards = buildSubjectCards(data);
  const downs = board.subjects.filter((s) => s.trend === 'down');
  const ongoing = cards.flatMap((c) => c.topics).filter((t) => t.status === 'in_progress')[0];
  const week = cap.weekTrend;
  const thisHalf = week.slice(-3).reduce((a, d) => a + d.minutes, 0);
  const prevHalf = week.slice(0, 3).reduce((a, d) => a + d.minutes, 0);
  const tempoDrop = prevHalf > 0 ? Math.round(((prevHalf - thisHalf) / prevHalf) * 100) : 0;
  const coachTitles = (todayFrom(coachOwnedSchedule(data))?.blocks || []).map((b) => b.title);
  const parts: string[] = [];
  if (downs.length) {
    const weak = downs[0];
    const spent = studyBreakdown(data).filter((s) => !norm(s.name).includes('kütüphane') && (norm(s.name).includes(norm(weak.name)) || norm(weak.name).includes(norm(s.name.split('/')[0] || '')))).reduce((a, s) => a + s.minutes, 0);
    parts.push(`Son denemelerinde ${downs.map((s) => s.name).join(' ve ')} netin düşüş gösteriyor.`);
    if (spent < cap.typicalDayMinutes) {
      parts.push(`${weak.name} için kayıtlı çalışma süren düşük kaldı. ${weak.name} için haftada 2 ek çalışma bloğu öneriyoruz.`);
    }
  }
  if (ongoing) parts.push(`${ongoing.subject} / ${ongoing.name} konusunda hâlâ devam ediyorsun.`);
  if (tempoDrop >= 10) parts.push(`Bu hafta ayırdığın süre önceki günlere göre %${tempoDrop} azalmış.`);
  const conflictsCoach = Boolean(downs[0] && coachTitles.length && !coachTitles.some((t) => norm(t).includes(norm(downs[0].name))));
  if (conflictsCoach && downs[0]) {
    parts.push(`Koçun Programı bugün ${coachTitles.join(', ')} diyor; ${downs[0].name} eklemek koç programıyla çelişebilir. Koç programı otomatik değişmez.`);
  }
  if (parts.length) {
    parts.push('Programınızda değişiklik yapılmasını öneriyoruz.');
    return { needed: true, subject: downs[0]?.name || ongoing?.subject, reason: parts.join(' '), conflictsCoach };
  }
  const gaps = cards.flatMap((c) => c.topics).filter((t) => t.status === 'not_started');
  if (gaps.length >= 8 && data.plan.length) {
    return {
      needed: true,
      reason: 'Başlanmayan konu sayısı arttı. Program önceliğini eksik konulara çekmeyi öneriyoruz.',
    };
  }
  return { needed: false, reason: 'Kayıtlı verilere göre zorunlu program değişikliği yok.' };
}

export function examPrepPlan(data: AppData, exam: ExamTarget): ExamPrepPlan {
  const daysLeft = Math.max(0, calendarDaysUntil(exam.date));
  const subject = exam.subject || exam.kind || exam.title;
  const cards = buildSubjectCards(data);
  const card = cards.find((c) => norm(c.subject).includes(norm(subject)) || norm(subject).includes(norm(c.subject)))
    || cards[0];
  const topics = card?.topics || [];
  const missing = topics.filter((t) => t.status === 'not_started').map((t) => t.name).slice(0, 6);
  const ongoing = topics.filter((t) => t.status === 'in_progress').map((t) => t.name).slice(0, 6);
  const done = topics.filter((t) => t.status === 'done').map((t) => t.name).slice(0, 6);
  const horizon = Math.min(5, Math.max(1, daysLeft || 1));
  const queue = [...ongoing, ...missing, ...done].slice(0, horizon);
  const days = Array.from({ length: horizon }, (_, i) => {
    const topic = queue[i] || queue[0] || card?.subject || exam.title;
    const kind = i === horizon - 1 ? 'Mini deneme / karma tekrar' : i % 2 === 0 ? 'Konu tekrarı' : 'Soru çözümü';
    return { title: `${i + 1}. Gün — ${topic}`, body: kind };
  });
  const at = /^\d{4}-\d{2}-\d{2}$/.test(exam.date) ? new Date(`${exam.date}T12:00:00`) : new Date();
  const period = academicPeriodLabel(at) || 'dönem belirtilmedi';
  return {
    examId: exam.id,
    title: exam.title,
    date: exam.date,
    daysLeft,
    subject: card?.subject || subject,
    kind: classifyExamKind(exam.title, exam.kind),
    period,
    missing,
    ongoing,
    done,
    days,
  };
}

export function buildStudentState(data: AppData, liveLibraryMinutes = 0): StudentState {
  const board = buildAnalyticsBoard(data);
  const subjects = buildSubjectCards(data);
  const capacity = buildCapacity(data, liveLibraryMinutes);
  const exams = data.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = exams[exams.length - 1];
  const prev = exams[exams.length - 2];
  const today = istanbulDateKey();
  const overdue = data.tasks.filter((t) => !t.done && t.date && t.date < today).length;
  const upcoming = (data.examTargets || [])
    .filter((e) => calendarDaysUntil(e.date) >= 0 && calendarDaysUntil(e.date) <= 21)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)
    .map((e) => examPrepPlan(data, e));
  return {
    grade: data.grade,
    track: data.track,
    dept: data.dept,
    rank: data.rank,
    subjects,
    gaps: subjects.flatMap((s) => s.topics).filter((t) => t.status !== 'done').sort((a, b) => a.level - b.level).slice(0, 8),
    capacity,
    lastExam: last
      ? {
        name: last.name,
        date: last.date,
        tyt: last.tyt,
        ayt: last.ayt,
        delta: prev ? last.tyt - prev.tyt : null,
        correct: last.correct,
        wrong: last.wrong,
        blank: last.blank,
        subjects: (last.subjects || []).map((s) => ({ name: s.name, net: s.net })),
      }
      : null,
    insights: {
      narrative: writtenExamFeedback(data).text,
      strengths: board.subjects.filter((s) => s.band === 'İyi' || s.trend === 'up').map((s) => s.name).slice(0, 3),
      weaknesses: board.weakAreas.slice(0, 3),
    },
    tasks: {
      done: data.tasks.filter((t) => t.done).length,
      open: data.tasks.filter((t) => !t.done).length,
      overdue,
    },
    examFeedback: writtenExamFeedback(data),
    todayFocus: buildTodayFocus(data, subjects),
    topicRate: subjects.length
      ? Math.round(subjects.reduce((a, c) => a + c.progress, 0) / subjects.length)
      : 0,
    monthMinutes: studyWindowMinutes(data, 30, liveLibraryMinutes),
    todayTaskTitles: data.tasks.filter((t) => t.date === today).map((t) => `${t.done ? '✓' : '○'} ${t.title}`),
    coachTasks: data.tasks.filter((t) => !t.done && t.origin === 'coach').map((t) => t.title).slice(0, 6),
    coachNotes: [
      ...data.tasks.filter((t) => t.origin === 'coach').map((t) => t.title),
      ...data.learningNotes.slice(-4).map((n) => n.note),
    ].filter(Boolean).slice(0, 8),
    upcomingExams: upcoming,
    weekFocus: weekFocusOf(studentOwnedSchedule(data)),
    coachWeekFocus: weekFocusOf(coachOwnedSchedule(data)),
    scheduleToday: (todayFrom(studentOwnedSchedule(data))?.blocks || []).map((b) => ({ title: b.title, minutes: b.minutes })),
    coachToday: (todayFrom(coachOwnedSchedule(data))?.blocks || []).map((b) => ({ title: b.title, minutes: b.minutes })),
    planChange: planChangeProposal(data),
    activity: recentStudentActivity(data),
    studyBreakdown: studyBreakdown(data),
    weekGoal: weekGoalPct(data),
    todayTopics: data.sessions
      .filter((s) => s.date === today && !isLibrarySession(s) && (s.topic || s.subject))
      .map((s) => [s.subject, s.topic].filter(Boolean).join(' / ')),
  };
}

function weekFocusOf(schedule: Schedule) {
  return (schedule.days || []).map((d) => ({
    day: d.day,
    minutes: d.blocks.reduce((a, b) => a + (b.minutes || 0), 0),
    titles: d.blocks.map((b) => b.title),
  }));
}

export function studyBreakdown(data: AppData): { name: string; minutes: number }[] {
  const map = new Map<string, number>();
  for (const s of data.sessions) {
    const name = isLibrarySession(s) ? 'Sessiz Kütüphane' : (s.topic ? `${s.subject} / ${s.topic}` : (s.subject || 'Çalışma'));
    map.set(name, (map.get(name) || 0) + sessionMinutes(s));
  }
  return [...map.entries()].map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);
}

export function recentStudentActivity(data: AppData, limit = 12): { at: string; text: string }[] {
  const items: { at: string; text: string }[] = [];
  for (const s of data.sessions) {
    const at = s.createdAt || s.date;
    const mins = formatMinutes(sessionMinutes(s));
    if (isLibrarySession(s)) items.push({ at, text: `${mins} Sessiz Kütüphane’de çalışıldı` });
    else items.push({ at, text: `${s.subject}${s.topic ? ` / ${s.topic}` : ''} çalışıldı · ${mins}` });
  }
  for (const e of data.exams) {
    items.push({ at: e.date, text: `Deneme eklendi: ${e.name}` });
  }
  for (const t of data.topics.filter((x) => x.level >= 100)) {
    items.push({ at: '', text: `${t.subject ? `${t.subject} / ` : ''}${t.name} konusu tamamlandı` });
  }
  for (const t of data.tasks.filter((x) => x.done)) {
    items.push({
      at: t.date || '',
      text: t.origin === 'coach' ? `Koçun verdiği görev tamamlandı: ${t.title}` : `Görev tamamlandı: ${t.title}`,
    });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

export function liveLibraryMinutes(data: AppData, now = Date.now()) {
  if (!data.libraryPrefs.joinedRoomId || !data.libraryPrefs.joinedAt) return 0;
  const start = Date.parse(data.libraryPrefs.joinedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60000));
}

export function progressFingerprint(data: AppData, live = 0) {
  return [
    data.syncRev,
    data.grade, data.track, data.dept, data.rank, data.weekHours, data.examDate,
    data.planDate || '',
    data.schedule.updatedAt,
    data.schedule.source,
    data.schedule.days.map((d) => d.blocks.map((b) => `${b.start || ''}:${b.title}:${b.topic || ''}:${b.minutes}`).join(',')).join(';'),
    data.coachSchedule?.updatedAt || '',
    (data.coachSchedule?.days || []).map((d) => d.blocks.map((b) => `${b.start || ''}:${b.title}:${b.topic || ''}:${b.minutes}:${b.note || ''}`).join(',')).join(';'),
    data.libraryPrefs.joinedAt || '',
    data.libraryPrefs.joinedRoomId || '',
    live,
    data.topics.map((t) => `${t.id}:${t.level}`).join(','),
    data.exams.map((e) => `${e.id}:${e.name}:${e.date}:${e.tyt}:${e.ayt}:${e.correct ?? ''}:${e.wrong ?? ''}:${e.blank ?? ''}:${(e.subjects || []).map((s) => `${s.name}:${s.net}:${s.correct ?? ''}:${s.wrong ?? ''}:${s.blank ?? ''}`).join(',')}`).join(';'),
    data.sessions.map((s) => `${s.id}:${s.minutes}:${s.topic || ''}:${s.kind || ''}:${s.subject || ''}`).join(','),
    data.tasks.map((t) => `${t.id}:${t.done ? 1 : 0}:${t.origin || ''}:${t.title}`).join(','),
    data.examTargets.map((e) => `${e.id}:${e.date}:${e.title}:${e.subject || ''}`).join(','),
    data.learningNotes.map((n) => `${n.at}:${n.topic}`).join(','),
    data.plan.map((p) => `${p.text}:${p.minutes}`).join(','),
    (data.calcs || []).map((c) => `${c.id}:${c.net}`).join(','),
    data.schedule.notes || '',
    data.coachSchedule?.notes || '',
    // emoji / nameMode fingerprint dışı — figür seçimi AI/StudentProgress resetlemez
  ].join('|');
}

let progressCache: { fp: string; state: StudentState } | null = null;

export function invalidateStudentProgress() {
  progressCache = null;
}

export function getStudentProgress(data: AppData, live?: number): StudentState {
  const minutes = live ?? liveLibraryMinutes(data);
  const fp = progressFingerprint(data, minutes);
  if (progressCache?.fp === fp) return progressCache.state;
  const state = buildStudentState(data, minutes);
  progressCache = { fp, state };
  return state;
}

export function studentStateLines(data: AppData): string[] {
  const s = getStudentProgress(data);
  const edu = getStudentEducationContext(data);
  const fieldHint = aytFieldHint(edu);
  const lines = [
    `Sınıf: ${s.grade || 'belirtilmedi'}. Alan: ${s.track || 'belirtilmedi'}${edu.fieldShort ? ` (${edu.fieldShort})` : ''}. Hedef: ${s.dept || 'belirtilmedi'}${s.rank > 0 ? ` sıra ${s.rank}` : ''}.`,
    `Tipik günlük kapasite: ${s.capacity.typicalDayMinutes} dk. Bugün çalışma saati ${s.capacity.todayTimer} dk, kütüphane ${s.capacity.todayLibrary} dk.`,
  ];
  if (fieldHint) lines.push(`Alanına uygun odak: ${fieldHint}. Başka alanın AYT konularını önerme.`);
  if (edu.periodLabel) lines.push(`Okul dönemi (tarihten): ${edu.periodLabel}.`);
  if (s.lastExam) lines.push(`Son deneme ${s.lastExam.name} (${s.lastExam.date}): TYT ${s.lastExam.tyt}${s.lastExam.delta != null ? ` (Δ ${s.lastExam.delta > 0 ? '+' : ''}${s.lastExam.delta})` : ''}.`);
  if (s.gaps[0]) lines.push(`Öncelikli eksik: ${s.gaps.slice(0, 4).map((g) => `${g.subject}/${g.name} %${g.level}`).join(', ')}.`);
  if (s.scheduleToday.length) lines.push(`Ders Programım bugün: ${s.scheduleToday.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}.`);
  if (s.coachToday.length) lines.push(`Koçun Programı bugün: ${s.coachToday.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}. Koç programını sessizce değiştirme.`);
  if (s.planChange.conflictsCoach) lines.push(`Uyarı: öneri koç programıyla çelişebilir. ${s.planChange.reason}`);
  if (s.activity[0]) lines.push(`Son işlem: ${s.activity.slice(0, 3).map((a) => a.text).join('; ')}.`);
  if (s.coachTasks.length) lines.push(`Koç görevleri: ${s.coachTasks.join('; ')}.`);
  if (s.upcomingExams[0]) lines.push(`Yaklaşan: ${s.upcomingExams.map((e) => `${e.title} ${e.daysLeft} gün`).join(', ')}.`);
  if (s.insights.narrative) lines.push(s.insights.narrative);
  lines.push('Programı sessizce değiştirme; onay iste. Yaş/sınıf sorma, Hesabım kaydını kullan.');
  return lines;
}

export function appendLibrarySession(data: AppData, startedAt: string | null, endedAt = Date.now()): AppData {
  if (!startedAt) return data;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return data;
  const minutes = Math.floor(Math.max(0, endedAt - start) / 60000);
  if (minutes < 1) return data;
  const date = istanbulDateKey(new Date(endedAt));
  const session: Session = {
    id: uid('s_'),
    date,
    minutes,
    seconds: 0,
    subject: 'Sessiz Kütüphane',
    kind: 'library',
    createdAt: new Date(endedAt).toISOString(),
    startedAt,
  };
  return { ...data, sessions: [session, ...data.sessions] };
}

export function writtenExamFeedback(data: AppData): { ready: boolean; text: string; need: number } {
  const exams = data.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (exams.length < MIN_EXAMS_FOR_TREND) {
    return {
      ready: false,
      need: MIN_EXAMS_FOR_TREND,
      text: `Bu değerlendirmeyi oluşturmak için en az ${MIN_EXAMS_FOR_TREND} deneme kaydı gerekiyor. Henüz yeterli deneme verisi bulunmuyor.`,
    };
  }
  const board = buildAnalyticsBoard(data);
  const last = exams[exams.length - 1];
  const prev = exams[exams.length - 2];
  const delta = last.tyt - prev.tyt;
  const parts: string[] = [];
  const series = exams.slice(-3).map((e) => e.tyt);
  if (series.length >= 3) parts.push(`Son üç denemende TYT netlerin ${series.join(' → ')}.`);
  else if (prev.tyt > 0) {
    const pct = Math.round((delta / prev.tyt) * 100);
    if (Math.abs(pct) >= 5) {
      parts.push(`Bu denemede TYT netin bir önceki kayda göre %${Math.abs(pct)} ${delta >= 0 ? 'arttı' : 'azaldı'} (${prev.tyt} → ${last.tyt}).`);
    } else {
      parts.push(`Son iki denemende TYT netin ${prev.tyt} → ${last.tyt}; belirgin bir sıçrama yok.`);
    }
  }
  for (const s of board.subjects) {
    if (s.trend === 'up') parts.push(`${s.name} son kayıtlarda yükseliyor.`);
    if (s.trend === 'down') parts.push(`${s.name} son kayıtlarda düşüyor; tekrar önerilir.`);
  }
  const ongoing = buildSubjectCards(data).flatMap((c) => c.topics).filter((t) => t.status === 'in_progress')[0];
  if (ongoing) parts.push(`Devam ettiğin ${ongoing.subject} / ${ongoing.name} konusunu bugünkü blokta tut.`);
  if (!parts.length) {
    return { ready: true, need: MIN_EXAMS_FOR_TREND, text: 'Kayıtlı denemeler var; ders bazlı net dağılımı henüz yok. Konu tahmini yapılmadı.' };
  }
  return { ready: true, need: MIN_EXAMS_FOR_TREND, text: parts.join(' ') };
}

function focusFromBlocks(data: AppData, cards: SubjectCard[], schedule: Schedule, reasonBase: string): TodayFocus[] {
  const board = buildAnalyticsBoard(data);
  return assignTopicsToSchedule(data, cards, schedule).map((b, i) => {
    const [subject, topic] = b.text.split(' / ');
    const weak = board.weakAreas.some((w) => norm(b.text).includes(norm(w)));
    const upcoming = (data.examTargets || []).some((e) => norm(e.title).includes(norm(subject || '')) || norm(e.subject || '').includes(norm(subject || '')));
    const reason = upcoming
      ? 'Yaklaşan sınav nedeniyle öncelikli'
      : weak
        ? 'Son denemelerde zayıf alan'
        : topic
          ? `${reasonBase} bloğunda bu konuya devam`
          : reasonBase;
    return { order: i + 1, subject: subject || b.text, minutes: b.minutes, topic: topic || '', reason };
  });
}

export function buildTodayFocus(data: AppData, cards?: SubjectCard[]): TodayFocus[] {
  const subjects = cards || buildSubjectCards(data);
  const cap = buildCapacity(data);
  const board = buildAnalyticsBoard(data);
  const unit = Math.max(25, Math.min(60, Math.round(cap.typicalDayMinutes / 4) || 40));
  const own = focusFromBlocks(data, subjects, studentOwnedSchedule(data), 'Ders Programım');
  const coachBlocks = focusFromBlocks(data, subjects, coachOwnedSchedule(data), 'Koçun Programı');
  if (own.length || coachBlocks.length) {
    return [...own, ...coachBlocks.filter((c) => !own.some((o) => norm(o.subject) === norm(c.subject) && norm(o.topic) === norm(c.topic)))]
      .map((x, i) => ({ ...x, order: i + 1 }));
  }
  const items: TodayFocus[] = [];
  const add = (subject: string, minutes: number, topic: string, reason: string) => {
    if (items.some((x) => norm(x.subject) === norm(subject) && norm(x.topic) === norm(topic))) return;
    items.push({ order: items.length + 1, subject, minutes, topic, reason });
  };
  const ongoing = subjects.flatMap((c) => c.topics.filter((t) => t.status === 'in_progress'))[0];
  if (ongoing) add(ongoing.subject, unit, ongoing.name, 'Devam eden konu');
  if (board.weakAreas[0]) add(board.weakAreas[0], Math.max(30, unit - 10), '', 'Son denemelerde zayıf alan');
  const upcoming = (data.examTargets || []).filter((e) => calendarDaysUntil(e.date) >= 0 && calendarDaysUntil(e.date) <= 14)[0];
  if (upcoming) add(upcoming.subject || upcoming.title, 30, '', 'Yaklaşan sınav nedeniyle öncelikli');
  const coachTask = data.tasks.find((t) => !t.done && t.origin === 'coach');
  if (coachTask) add(coachTask.subject || 'Görev', Math.max(20, coachTask.minutes || 20), coachTask.title, 'Koç notu / görev');
  const notStarted = subjects.flatMap((c) => c.topics.filter((t) => t.status === 'not_started'))[0];
  if (notStarted && items.length < 4) add(notStarted.subject, 20, notStarted.name, 'Henüz başlanmayan konu');
  add('Tekrar', 15, board.weakAreas[0] || ongoing?.name || '', 'Kısa kapanış tekrarı');
  return stampSuggestedClocks(items.slice(0, 5));
}

function hhmm(totalMin: number) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function stampSuggestedClocks(items: TodayFocus[]): TodayFocus[] {
  let t = 9 * 60;
  return items.map((item) => {
    const start = t;
    const end = t + item.minutes;
    t = end + 15;
    return { ...item, clock: `${hhmm(start)}–${hhmm(end)}` };
  });
}

export function studyWindowMinutes(data: AppData, days: number, liveLibraryMinutes = 0) {
  const today = istanbulDateKey();
  const keys = dayKeys(Math.max(1, days), today);
  const set = new Set(keys);
  const stored = data.sessions.filter((s) => set.has(s.date)).reduce((a, s) => a + sessionMinutes(s), 0);
  return stored + liveLibraryMinutes;
}

export function acceptPlanChange(data: AppData, minutes?: number): AppData {
  const prop = planChangeProposal(data);
  const plan = generateLivingPlan(data, minutes);
  let schedule = data.schedule;
  if (prop.needed && prop.subject && schedule.days.length && schedule.source !== 'coach') {
    schedule = {
      ...schedule,
      days: schedule.days.map((day) => ({
        ...day,
        blocks: day.blocks.map((b) => (
          norm(b.title).includes(norm(prop.subject || ''))
            ? { ...b, minutes: Math.min(120, (b.minutes || 40) + 15) }
            : b
        )),
      })),
      notes: [schedule.notes, `Onaylı güncelleme: ${prop.subject} süresi artırıldı.`].filter(Boolean).join(' '),
      updatedAt: new Date().toISOString(),
    };
  }
  return { ...data, plan, planDate: istanbulDateKey(), schedule };
}
