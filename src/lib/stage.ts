import type { AppData } from './types';

export const GRADES = [
  '1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf',
  '5. Sınıf', '6. Sınıf', '7. Sınıf', '8. Sınıf',
  '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf',
  'Mezun / YKS', 'KPSS Adayı',
] as const;

export function gradeNumber(grade: string) {
  const m = grade.match(/^(\d+)/);
  if (m) return Number(m[1]);
  if (!grade) return 0;
  return grade.includes('KPSS') ? 20 : 13;
}

export function typicalAge(grade: string) {
  if (!grade) return 0;
  const n = gradeNumber(grade);
  if (n <= 12) return 5 + n;
  if (grade.includes('KPSS')) return 24;
  return 18;
}

export function examKind(data: AppData): 'YKS' | 'KPSS' | 'Okul' {
  if (data.track === 'KPSS' || data.grade === 'KPSS Adayı') return 'KPSS';
  if (!data.grade) {
    if (data.track === 'Sayısal' || data.track === 'Sözel' || data.track === 'Eşit Ağırlık' || data.track === 'TYT') return 'YKS';
    return 'Okul';
  }
  const n = gradeNumber(data.grade);
  if (data.grade.includes('Mezun') || n === 11 || n === 12) return 'YKS';
  return 'Okul';
}

export function showsYks(data: AppData) {
  return examKind(data) === 'YKS';
}

export function showsKpss(data: AppData) {
  return examKind(data) === 'KPSS';
}

export function examTitle(data: AppData) {
  if (!data.grade && !data.track) return 'Öğrenci';
  const k = examKind(data);
  if (k === 'KPSS') return 'KPSS';
  if (k === 'YKS') return 'YKS';
  return 'Okul';
}

export function ageBand(age: number) {
  if (age <= 0) return 'belirsiz';
  if (age <= 9) return 'ilkokul';
  if (age <= 13) return 'ortaokul';
  if (age <= 16) return 'lise-alt';
  if (age <= 19) return 'lise-yks';
  return 'yetiskin';
}

export function suggestedDailyMinutes(age: number, kind: 'YKS' | 'KPSS' | 'Okul') {
  if (age > 0 && age <= 9) return 60;
  if (age > 0 && age <= 13) return 120;
  if (kind === 'KPSS') return 180;
  if (kind === 'YKS') return 240;
  return 150;
}
