import type { AppData } from './types';
import { emptyData } from './types';
import { emptyNotifyPrefs, normalizeExamPlan, normalizeExamTarget, seedTargetsFromLegacy } from './examTargets';

export function storageKey(userId?: string | null) {
  return userId ? `yks_v7_${userId}` : 'yks_v7_guest';
}

export function normalizeData(raw: unknown): AppData {
  const d = emptyData();
  if (!raw || typeof raw !== 'object') return d;
  const x = raw as Partial<AppData>;
  d.dept = x.dept == null ? d.dept : String(x.dept);
  d.rank = x.rank === undefined || x.rank === null || Number.isNaN(Number(x.rank)) ? d.rank : Math.max(0, Number(x.rank));
  d.weekHours = Number(x.weekHours) > 0 ? Number(x.weekHours) : d.weekHours;
  d.track = x.track == null ? d.track : String(x.track);
  d.grade = x.grade == null ? d.grade : String(x.grade);
  d.age = Number(x.age) > 0 ? Number(x.age) : 0;
  d.examDate = x.examDate == null ? d.examDate : String(x.examDate);
  d.examTargets = Array.isArray((x as AppData).examTargets)
    ? (x as AppData).examTargets.map(normalizeExamTarget).filter((t): t is NonNullable<typeof t> => Boolean(t))
    : [];
  if (!d.examTargets.length) d.examTargets = seedTargetsFromLegacy({ ...d, examTargets: [] });
  const prefs = (x as AppData).examNotifyPrefs;
  d.examNotifyPrefs = prefs && typeof prefs === 'object'
    ? { exams: prefs.exams !== false, ai: Boolean(prefs.ai), tasks: Boolean(prefs.tasks) }
    : emptyNotifyPrefs();
  d.examNotifyLog = (x as AppData).examNotifyLog && typeof (x as AppData).examNotifyLog === 'object'
    ? { ...(x as AppData).examNotifyLog }
    : {};
  d.examPlan = normalizeExamPlan((x as AppData).examPlan);
  d.examPlanDraft = normalizeExamPlan((x as AppData).examPlanDraft);
  d.tasks = Array.isArray(x.tasks)
    ? x.tasks.filter((t) => t && t.title).map((t) => ({
      ...t,
      origin: t.origin === 'zorro' || t.origin === 'coach' || t.origin === 'student' ? t.origin : 'student',
    }))
    : [];
  d.exams = Array.isArray(x.exams) ? x.exams.filter((e) => e && e.date) : [];
  d.topics = Array.isArray(x.topics) ? x.topics.filter((t) => t && t.name) : [];
  d.questions = Array.isArray(x.questions) ? x.questions.filter(Boolean) : [];
  d.sessions = uniqueById(Array.isArray(x.sessions) ? x.sessions.filter((s) => s && s.date) : []);
  d.plan = Array.isArray(x.plan) ? x.plan.filter(Boolean) : [];
  d.planDate = x.planDate;
  d.calcs = Array.isArray(x.calcs) ? x.calcs.filter(Boolean) : [];
  const sch = x.schedule;
  d.schedule = {
    days: Array.isArray(sch?.days) ? sch.days : [],
    source: String(sch?.source || ''),
    pdfName: String(sch?.pdfName || ''),
    pdfSize: Number(sch?.pdfSize) || 0,
    notes: String(sch?.notes || ''),
    updatedAt: String(sch?.updatedAt || ''),
  };
  d.qb = x.qb && typeof x.qb === 'object' ? x.qb : {};
  d.questionStats = x.questionStats && typeof x.questionStats === 'object' ? x.questionStats : {};
  d.qbMarks = Array.isArray(x.qbMarks) ? [...new Set(x.qbMarks.map(String))] : [];
  d.learningNotes = Array.isArray((x as AppData).learningNotes)
    ? (x as AppData).learningNotes.filter((n) => n && n.topic && n.note).slice(0, 24)
    : [];
  const rawMistakes = (x as AppData).mistakes;
  d.mistakes = uniqueById(Array.isArray(rawMistakes) ? rawMistakes.filter((m) => m && m.questionId) : []);
  const rawReviews = (x as AppData).reviews;
  d.reviews = uniqueById(Array.isArray(rawReviews) ? rawReviews.filter((r) => r && r.id && r.dueDate) : []);
  d.syncRev = Math.max(0, Number((x as AppData).syncRev) || 0);
  const stones = (x as AppData).tombstones;
  d.tombstones = uniqueTombstones(Array.isArray(stones) ? stones.filter((t) => t && t.id && t.kind) : []);
  const lp = (x as AppData).libraryPrefs;
  d.libraryPrefs = {
    nameMode: lp?.nameMode === 'real' || lp?.nameMode === 'alias' ? lp.nameMode : null,
    joinedRoomId: lp?.joinedRoomId ? String(lp.joinedRoomId) : null,
    joinedAt: lp?.joinedAt ? String(lp.joinedAt) : null,
  };
  return d;
}

export function uniqueTombstones(rows: AppData['tombstones']): AppData['tombstones'] {
  const seen = new Set<string>();
  const out: AppData['tombstones'] = [];
  for (const t of rows) {
    const k = `${t.kind}:${t.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: t.kind, id: String(t.id), at: String(t.at || '') });
  }
  return out;
}

export function uniqueById<T extends { id?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export function applyProfileSeed(data: AppData, profile: { signup_grade?: string; signup_track?: string; signup_exam?: string; target_department?: string; target_rank?: number } | null | undefined): AppData {
  if (!profile) return data;
  const next = { ...data };
  if (!next.grade && profile.signup_grade) next.grade = profile.signup_grade;
  if (!next.track && profile.signup_track) next.track = profile.signup_track;
  if (!next.dept && profile.target_department) next.dept = profile.target_department;
  if (!(next.rank > 0) && profile.target_rank != null) next.rank = Number(profile.target_rank) || next.rank;
  if (!next.examDate && profile.signup_exam) next.examDate = profile.signup_exam;
  return next;
}

export function dataLooksEmpty(d: AppData) {
  return !d.dept && !d.grade && !d.track && !d.examDate && d.age <= 0 && d.weekHours <= 0
    && d.tasks.length === 0 && d.sessions.length === 0 && d.exams.length === 0 && d.topics.length === 0
    && d.questions.length === 0 && d.examTargets.length === 0;
}

export function loadData(userId?: string | null): AppData {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return normalizeData(JSON.parse(raw));
    const legacy = localStorage.getItem(userId ? `yks_v6_${userId}` : 'yks_v6_guest');
    if (legacy) return normalizeData(JSON.parse(legacy));
  } catch {
    /* ignore */
  }
  return emptyData();
}

export function saveData(data: AppData, userId?: string | null) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch (e) {
    console.warn('Yerel kayıt yazılamadı', e);
  }
}
