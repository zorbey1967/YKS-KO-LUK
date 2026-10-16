import { describe, expect, it } from 'vitest';
import { examById, searchExamCatalog } from '../data/examCatalog';
import { scoreCatalogExam } from './examScore';
import { canCoachEditPlan, canStudentEditPlan, tytNet, weekPlanFromSchedule } from './weekPlan';
import { emptySchedule } from './types';

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

  it('öğrenci programı koç kaynağından ayrılır', () => {
    const sch = { ...emptySchedule(), days: [{ day: 'Pazartesi', blocks: [{ title: 'Mat', minutes: 40, icon: '📘' }] }], source: 'self', notes: 'ev' };
    const plan = weekPlanFromSchedule(sch, 12);
    expect(plan.lock).toBe('self');
    expect(plan.days[0].blocks[0].title).toBe('Mat');
    expect(plan.weekHours).toBe(12);
  });
});
