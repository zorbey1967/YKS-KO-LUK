import type { AppData, Exam, ExamSubjectNet, ExamTarget } from './types';
import { getStudentEducationContext, type StudentEducationContext } from './studentEducation';
import { tytNet } from './weekPlan';
import { uid } from './util';

export type ExamResultMode = 'yazili' | 'deneme' | 'tyt' | 'ayt' | 'lgs' | 'kpss' | 'yks';

export function examResultMode(kind: string): ExamResultMode {
  const k = String(kind || '').toLocaleLowerCase('tr-TR');
  if (/yazılı|yazili/.test(k)) return 'yazili';
  if (/lgs/.test(k)) return 'lgs';
  if (/kpss/.test(k)) return 'kpss';
  if (/\bayt\b/.test(k)) return 'ayt';
  if (/\btyt\b/.test(k)) return 'tyt';
  if (/\byks\b/.test(k)) return 'yks';
  if (/deneme/.test(k)) return 'deneme';
  return 'deneme';
}

export function isWrittenExamKind(kind: string) {
  return examResultMode(kind) === 'yazili';
}

/** Ders satırları — sınıf/alan/sınav türüne göre. */
export function denemeSubjectRows(ctx: StudentEducationContext, kind: string): string[] {
  const mode = examResultMode(kind);
  if (mode === 'yazili') return [];
  if (mode === 'lgs') return ['Türkçe', 'Matematik', 'Fen', 'İnkılap', 'Din', 'İngilizce'];
  if (mode === 'kpss') return ['GY Türkçe', 'GY Matematik', 'GK Tarih', 'GK Coğrafya'];
  if (mode === 'tyt' || mode === 'yks' || mode === 'deneme') {
    if (ctx.band === 'high_early' || ctx.band === 'primary' || ctx.band === 'middle') {
      return writtenSchoolSubjects(ctx);
    }
    return ['Türkçe', 'Matematik', 'Sosyal', 'Fen'];
  }
  if (mode === 'ayt') {
    if (ctx.trackKind === 'say') return ['Matematik', 'Fizik', 'Kimya', 'Biyoloji'];
    if (ctx.trackKind === 'ea') return ['Matematik', 'Edebiyat', 'Tarih-1', 'Coğrafya-1'];
    if (ctx.trackKind === 'soz') return ['Edebiyat', 'Tarih-1', 'Coğrafya-1', 'Sosyal-2'];
    if (ctx.trackKind === 'dil') return ['İngilizce'];
    return ['Matematik', 'Edebiyat'];
  }
  return ['Türkçe', 'Matematik'];
}

function writtenSchoolSubjects(ctx: StudentEducationContext): string[] {
  if (ctx.trackKind === 'say') return ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türk Dili ve Edebiyatı'];
  if (ctx.trackKind === 'ea') return ['Matematik', 'Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya'];
  if (ctx.trackKind === 'soz') return ['Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya', 'Felsefe'];
  if (ctx.trackKind === 'dil') return ['İngilizce', 'Türk Dili ve Edebiyatı'];
  return ['Matematik', 'Türk Dili ve Edebiyatı'];
}

export function emptySubjectRows(names: string[]): ExamSubjectNet[] {
  return names.map((name) => ({ name, net: 0, correct: 0, wrong: 0, blank: 0 }));
}

export function subjectNetFromDyb(correct: number, wrong: number): number {
  return tytNet(Math.max(0, correct), Math.max(0, wrong));
}

export function totalNetFromSubjects(subjects: ExamSubjectNet[]): number {
  return Math.round(subjects.reduce((a, s) => a + (Number(s.net) || 0), 0) * 100) / 100;
}

export function findExamForTarget(data: AppData, target: ExamTarget): Exam | undefined {
  return data.exams.find((e) => e.targetId === target.id)
    || data.exams.find((e) => e.date === target.date && e.name === target.title);
}

export function upsertExamResult(
  data: AppData,
  target: ExamTarget,
  patch: {
    subjects?: ExamSubjectNet[];
    tyt?: number;
    ayt?: number;
    correct?: number;
    wrong?: number;
    blank?: number;
    note?: string;
  },
): AppData {
  const existing = findExamForTarget(data, target);
  const mode = examResultMode(target.kind);
  const subjects = (patch.subjects || []).map((s) => ({
    ...s,
    net: s.correct != null || s.wrong != null
      ? subjectNetFromDyb(Number(s.correct) || 0, Number(s.wrong) || 0)
      : Number(s.net) || 0,
  }));
  const sum = subjects.length ? totalNetFromSubjects(subjects) : 0;
  const tyt = mode === 'ayt'
    ? (patch.tyt ?? existing?.tyt ?? 0)
    : (patch.tyt != null ? patch.tyt : (subjects.length ? sum : (patch.tyt ?? 0)));
  const ayt = mode === 'ayt'
    ? (patch.ayt != null ? patch.ayt : (subjects.length ? sum : 0))
    : (patch.ayt ?? existing?.ayt ?? 0);
  const row: Exam = {
    id: existing?.id || uid('e_'),
    name: target.title,
    date: target.date,
    tyt,
    ayt,
    note: patch.note ?? existing?.note ?? '',
    correct: patch.correct,
    wrong: patch.wrong,
    blank: patch.blank,
    subjects: subjects.length ? subjects : existing?.subjects,
    targetId: target.id,
    kind: target.kind,
  };
  const exams = existing
    ? data.exams.map((e) => (e.id === existing.id ? row : e))
    : [...data.exams, row];
  return { ...data, exams };
}

export function resultSubjectsForTarget(data: Pick<AppData, 'grade' | 'age' | 'track'>, target: ExamTarget): ExamSubjectNet[] {
  const ctx = getStudentEducationContext(data);
  return emptySubjectRows(denemeSubjectRows(ctx, target.kind));
}
