import type { AppData } from './types';
import { curriculumForStudent, normalizeStudentTrack, type StudentTrackKind } from './curriculum';
import { gradeNumber } from './stage';

/** Türkiye okul yılı: Eylül–Ocak ≈ 1. dönem, Şubat–Haziran ≈ 2. dönem. */
export type AcademicPeriod = '1' | '2' | null;

export type EducationBand =
  | 'primary'
  | 'middle'
  | 'lgs'
  | 'high_early'
  | 'high_yks'
  | 'mezun'
  | 'kpss'
  | 'unknown';

export type StudentEducationContext = {
  grade: string;
  gradeNum: number;
  age: number;
  track: string;
  trackKind: StudentTrackKind;
  band: EducationBand;
  isYksPrep: boolean;
  isLgs: boolean;
  isKpss: boolean;
  showsSchoolWritten: boolean;
  showsTyt: boolean;
  showsAyt: boolean;
  period: AcademicPeriod;
  periodLabel: string;
  gradeLabel: string;
  fieldShort: string;
};

export type ExamEntryOption = {
  id: string;
  label: string;
  kind: string;
  needsSubject?: boolean;
  scoreMode: 'yazili' | 'lgs' | 'tyt' | 'ayt' | 'deneme' | 'kpss';
};

/** Okul yılı dönemini tarihten çıkarır (kırılgan sabit gün yok). */
export function academicPeriod(at: Date = new Date()): AcademicPeriod {
  const month = at.getMonth() + 1;
  if (month >= 9 || month === 1) return '1';
  if (month >= 2 && month <= 6) return '2';
  return null;
}

export function academicPeriodLabel(at: Date = new Date()): string {
  const p = academicPeriod(at);
  if (p === '1') return '1. Dönem';
  if (p === '2') return '2. Dönem';
  return '';
}

export function fieldShortLabel(kind: StudentTrackKind, track = ''): string {
  if (kind === 'ea') return 'EA';
  if (kind === 'say') return 'SAY';
  if (kind === 'soz') return 'SÖZ';
  if (kind === 'dil') return 'DİL';
  if (kind === 'tyt') return 'TYT';
  if (kind === 'kpss') return 'KPSS';
  const t = String(track || '').trim();
  return t || '';
}

export function educationBand(grade: string, track: string): EducationBand {
  if (!grade && !track) return 'unknown';
  if (grade.includes('KPSS') || normalizeStudentTrack(track) === 'kpss') return 'kpss';
  if (grade.includes('Mezun') || /yks/i.test(grade)) return 'mezun';
  const n = gradeNumber(grade);
  if (n >= 1 && n <= 4) return 'primary';
  if (n >= 5 && n <= 7) return 'middle';
  if (n === 8) return 'lgs';
  if (n === 9 || n === 10) return 'high_early';
  if (n === 11 || n === 12) return 'high_yks';
  return 'unknown';
}

export function getStudentEducationContext(data: Pick<AppData, 'grade' | 'age' | 'track'>, at: Date = new Date()): StudentEducationContext {
  const grade = String(data.grade || '');
  const track = String(data.track || '');
  const trackKind = normalizeStudentTrack(track);
  const gradeNum = gradeNumber(grade);
  const band = educationBand(grade, track);
  const isKpss = band === 'kpss';
  const isLgs = band === 'lgs';
  const yksPrep = band === 'high_yks' || band === 'mezun'
    || (band === 'unknown' && (trackKind === 'ea' || trackKind === 'say' || trackKind === 'soz' || trackKind === 'dil' || trackKind === 'tyt'));
  const period = academicPeriod(at);
  const periodLabel = academicPeriodLabel(at);
  const gradeLabel = grade || (yksPrep ? 'YKS' : '');
  return {
    grade,
    gradeNum,
    age: Number(data.age) || 0,
    track,
    trackKind,
    band,
    isYksPrep: yksPrep,
    isLgs,
    isKpss,
    showsSchoolWritten: !isKpss && band !== 'mezun' && gradeNum >= 1 && gradeNum <= 12,
    showsTyt: yksPrep,
    showsAyt: yksPrep && trackKind !== 'tyt' && trackKind !== 'kpss' && trackKind !== 'other',
    period,
    periodLabel,
    gradeLabel,
    fieldShort: fieldShortLabel(trackKind, track),
  };
}

/** Deneme sonuç ekranı seçenekleri — profil + alan. */
export function examResultEntryOptions(ctx: StudentEducationContext): ExamEntryOption[] {
  if (ctx.isKpss) {
    return [
      { id: 'kpss', label: 'KPSS Denemesi', kind: 'KPSS', scoreMode: 'kpss' },
    ];
  }
  if (ctx.isLgs) {
    return [
      { id: 'lgs', label: 'LGS Sınavı', kind: 'LGS', scoreMode: 'lgs' },
      { id: 'yazili', label: 'Yazılılar', kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
    ];
  }
  if (ctx.band === 'high_early') {
    return [
      { id: 'yazili', label: `${ctx.gradeLabel} Yazılıları`, kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
      { id: 'deneme', label: `${ctx.gradeLabel} Denemeleri`, kind: 'Deneme', scoreMode: 'deneme' },
    ];
  }
  if (ctx.band === 'high_yks') {
    const opts: ExamEntryOption[] = [
      { id: 'yazili', label: `${ctx.gradeLabel} Yazılıları`, kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
      { id: 'tyt', label: 'TYT Denemeleri', kind: 'TYT', scoreMode: 'tyt' },
    ];
    if (ctx.showsAyt && ctx.fieldShort) {
      opts.push({ id: 'ayt', label: `AYT ${ctx.fieldShort} Denemeleri`, kind: `AYT ${ctx.fieldShort}`, scoreMode: 'ayt' });
    }
    return opts;
  }
  if (ctx.band === 'mezun' || ctx.isYksPrep) {
    const opts: ExamEntryOption[] = [
      { id: 'tyt', label: 'TYT Denemesi', kind: 'TYT', scoreMode: 'tyt' },
    ];
    if (ctx.showsAyt && ctx.fieldShort) {
      opts.push({ id: 'ayt', label: `AYT ${ctx.fieldShort} Denemesi`, kind: `AYT ${ctx.fieldShort}`, scoreMode: 'ayt' });
    }
    return opts;
  }
  // primary / middle
  return [
    { id: 'yazili', label: 'Yazılı', kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
    { id: 'deneme', label: 'Deneme', kind: 'Deneme', scoreMode: 'deneme' },
  ];
}

/** Takvim / Sınav Merkezi ekleme seçenekleri. */
export function calendarExamEntryOptions(ctx: StudentEducationContext): ExamEntryOption[] {
  if (ctx.isKpss) {
    return [{ id: 'kpss', label: 'KPSS', kind: 'KPSS', scoreMode: 'kpss' }];
  }
  if (ctx.isLgs) {
    return [
      { id: 'lgs', label: 'LGS Sınavı', kind: 'LGS', scoreMode: 'lgs' },
      { id: 'yazili', label: 'Yazılılar', kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
    ];
  }
  if (ctx.band === 'mezun' || (ctx.isYksPrep && ctx.band === 'unknown')) {
    const opts: ExamEntryOption[] = [
      { id: 'tyt', label: 'TYT', kind: 'TYT', scoreMode: 'tyt' },
    ];
    if (ctx.fieldShort && ctx.showsAyt) {
      opts.push({ id: 'ayt', label: `AYT ${ctx.fieldShort}`, kind: `AYT ${ctx.fieldShort}`, scoreMode: 'ayt' });
    }
    return opts;
  }
  if (ctx.band === 'high_yks') {
    const opts: ExamEntryOption[] = [
      { id: 'yazili', label: 'Yazılı', kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
      { id: 'tyt', label: 'TYT', kind: 'TYT', scoreMode: 'tyt' },
    ];
    if (ctx.fieldShort && ctx.showsAyt) {
      opts.push({ id: 'ayt', label: `AYT ${ctx.fieldShort}`, kind: `AYT ${ctx.fieldShort}`, scoreMode: 'ayt' });
    }
    return opts;
  }
  return [
    { id: 'yazili', label: 'Yazılı', kind: 'Yazılı', needsSubject: true, scoreMode: 'yazili' },
    { id: 'deneme', label: 'Deneme', kind: 'Deneme', scoreMode: 'deneme' },
  ];
}

export function writtenSubjectOptions(data: Pick<AppData, 'grade' | 'track'>): string[] {
  const curr = curriculumForStudent(data.grade, data.track);
  return Object.keys(curr).filter((s) => !/^(TYT|AYT|YDT)\b/i.test(s));
}

export function autoExamTitle(
  ctx: StudentEducationContext,
  option: ExamEntryOption,
  subject = '',
): string {
  if (option.scoreMode === 'yazili' && subject) {
    const g = ctx.gradeLabel || 'Okul';
    return `${g} ${subject} Yazılısı`;
  }
  if (option.scoreMode === 'lgs') return 'LGS Denemesi';
  if (option.scoreMode === 'tyt') return 'TYT Denemesi';
  if (option.scoreMode === 'ayt') return ctx.fieldShort ? `AYT ${ctx.fieldShort} Denemesi` : 'AYT Denemesi';
  if (option.scoreMode === 'kpss') return 'KPSS Denemesi';
  if (option.scoreMode === 'deneme') {
    return ctx.gradeLabel ? `${ctx.gradeLabel} Denemesi` : 'Deneme';
  }
  return option.label;
}

export function aytFieldHint(ctx: StudentEducationContext): string {
  if (!ctx.showsAyt || !ctx.fieldShort) return '';
  if (ctx.trackKind === 'ea') return 'AYT Matematik ve Edebiyat';
  if (ctx.trackKind === 'say') return 'AYT Matematik ve Fizik';
  if (ctx.trackKind === 'soz') return 'AYT Edebiyat ve Tarih';
  if (ctx.trackKind === 'dil') return 'YDT İngilizce';
  return `AYT ${ctx.fieldShort}`;
}
