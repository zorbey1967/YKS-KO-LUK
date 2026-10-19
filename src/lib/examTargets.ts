import type { AppData, ExamNotifyPrefs, ExamPlanRecord, ExamPriority, ExamTarget, Schedule } from './types';
import { uid } from './util';
import { calendarDaysUntil } from './countdown';
import { istanbulToday } from './meeting';

export type { ExamTarget, ExamPriority, ExamNotifyPrefs };

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
    topics: [],
    priority: 'normal',
    isPrimary: false,
    notify: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Konu etiketleri: boşluk kırpılır, tekrar ve aşırı uzunluk atılır (en çok 12). */
export function normalizeTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const t = String(x || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (t && !out.some((o) => o.toLocaleLowerCase('tr-TR') === t.toLocaleLowerCase('tr-TR'))) out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

/** "Türev, İntegral; Limit" → ['Türev', 'İntegral', 'Limit'] */
export function splitTopicInput(text: string): string[] {
  return normalizeTopics(String(text || '').split(/[,;\n]/));
}

/** Serbest metinden (ZORRO, eski kayıt) sınav türü tahmini. */
export function inferExamKind(text: string): string {
  const t = String(text || '').toLocaleLowerCase('tr-TR');
  if (/\bayt\b/.test(t)) return 'AYT';
  if (/\btyt\b/.test(t)) return 'TYT';
  if (/\blgs\b/.test(t)) return 'LGS';
  if (/kpss/.test(t)) return 'KPSS';
  if (/bütünleme|butunleme/.test(t)) return 'Bütünleme';
  if (/\bvize\b/.test(t)) return 'Vize';
  if (/\bfinal\b/.test(t)) return 'Final';
  if (/yazılı|yazili/.test(t)) return 'Yazılı';
  return 'Deneme';
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
    topics: normalizeTopics((x as { topics?: unknown }).topics),
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

export function examDateForLegacy(targets: ExamTarget[]): string {
  return primaryExam(targets)?.date || '';
}

export type ExamStatus = 'upcoming' | 'today' | 'awaiting_result' | 'done';

/** Sınav kartı durumu: yaklaşan, bugün, sonuç bekliyor, sonuç girildi. */
export function examStatus(data: Pick<AppData, 'exams'>, exam: ExamTarget, today = istanbulToday()): ExamStatus {
  const hasResult = data.exams.some((e) => e.targetId === exam.id || (e.date === exam.date && e.name === exam.title));
  if (hasResult) return 'done';
  if (exam.date === today) return 'today';
  if (exam.date > today) return 'upcoming';
  return 'awaiting_result';
}

export function examStatusLabel(status: ExamStatus, daysLeft: number): string {
  if (status === 'done') return 'Sonuç girildi';
  if (status === 'today') return 'Bugün';
  if (status === 'awaiting_result') return 'Sonuç bekliyor';
  if (daysLeft === 1) return 'Yarın';
  return `${daysLeft} gün kaldı`;
}

/** Bugün ve sonrası, tarihe göre. */
export function upcomingExams(targets: ExamTarget[], today = istanbulToday()): ExamTarget[] {
  return targets.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'tr'));
}

export function examDaysLeft(exam: Pick<ExamTarget, 'date'>, today = istanbulToday()): number {
  return calendarDaysUntil(exam.date, today);
}

/** Renk/ikon grubu: takvim rozetleri ve kartlar aynı tonu kullanır. */
export type ExamTone = 'tyt' | 'ayt' | 'school' | 'uni' | 'lgs' | 'kpss' | 'deneme' | 'other';
export function examKindTone(kind: string): ExamTone {
  const k = String(kind || '').toLocaleLowerCase('tr-TR');
  if (/\btyt\b|\byks\b/.test(k)) return 'tyt';
  if (/\bayt\b|ydt/.test(k)) return 'ayt';
  if (/yazılı|yazili/.test(k)) return 'school';
  if (/vize|final|bütünleme|butunleme|üniversite/.test(k)) return 'uni';
  if (/lgs/.test(k)) return 'lgs';
  if (/kpss/.test(k)) return 'kpss';
  if (/deneme/.test(k)) return 'deneme';
  return 'other';
}

const TONE_ICON: Record<ExamTone, string> = {
  tyt: '📘', ayt: '📗', school: '✏️', uni: '🎓', lgs: '📙', kpss: '📕', deneme: '📝', other: '📌',
};
/** Tür ikonu: takvim, kart ve form aynı ikonu kullanır. */
export function examKindIcon(kind: string): string {
  return TONE_ICON[examKindTone(kind)];
}

export function fmtExamDateLong(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'UTC' });
}

export function fmtExamDateShort(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** AI planı bu sınava bağlı mı (silince / tarih değişince plan güncellenmeli). */
export function examPlanLinked(data: Pick<AppData, 'examPlan' | 'examPlanDraft'>, exam: Pick<ExamTarget, 'id'>): boolean {
  return data.examPlan?.examId === exam.id || data.examPlanDraft?.examId === exam.id;
}

/**
 * Sınavı siler ve cihazlar arası senkronda geri gelmemesi için examTarget mezar taşı bırakır.
 * Ana sınav silinirse bir sonraki sınav ana olur; legacy examDate güncellenir; bağlı AI planı kalkar.
 * Görev, program, deneme sonucu ve PDF'e dokunmaz.
 */
export function removeExamTarget(data: AppData, id: string, at = new Date().toISOString()): AppData {
  const gone = (data.examTargets || []).find((t) => t.id === id);
  if (!gone) return data;
  let next = (data.examTargets || []).filter((t) => t.id !== id);
  if (gone.isPrimary && next.length) {
    const nextPrimary = upcomingExams(next)[0] || next[0];
    next = withPrimary(next, nextPrimary.id);
  }
  const clearPlan = examPlanLinked(data, gone);
  const stones = data.tombstones || [];
  const tombstones = stones.some((t) => t.kind === 'examTarget' && t.id === id)
    ? stones
    : [...stones, { kind: 'examTarget' as const, id, at }];
  return {
    ...data,
    examTargets: next,
    examDate: examDateForLegacy(next) || '',
    examPlan: clearPlan ? null : data.examPlan,
    examPlanDraft: clearPlan ? null : data.examPlanDraft,
    tombstones,
  };
}

/** Kaydet: ekle veya güncelle; ana sınav tekil; legacy examDate senkron. */
export function saveExamTarget(data: AppData, row: ExamTarget): AppData {
  const examTargets = upsertExam(data.examTargets || [], {
    ...row,
    topics: normalizeTopics(row.topics),
    startTime: '',
    endTime: '',
    durationMin: 0,
  });
  return { ...data, examTargets, examDate: examDateForLegacy(examTargets) || data.examDate };
}

/** Yalnızca AI sınav planı; sınav, PDF, görev, randevu dokunulmaz. */
export function clearAiExamPlan(data: AppData): AppData {
  return { ...data, examPlan: null, examPlanDraft: null };
}
