import type { AppData } from './types';

export type GoalDraft = {
  name: string;
  grade: string;
  age: number;
  track: string;
  dept: string;
  rank: number;
  weekHours: number;
  examDate: string;
};

export const TRACKS = ['Eşit Ağırlık', 'Sayısal', 'Sözel', 'TYT', 'KPSS'] as const;

export const DEPT_PRESETS = [
  'Hukuk', 'Tıp', 'Diş Hekimliği', 'Eczacılık', 'Bilgisayar Mühendisliği',
  'Elektrik-Elektronik', 'İktisat', 'İşletme', 'Psikoloji', 'Öğretmenlik',
  'Siyaset Bilimi', 'Mimarlık', 'KPSS / Kamu',
];

export function clampAge(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(65, Math.max(6, Math.round(n)));
}

export function applyGoal(data: AppData, draft: GoalDraft): AppData {
  const grade = draft.grade;
  let track = draft.track;
  if (grade === 'KPSS Adayı') track = 'KPSS';
  return {
    ...data,
    grade,
    age: clampAge(draft.age),
    track,
    dept: draft.dept.trim(),
    rank: Number.isFinite(draft.rank) ? Math.max(0, Math.round(draft.rank)) : 0,
    weekHours: Number.isFinite(draft.weekHours) && draft.weekHours > 0 ? Math.max(1, draft.weekHours) : 0,
    examDate: draft.examDate || '',
  };
}

export function applyGradeKeepAge(data: AppData, grade: string): AppData {
  return applyGoal(data, {
    name: '',
    grade,
    age: data.age,
    track: data.track,
    dept: data.dept,
    rank: data.rank,
    weekHours: data.weekHours,
    examDate: data.examDate,
  });
}
