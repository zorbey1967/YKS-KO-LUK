import { describe, expect, it } from 'vitest';
import { examById, searchExamCatalog } from '../data/examCatalog';
import { scoreCatalogExam } from './examScore';
import { canCoachEditPlan, canStudentEditPlan, tytNet } from './weekPlan';

describe('deneme katalog ve net', () => {
  it('bilinmeyen sınav adı eşleşmez; anahtar uydurulmaz', () => {
    expect(searchExamCatalog('ÖSYM 2024 TYT kitapçığı')).toEqual([]);
    expect(examById('yok')).toBeNull();
  });

  it('platform alıştırmasında net ve konu zayıflığı doğrulanmış anahtarla gelir', () => {
    const exam = examById('ekoc-tyt-mat-a');
    expect(exam).toBeTruthy();
    const scored = scoreCatalogExam(exam!, [1, 3, 2, 0, 4]);
    expect(scored.correct).toBe(5);
    expect(scored.wrong).toBe(0);
    expect(scored.net).toBe(5);
    expect(scored.verifiedKey).toBe(true);
    const mixed = scoreCatalogExam(exam!, [1, 0, null, 0, 4]);
    expect(mixed.correct).toBe(3);
    expect(mixed.blank).toBe(1);
    expect(mixed.net).toBe(tytNet(3, 1));
  });
});

describe('haftalık program kilidi', () => {
  it('koç kilidinde öğrenci hedefi değiştirmez; atanmamış koç yazamaz', () => {
    expect(canStudentEditPlan('coach', true)).toBe(false);
    expect(canStudentEditPlan('self', false)).toBe(true);
    expect(canCoachEditPlan({ coachId: 'c1', assignedStudent: true, coachActive: true })).toBe(true);
    expect(canCoachEditPlan({ coachId: 'c1', assignedStudent: false, coachActive: true })).toBe(false);
  });
});
