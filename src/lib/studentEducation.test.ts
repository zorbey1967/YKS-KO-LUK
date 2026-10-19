import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import {
  academicPeriod,
  academicPeriodLabel,
  autoExamTitle,
  calendarExamEntryOptions,
  examResultEntryOptions,
  getStudentEducationContext,
  matchExamEntryOption,
  writtenSubjectOptions,
} from './studentEducation';
import { curriculumForStudent } from './curriculum';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function student(grade: string, track: string) {
  const d = emptyData();
  d.grade = grade;
  d.track = track;
  return d;
}

describe('studentEducationContext', () => {
  it('akademik dönem Ekim→1, Mart→2', () => {
    expect(academicPeriod(new Date('2026-10-16T12:00:00'))).toBe('1');
    expect(academicPeriodLabel(new Date('2026-10-16T12:00:00'))).toBe('1. Dönem');
    expect(academicPeriod(new Date('2026-03-10T12:00:00'))).toBe('2');
    expect(academicPeriodLabel(new Date('2026-03-10T12:00:00'))).toBe('2. Dönem');
  });

  it('8. sınıf → LGS + Yazılı; dönem seçtirmez', () => {
    const ctx = getStudentEducationContext(student('8. Sınıf', ''));
    expect(ctx.isLgs).toBe(true);
    const opts = examResultEntryOptions(ctx);
    expect(opts.map((o) => o.id).sort()).toEqual(['lgs', 'yazili'].sort());
    expect(opts.every((o) => !/Bursluluk|Üniversite|Diğer|KPSS/.test(o.label))).toBe(true);
  });

  it('10. sınıf EA → yazılı + deneme; AYT/TYT yok; konular YKS ağacı değil', () => {
    const d = student('10. Sınıf', 'Eşit Ağırlık');
    const ctx = getStudentEducationContext(d);
    expect(ctx.band).toBe('high_early');
    const opts = examResultEntryOptions(ctx);
    expect(opts.some((o) => o.id === 'yazili')).toBe(true);
    expect(opts.some((o) => o.id === 'tyt' || o.id === 'ayt')).toBe(false);
    const keys = Object.keys(curriculumForStudent(d.grade, d.track));
    expect(keys.some((k) => /^AYT\b/.test(k))).toBe(false);
    expect(keys.some((k) => /^TYT\b/.test(k))).toBe(false);
    expect(keys).toContain('Matematik');
    expect(keys).toContain('Türk Dili ve Edebiyatı');
    expect(keys).not.toContain('Fizik');
  });

  it('12. sınıf EA 1. dönem → müfredatta TYT + AYT EA (yalnızca TYT değil)', () => {
    const d = student('12. Sınıf', 'Eşit Ağırlık');
    const ctx = getStudentEducationContext(d, new Date('2026-10-16T12:00:00'));
    expect(ctx.period).toBe('1');
    expect(ctx.showsTyt).toBe(true);
    expect(ctx.showsAyt).toBe(true);
    const keys = Object.keys(curriculumForStudent(d.grade, d.track));
    expect(keys.some((k) => /^TYT\b/.test(k))).toBe(true);
    expect(keys).toContain('AYT Matematik');
    expect(keys).toContain('AYT Edebiyat');
    expect(keys).not.toContain('AYT Fizik');
  });

  it('11. sınıf SAY → yazılı + TYT + AYT SAY; EA AYT yok', () => {
    const d = student('11. Sınıf', 'Sayısal');
    const ctx = getStudentEducationContext(d);
    const opts = examResultEntryOptions(ctx);
    expect(opts.map((o) => o.id)).toEqual(expect.arrayContaining(['yazili', 'tyt', 'ayt']));
    expect(opts.find((o) => o.id === 'ayt')?.label).toMatch(/AYT SAY/);
    const keys = Object.keys(curriculumForStudent(d.grade, d.track));
    expect(keys).toContain('TYT Matematik');
    expect(keys).toContain('AYT Fizik');
    expect(keys).not.toContain('AYT Edebiyat');
    expect(keys).toContain('Fizik');
    expect(keys).not.toContain('Tarih');
  });

  it('11. sınıf EA → AYT EA; SAY konular yok', () => {
    const d = student('11. Sınıf', 'Eşit Ağırlık');
    const keys = Object.keys(curriculumForStudent(d.grade, d.track));
    expect(keys).toContain('AYT Edebiyat');
    expect(keys).not.toContain('AYT Fizik');
    expect(keys).toContain('Türk Dili ve Edebiyatı');
    expect(keys).not.toContain('Biyoloji');
  });

  it('Mezun SAY → yalnızca TYT + AYT SAY deneme seçenekleri', () => {
    const ctx = getStudentEducationContext(student('Mezun / YKS', 'Sayısal'));
    const opts = examResultEntryOptions(ctx);
    expect(opts.map((o) => o.id).sort()).toEqual(['ayt', 'tyt'].sort());
    expect(opts.some((o) => o.needsSubject)).toBe(false);
  });

  it('otomatik sınav adı dönem sormadan üretilir', () => {
    const ctx = getStudentEducationContext(student('10. Sınıf', 'Eşit Ağırlık'));
    const yazili = examResultEntryOptions(ctx).find((o) => o.id === 'yazili')!;
    expect(autoExamTitle(ctx, yazili, 'Coğrafya')).toBe('10. Sınıf Coğrafya Yazılısı');
  });

  it('takvim türleri sınıfa göre: ilkokul/ortaokul, lise, mezun, üniversite, KPSS', () => {
    const labels = (g: string, t = '') => calendarExamEntryOptions(getStudentEducationContext(student(g, t))).map((o) => o.label);
    expect(labels('4. Sınıf')).toEqual(['Yazılı', 'Deneme', 'Diğer']);
    expect(labels('6. Sınıf')).toEqual(['Yazılı', 'Deneme', 'Diğer']);
    expect(labels('8. Sınıf')).toEqual(['Yazılı', 'LGS', 'Deneme', 'Diğer']);
    expect(labels('10. Sınıf', 'Sayısal')).toEqual(['Yazılı', 'TYT', 'AYT SAY', 'Deneme', 'Diğer']);
    expect(labels('10. Sınıf', '')).toEqual(['Yazılı', 'TYT', 'AYT', 'Deneme', 'Diğer']);
    expect(labels('12. Sınıf', 'Sözel')).toContain('AYT SÖZ');
    expect(labels('Mezun / YKS', 'Dil')).toContain('AYT DİL');
    expect(labels('11. Sınıf', 'Sayısal')).toEqual(['Yazılı', 'TYT', 'AYT SAY', 'Deneme', 'Diğer']);
    expect(labels('Mezun / YKS', 'Eşit Ağırlık')).toEqual(['TYT', 'AYT EA', 'Deneme', 'Diğer']);
    expect(labels('Üniversite')).toEqual(['Vize', 'Final', 'Bütünleme', 'Diğer']);
    expect(labels('KPSS Adayı', 'KPSS')).toEqual(['KPSS', 'Deneme', 'Diğer']);
    expect(writtenSubjectOptions(student('10. Sınıf', 'Sayısal'))).toContain('Matematik');
  });

  it('otomatik ad: yazılı dersle, üniversite dersle, Diğer boş (öğrenci yazar)', () => {
    const lise = getStudentEducationContext(student('11. Sınıf', 'Sayısal'));
    const yazili = calendarExamEntryOptions(lise).find((o) => o.id === 'yazili')!;
    expect(autoExamTitle(lise, yazili, 'Fizik')).toBe('11. Sınıf Fizik Yazılısı');
    const uni = getStudentEducationContext(student('Üniversite', ''));
    const vize = calendarExamEntryOptions(uni).find((o) => o.id === 'vize')!;
    expect(autoExamTitle(uni, vize, 'Analiz I')).toBe('Analiz I Vize');
    expect(vize.subjectInput).toBe('text');
    const diger = calendarExamEntryOptions(uni).find((o) => o.id === 'diger')!;
    expect(autoExamTitle(uni, diger)).toBe('');
    expect(diger.freeTitle).toBe(true);
  });

  it('eski kayıt türü seçeneğe eşlenir; bilinmeyen tür Diğer olur', () => {
    const ctx = getStudentEducationContext(student('11. Sınıf', 'Sayısal'));
    const opts = calendarExamEntryOptions(ctx);
    expect(matchExamEntryOption(opts, 'AYT SAY').id).toBe('ayt');
    expect(matchExamEntryOption(opts, 'AYT').id).toBe('ayt');
    expect(matchExamEntryOption(opts, 'Okul yazılısı').id).toBe('yazili');
    expect(matchExamEntryOption(opts, 'Bursluluk').id).toBe('diger');
  });

  it('ExamForm / ExamsPage serbest sınav türü listesini kullanmaz', () => {
    const form = readFileSync(join(process.cwd(), 'src/components/ExamForm.tsx'), 'utf8');
    const page = readFileSync(join(process.cwd(), 'src/pages/ExamsPage.tsx'), 'utf8');
    expect(form).not.toContain('EXAM_KIND_OPTIONS');
    expect(form).toContain('calendarExamEntryOptions');
    expect(page).toContain('useExamDialogs');
    expect(page).not.toContain('Deneme ekle');
    // Saat / süre / bitiş saati alanı yok (yalnızca tarih).
    expect(form).not.toMatch(/type="time"|startTime: e\.|durationMin: Number|Bitiş saati|Süre \(dk\)/);
    expect(form).toContain('type="date"');
    expect(page).not.toMatch(/Bursluluk|Üniversite/);
  });
});

