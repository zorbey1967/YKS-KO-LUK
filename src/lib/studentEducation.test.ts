import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import {
  academicPeriod,
  academicPeriodLabel,
  autoExamTitle,
  calendarExamEntryOptions,
  examResultEntryOptions,
  getStudentEducationContext,
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

  it('takvim seçenekleri 10. sınıfta Yazılı/Deneme; Bursluluk yok', () => {
    const ctx = getStudentEducationContext(student('10. Sınıf', 'Sayısal'));
    const opts = calendarExamEntryOptions(ctx);
    expect(opts.map((o) => o.label)).toEqual(['Yazılı', 'Deneme']);
    expect(writtenSubjectOptions(student('10. Sınıf', 'Sayısal'))).toContain('Matematik');
  });

  it('ExamForm / ExamsPage serbest sınav türü listesini kullanmaz', () => {
    const form = readFileSync(join(process.cwd(), 'src/components/ExamForm.tsx'), 'utf8');
    const page = readFileSync(join(process.cwd(), 'src/pages/ExamsPage.tsx'), 'utf8');
    expect(form).not.toContain('EXAM_KIND_OPTIONS');
    expect(form).toContain('calendarExamEntryOptions');
    expect(page).toContain('examResultEntryOptions');
    expect(page).not.toMatch(/Bursluluk|Üniversite/);
  });
});
