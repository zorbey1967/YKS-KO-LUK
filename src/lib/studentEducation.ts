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
  | 'university'
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
  isUniversity: boolean;
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
  /** Ders sorulur: müfredattan seçim (okul) veya serbest metin (üniversite). */
  needsSubject?: boolean;
  subjectInput?: 'select' | 'text';
  /** "Diğer": adı öğrenci yazar. */
  freeTitle?: boolean;
  scoreMode: 'yazili' | 'lgs' | 'tyt' | 'ayt' | 'deneme' | 'kpss' | 'universite' | 'diger';
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
  if (/üniversite|universite/i.test(grade)) return 'university';
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
    isUniversity: band === 'university',
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

const OPT_YAZILI: ExamEntryOption = { id: 'yazili', label: 'Yazılı', kind: 'Yazılı', needsSubject: true, subjectInput: 'select', scoreMode: 'yazili' };
const OPT_DENEME: ExamEntryOption = { id: 'deneme', label: 'Deneme', kind: 'Deneme', scoreMode: 'deneme' };
const OPT_DIGER: ExamEntryOption = { id: 'diger', label: 'Diğer', kind: 'Diğer', freeTitle: true, scoreMode: 'diger' };
const OPT_TYT: ExamEntryOption = { id: 'tyt', label: 'TYT', kind: 'TYT', scoreMode: 'tyt' };

/** AYT alanları; öğrencinin alanı kayıtlıysa doğrudan o, değilse formda alan sorulur. */
export const AYT_FIELDS = ['SAY', 'EA', 'SÖZ', 'DİL'] as const;

function hasAytField(ctx: StudentEducationContext) {
  return ctx.trackKind === 'say' || ctx.trackKind === 'ea' || ctx.trackKind === 'soz' || ctx.trackKind === 'dil';
}

function aytOption(ctx: StudentEducationContext): ExamEntryOption {
  const f = hasAytField(ctx) ? ` ${ctx.fieldShort}` : '';
  return { id: 'ayt', label: `AYT${f}`, kind: `AYT${f}`, scoreMode: 'ayt' };
}

/**
 * Takvimden sınav ekleme türleri — yalnızca sınıf/yaşa göre (tarih dışında alan yok).
 *   İlkokul / ortaokul: Yazılı, Deneme, Diğer (8. sınıfta LGS eklenir)
 *   Lise (9–12):        Yazılı, TYT, AYT, Deneme, Diğer
 *   Mezun:              TYT, AYT, Deneme, Diğer
 *   Üniversite:         Vize, Final, Bütünleme, Diğer
 *   KPSS:               KPSS, Deneme, Diğer
 */
export function calendarExamEntryOptions(ctx: StudentEducationContext): ExamEntryOption[] {
  if (ctx.isKpss) {
    return [{ id: 'kpss', label: 'KPSS', kind: 'KPSS', scoreMode: 'kpss' }, OPT_DENEME, OPT_DIGER];
  }
  if (ctx.isUniversity) {
    const uni = (id: string, label: string): ExamEntryOption => ({
      id, label, kind: label, needsSubject: true, subjectInput: 'text', scoreMode: 'universite',
    });
    return [uni('vize', 'Vize'), uni('final', 'Final'), uni('butunleme', 'Bütünleme'), OPT_DIGER];
  }
  if (ctx.isLgs) {
    return [OPT_YAZILI, { id: 'lgs', label: 'LGS', kind: 'LGS', scoreMode: 'lgs' }, OPT_DENEME, OPT_DIGER];
  }
  if (ctx.band === 'high_early' || ctx.band === 'high_yks') {
    return [OPT_YAZILI, OPT_TYT, aytOption(ctx), OPT_DENEME, OPT_DIGER];
  }
  if (ctx.band === 'mezun' || (ctx.band === 'unknown' && ctx.isYksPrep)) {
    return [OPT_TYT, aytOption(ctx), OPT_DENEME, OPT_DIGER];
  }
  return [OPT_YAZILI, OPT_DENEME, OPT_DIGER];
}

/** Kayıtlı sınavın türünü seçenek listesinde bulur (eski serbest türler "Diğer"e düşer). */
export function matchExamEntryOption(options: ExamEntryOption[], kind: string): ExamEntryOption {
  const k = String(kind || '').trim().toLocaleLowerCase('tr-TR');
  const exact = options.find((o) => o.kind.toLocaleLowerCase('tr-TR') === k);
  if (exact) return exact;
  const head = k.split(/\s+/)[0];
  const byHead = options.find((o) => o.kind.toLocaleLowerCase('tr-TR').split(/\s+/)[0] === head);
  if (byHead) return byHead;
  if (/yazılı|yazili/.test(k)) return options.find((o) => o.id === 'yazili') || options[options.length - 1];
  return options.find((o) => o.id === 'diger') || options[options.length - 1];
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
  const ders = String(subject || '').trim();
  if (option.scoreMode === 'yazili' && ders) {
    const g = ctx.gradeLabel || 'Okul';
    return `${g} ${ders} Yazılısı`;
  }
  if (option.scoreMode === 'universite') return ders ? `${ders} ${option.label}` : option.label;
  if (option.scoreMode === 'lgs') return 'LGS Denemesi';
  if (option.scoreMode === 'tyt') return 'TYT Denemesi';
  if (option.scoreMode === 'ayt') return `${option.kind} Denemesi`;
  if (option.scoreMode === 'kpss') return 'KPSS Denemesi';
  if (option.scoreMode === 'deneme') {
    return ctx.gradeLabel ? `${ctx.gradeLabel} Denemesi` : 'Deneme';
  }
  if (option.scoreMode === 'diger') return '';
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
