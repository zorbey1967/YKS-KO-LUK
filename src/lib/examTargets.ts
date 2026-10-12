import type { AppData, ExamNotifyPrefs, ExamPlanRecord, ExamPriority, ExamTarget, Schedule } from './types';
import { uid } from './util';

export type { ExamTarget, ExamPriority, ExamNotifyPrefs };

export const EXAM_KIND_OPTIONS = [
  'YKS',
  'TYT',
  'AYT',
  'LGS',
  'KPSS',
  'KPSS Genel Yetenek',
  'KPSS Genel Kültür',
  'Deneme',
  'Dil sınavı',
  'Bursluluk',
  'Üniversite',
  'Özel sınav',
  'Diğer',
] as const;

export function emptyNotifyPrefs(): ExamNotifyPrefs {
  return { exams: true, ai: false, tasks: false };
}

export function emptyExamTarget(): ExamTarget {
  const now = new Date().toISOString();
  return {
    id: '',
    title: '',
    kind: 'Deneme',
    origin: 'user',
    subject: '',
    date: '',
    startTime: '',
    endTime: '',
    durationMin: 0,
    note: '',
    priority: 'normal',
    isPrimary: false,
    notify: true,
    createdAt: now,
    updatedAt: now,
  };
}

function asPriority(s: unknown): ExamPriority {
  return s === 'dusuk' || s === 'yuksek' ? s : 'normal';
}

export function normalizeExamTarget(raw: unknown): ExamTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Partial<ExamTarget>;
  const date = String(x.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const title = String(x.title || '').trim() || String(x.kind || 'Sınav');
  const origin = x.origin === 'official' || x.origin === 'user'
    ? x.origin
    : (Boolean(x.isPrimary) && /^(YKS|LGS|KPSS)$/i.test(String(x.kind || '')) ? 'official' : 'user');
  return {
    id: String(x.id || uid('ex_')),
    title,
    kind: String(x.kind || 'Diğer').trim() || 'Diğer',
    subject: String(x.subject || '').trim().slice(0, 80),
    origin,
    date,
    startTime: String(x.startTime || '').slice(0, 5),
    endTime: String(x.endTime || '').slice(0, 5),
    durationMin: Math.max(0, Math.min(600, Number((x as { durationMin?: number }).durationMin) || 0)),
    note: String(x.note || '').slice(0, 500),
    priority: asPriority(x.priority),
    isPrimary: Boolean(x.isPrimary),
    notify: x.notify !== false,
    createdAt: String(x.createdAt || new Date().toISOString()),
    updatedAt: String(x.updatedAt || new Date().toISOString()),
  };
}

export function normalizeExamPlan(raw: unknown): ExamPlanRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Partial<ExamPlanRecord>;
  const stages = Array.isArray(x.stages)
    ? x.stages.map((s) => ({ title: String(s?.title || '').trim(), body: String(s?.body || '').trim() })).filter((s) => s.title || s.body)
    : [];
  return {
    examId: String(x.examId || ''),
    examDate: String(x.examDate || ''),
    summary: String(x.summary || ''),
    weekHint: String(x.weekHint || ''),
    advice: String(x.advice || ''),
    stages,
    lastWeek: String(x.lastWeek || ''),
    source: x.source === 'ai' ? 'ai' : 'local',
    model: x.model ? String(x.model) : undefined,
    createdAt: String(x.createdAt || new Date().toISOString()),
    pendingSchedule: x.pendingSchedule && typeof x.pendingSchedule === 'object' ? x.pendingSchedule as Schedule : null,
  };
}

export function seedTargetsFromLegacy(data: Pick<AppData, 'examDate' | 'grade' | 'examTargets'>): ExamTarget[] {
  if (data.examTargets?.length) return data.examTargets;
  if (!data.examDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.examDate)) return [];
  const g = data.grade.toLocaleLowerCase('tr-TR');
  const kind = data.grade.includes('KPSS') ? 'KPSS' : g.includes('lgs') || Number((data.grade.match(/^(\d+)/) || [])[1]) === 8 ? 'LGS' : 'YKS';
  const now = new Date().toISOString();
  return [{
    id: 'ex_legacy',
    title: kind,
    kind,
    origin: 'official' as const,
    date: data.examDate,
    startTime: '',
    endTime: '',
    durationMin: 0,
    note: '',
    priority: 'yuksek',
    isPrimary: true,
    notify: true,
    createdAt: now,
    updatedAt: now,
  }];
}

export function primaryExam(targets: ExamTarget[]): ExamTarget | null {
  if (!targets.length) return null;
  const marked = targets.find((t) => t.isPrimary);
  if (marked) return marked;
  return [...targets].sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function withPrimary(list: ExamTarget[], id: string): ExamTarget[] {
  const now = new Date().toISOString();
  return list.map((t) => ({ ...t, isPrimary: t.id === id, updatedAt: now }));
}

export function upsertExam(list: ExamTarget[], next: ExamTarget): ExamTarget[] {
  const row = { ...next, id: next.id || uid('ex_'), updatedAt: new Date().toISOString() };
  const exists = list.some((t) => t.id === row.id);
  let out = exists ? list.map((t) => (t.id === row.id ? row : t)) : [row, ...list];
  if (row.isPrimary) out = withPrimary(out, row.id);
  else if (!out.some((t) => t.isPrimary) && out[0]) out = withPrimary(out, out[0].id);
  return out;
}

export function addMinutesToTime(hhmm: string, minutes: number) {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || minutes <= 0) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  const h = Math.floor(total / 60) % 24;
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function withExamTimes(row: ExamTarget): ExamTarget {
  if (row.durationMin > 0 && row.startTime && !row.endTime) {
    return { ...row, endTime: addMinutesToTime(row.startTime, row.durationMin) };
  }
  return row;
}

export function examDateForLegacy(targets: ExamTarget[]): string {
  return primaryExam(targets)?.date || '';
}

export function splitExams(targets: ExamTarget[], today: string) {
  const upcoming = targets.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = targets.filter((t) => t.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

/** Yalnızca AI sınav planı; sınav, PDF, görev, randevu dokunulmaz. */
export function clearAiExamPlan(data: AppData): AppData {
  return { ...data, examPlan: null, examPlanDraft: null };
}
