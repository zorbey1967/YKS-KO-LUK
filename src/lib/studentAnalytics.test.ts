import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import { buildAnalyticsBoard, analyticsFingerprint } from './studentAnalytics';
import { localAiCoachReport, requestAiCoachAnalysis } from './aiCoachAnalysis';

describe('öğrenci analiz paneli', () => {
  it('veri yokken sahte grafik üretmez', () => {
    const board = buildAnalyticsBoard(emptyData());
    expect(board.hasData).toBe(false);
    expect(board.tytSeries).toEqual([]);
    expect(board.subjects).toEqual([]);
    expect(board.weakAreas).toEqual([]);
    expect(localAiCoachReport(emptyData()).empty).toBe(true);
  });

  it('TYT/AYT ortalama, son net ve ders trendini kayıttan üretir', () => {
    const data = emptyData();
    data.exams = [
      { id: 'e1', name: 'D1', date: '2026-09-01', tyt: 18, ayt: 12, note: '' },
      { id: 'e2', name: 'D2', date: '2026-09-15', tyt: 22, ayt: 14, note: '' },
      { id: 'e3', name: 'D3', date: '2026-10-01', tyt: 25, ayt: 13, note: '' },
    ];
    data.calcs = [
      {
        id: 1,
        date: '2026-09-15',
        type: 'TYT',
        correct: 80,
        wrong: 20,
        blank: 20,
        net: 75,
        subjects: [
          { subject: 'Matematik', max: 40, correct: 24, wrong: 8, blank: 8, net: 22 },
          { subject: 'Edebiyat', max: 24, correct: 8, wrong: 10, blank: 6, net: 5.5 },
        ],
      },
      {
        id: 2,
        date: '2026-10-01',
        type: 'TYT',
        correct: 90,
        wrong: 10,
        blank: 20,
        net: 87.5,
        subjects: [
          { subject: 'Matematik', max: 40, correct: 28, wrong: 4, blank: 8, net: 27 },
          { subject: 'Edebiyat', max: 24, correct: 9, wrong: 10, blank: 5, net: 6.5 },
        ],
      },
    ];
    const board = buildAnalyticsBoard(data);
    expect(board.hasData).toBe(true);
    expect(board.lastTyt).toBe(25);
    expect(board.avgTyt).toBeCloseTo(21.666, 2);
    expect(board.maxNet).toBe(87.5);
    const mat = board.subjects.find((s) => s.name === 'Matematik');
    expect(mat?.last).toBe(27);
    expect(mat?.trend).toBe('up');
    expect(board.weakAreas[0]).toBe('Edebiyat');
    const withExamSubjects = emptyData();
    withExamSubjects.exams = [{ id: 'e', name: 'D', date: '2026-10-01', tyt: 20, ayt: 0, note: '', subjects: [{ name: 'Tarih', net: 4 }] }];
    expect(buildAnalyticsBoard(withExamSubjects).subjects.some((s) => s.name === 'Tarih')).toBe(true);
    expect(localAiCoachReport(data).empty).toBe(false);
    expect(analyticsFingerprint(data)).not.toBe(analyticsFingerprint(emptyData()));
    const onlyExam = emptyData();
    onlyExam.exams = [{
      id: 'x', name: 'Foto', date: '2026-10-02', tyt: 40, ayt: 12, note: '',
      correct: 90, wrong: 8, blank: 2,
      subjects: [{ name: 'Matematik', net: 31 }],
    }];
    const rows = buildAnalyticsBoard(onlyExam).examRows;
    expect(rows[0].correct).toBe(90);
    expect(rows[0].subjects[0].net).toBe(31);
    const edited = { ...onlyExam, exams: [{ ...onlyExam.exams[0], subjects: [{ name: 'Matematik', net: 20 }] }] };
    expect(analyticsFingerprint(edited)).not.toBe(analyticsFingerprint(onlyExam));
    expect(buildAnalyticsBoard(edited).subjects.find((s) => s.name === 'Matematik')?.last).toBe(20);
  });

  it('veri yokken AI istek atmaz', async () => {
    const out = await requestAiCoachAnalysis(emptyData());
    expect(out.empty).toBe(true);
    expect(out.narrative).toBe('');
  });
});
