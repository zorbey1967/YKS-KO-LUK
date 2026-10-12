import type { AppData, MistakeEntry, ReviewItem, Session, Task, Tombstone } from './types';
import { emptyData } from './types';
import { normalizeData, uniqueById, uniqueTombstones } from './storage';

function stamp(row: { updatedAt?: string; createdAt?: string; lastWrongAt?: string; lastSeen?: string | null; endedAt?: string }): string {
  return String(row.updatedAt || row.endedAt || row.lastWrongAt || row.lastSeen || row.createdAt || '');
}

function later<T>(a: T, b: T, ta: string, tb: string): T {
  if (!ta) return b;
  if (!tb) return a;
  return tb >= ta ? b : a;
}

export function lastWriteWinsReplace(cloud: AppData, _local: AppData): AppData {
  return cloud;
}

export function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    const k = `${t.kind}:${t.id}`;
    const prev = map.get(k);
    if (!prev || (t.at && (!prev.at || t.at < prev.at))) map.set(k, t);
  }
  return uniqueTombstones([...map.values()]);
}

function dead(stones: Tombstone[], kind: Tombstone['kind'], id: string) {
  return stones.some((t) => t.kind === kind && t.id === id);
}

export function mergeTasks(a: Task[], b: Task[], stones: Tombstone[]): Task[] {
  const ids = new Set([...a, ...b].map((t) => t.id).filter(Boolean));
  const out: Task[] = [];
  for (const id of ids) {
    if (dead(stones, 'task', id)) continue;
    const x = a.find((t) => t.id === id);
    const y = b.find((t) => t.id === id);
    if (!x) { out.push(y!); continue; }
    if (!y) { out.push(x); continue; }
    const picked = later(x, y, stamp(x), stamp(y));
    out.push({
      ...picked,
      done: x.done || y.done,
      origin: x.origin === 'coach' || y.origin === 'coach' ? 'coach' : picked.origin,
      homeworkId: x.homeworkId || y.homeworkId,
    });
  }
  return uniqueById(out);
}

export function mergeSessions(a: Session[], b: Session[], stones: Tombstone[]): Session[] {
  const ids = new Set([...a, ...b].map((s) => s.id).filter(Boolean));
  const out: Session[] = [];
  for (const id of ids) {
    if (dead(stones, 'session', id)) continue;
    const x = a.find((s) => s.id === id);
    const y = b.find((s) => s.id === id);
    if (!x) { out.push(y!); continue; }
    if (!y) { out.push(x); continue; }
    const picked = later(x, y, stamp(x), stamp(y));
    out.push({
      ...picked,
      asked: picked.asked ?? x.asked ?? y.asked,
      correctCount: picked.correctCount ?? x.correctCount ?? y.correctCount,
    });
  }
  return uniqueById(out);
}

export function mergeMistakes(a: MistakeEntry[], b: MistakeEntry[], stones: Tombstone[]): MistakeEntry[] {
  const ids = new Set([...a, ...b].map((m) => m.id).filter(Boolean));
  const out: MistakeEntry[] = [];
  for (const id of ids) {
    if (dead(stones, 'mistake', id)) continue;
    const x = a.find((m) => m.id === id);
    const y = b.find((m) => m.id === id);
    if (!x) { out.push(y!); continue; }
    if (!y) { out.push(x); continue; }
    const picked = later(x, y, x.lastWrongAt, y.lastWrongAt);
    out.push({
      ...picked,
      wrongCount: Math.max(x.wrongCount, y.wrongCount),
      lastCorrectAt: [x.lastCorrectAt, y.lastCorrectAt].filter(Boolean).sort().reverse()[0],
      reason: picked.reason || x.reason || y.reason,
    });
  }
  return uniqueById(out);
}

export function mergeReviews(a: ReviewItem[], b: ReviewItem[], stones: Tombstone[]): ReviewItem[] {
  const ids = new Set([...a, ...b].map((r) => r.id).filter(Boolean));
  const out: ReviewItem[] = [];
  for (const id of ids) {
    if (dead(stones, 'review', id)) continue;
    const x = a.find((r) => r.id === id);
    const y = b.find((r) => r.id === id);
    if (!x) { out.push(y!); continue; }
    if (!y) { out.push(x); continue; }
    const picked = later(x, y, x.dueDate + (x.lastResult || ''), y.dueDate + (y.lastResult || ''));
    const done = x.status === 'done' || y.status === 'done';
    const newerWrong = (x.lastResult === 'wrong' && x.dueDate >= y.dueDate) || (y.lastResult === 'wrong' && y.dueDate >= x.dueDate);
    out.push({
      ...picked,
      status: done && !newerWrong ? 'done' : picked.status,
      completedOnce: Boolean(x.completedOnce || y.completedOnce),
    });
  }
  return uniqueById(out);
}

function mergeStats(a: AppData['questionStats'], b: AppData['questionStats']): AppData['questionStats'] {
  const out: AppData['questionStats'] = { ...a };
  for (const [k, y] of Object.entries(b)) {
    const x = out[k];
    if (!x) { out[k] = y; continue; }
    const yLater = String(y.lastSeen || '') >= String(x.lastSeen || '');
    out[k] = {
      attempts: Math.max(x.attempts, y.attempts),
      correct: Math.max(x.correct, y.correct),
      wrong: Math.max(x.wrong, y.wrong),
      lastAnswer: yLater ? y.lastAnswer : x.lastAnswer,
      lastSeen: yLater ? y.lastSeen : x.lastSeen,
    };
  }
  return out;
}

function mergeQb(a: AppData['qb'], b: AppData['qb']): AppData['qb'] {
  const out: AppData['qb'] = { ...a };
  for (const [k, y] of Object.entries(b)) {
    const x = out[k];
    if (!x) { out[k] = y; continue; }
    const yLater = String(y.updatedAt || '') >= String(x.updatedAt || '');
    const ids = [...new Set([...(x.answeredIds || []), ...(y.answeredIds || [])])];
    out[k] = {
      ...(yLater ? y : x),
      answeredIds: ids,
      answered: Math.max(x.answered, y.answered, ids.length),
      correct: Math.max(x.correct, y.correct),
      wrong: Math.max(x.wrong, y.wrong),
    };
  }
  return out;
}

function pickScalar(a: AppData, b: AppData): Pick<AppData, 'dept' | 'rank' | 'weekHours' | 'track' | 'grade' | 'age' | 'examDate'> {
  const aWins = (a.syncRev || 0) > (b.syncRev || 0);
  const src = aWins ? a : b;
  const other = aWins ? b : a;
  return {
    dept: src.dept || other.dept,
    rank: src.rank > 0 ? src.rank : other.rank,
    weekHours: src.weekHours > 0 ? src.weekHours : other.weekHours,
    track: src.track || other.track,
    grade: src.grade || other.grade,
    age: src.age > 0 ? src.age : other.age,
    examDate: src.examDate || other.examDate,
  };
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  const L = normalizeData(local);
  const R = normalizeData(remote);
  const tombstones = mergeTombstones(L.tombstones, R.tombstones);
  const scalars = pickScalar(L, R);
  const planWins = String(R.planDate || '') >= String(L.planDate || '');
  const schWins = String(R.schedule.updatedAt || '') >= String(L.schedule.updatedAt || '');
  const exams = uniqueById([...L.exams, ...R.exams].filter((e) => e.id && !dead(tombstones, 'exam', e.id)));
  if (!L.exams.some((e) => e.id) && !R.exams.some((e) => e.id)) {
    /* date-only exams: keep union by date+name */
  }
  const next: AppData = {
    ...emptyData(),
    ...scalars,
    tombstones,
    syncRev: Math.max(L.syncRev || 0, R.syncRev || 0),
    tasks: mergeTasks(L.tasks, R.tasks, tombstones),
    sessions: mergeSessions(L.sessions, R.sessions, tombstones),
    mistakes: mergeMistakes(L.mistakes, R.mistakes, tombstones),
    reviews: mergeReviews(L.reviews, R.reviews, tombstones),
    exams: exams.length ? exams : uniqueById([...L.exams, ...R.exams].map((e, i) => ({ ...e, id: e.id || `ex_${e.date}_${i}` }))),
    topics: uniqueById([...L.topics, ...R.topics]),
    questions: [...L.questions, ...R.questions].filter((q, i, arr) => arr.findIndex((x) => x.date === q.date && x.subject === q.subject) === i),
    examTargets: uniqueById([...L.examTargets, ...R.examTargets]),
    examNotifyPrefs: { ...L.examNotifyPrefs, ...R.examNotifyPrefs },
    examNotifyLog: { ...L.examNotifyLog, ...R.examNotifyLog },
    examPlan: R.examPlan || L.examPlan,
    examPlanDraft: R.examPlanDraft || L.examPlanDraft,
    plan: planWins ? R.plan : L.plan,
    planDate: planWins ? R.planDate : L.planDate,
    calcs: [...L.calcs, ...R.calcs].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i),
    schedule: schWins ? R.schedule : L.schedule,
    qb: mergeQb(L.qb, R.qb),
    questionStats: mergeStats(L.questionStats, R.questionStats),
    qbMarks: [...new Set([...L.qbMarks, ...R.qbMarks])],
    learningNotes: [...L.learningNotes, ...R.learningNotes].filter((n, i, arr) => arr.findIndex((x) => x.at === n.at && x.topic === n.topic) === i).slice(0, 24),
  };
  return next;
}

export function tombstone(data: AppData, kind: Tombstone['kind'], id: string, at = new Date().toISOString()): AppData {
  const stones = mergeTombstones(data.tombstones, [{ kind, id, at }]);
  const next = { ...data, tombstones: stones };
  if (kind === 'session') next.sessions = data.sessions.filter((s) => s.id !== id);
  if (kind === 'task') next.tasks = data.tasks.filter((t) => t.id !== id);
  if (kind === 'mistake') next.mistakes = data.mistakes.filter((m) => m.id !== id);
  if (kind === 'review') next.reviews = data.reviews.filter((r) => r.id !== id);
  if (kind === 'exam') next.exams = data.exams.filter((e) => e.id !== id);
  return next;
}

export function parsePushResult(raw: unknown): { ok: boolean; rev: number; data: AppData | null } {
  if (!raw || typeof raw !== 'object') return { ok: false, rev: 0, data: null };
  const x = raw as Record<string, unknown>;
  return {
    ok: x.ok === true,
    rev: Math.max(0, Number(x.rev) || 0),
    data: x.data && typeof x.data === 'object' ? normalizeData(x.data) : null,
  };
}
