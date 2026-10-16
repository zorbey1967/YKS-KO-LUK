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
    expect(localAiCoachReport(data).empty).toBe(false);
    expect(analyticsFingerprint(data)).not.toBe(analyticsFingerprint(emptyData()));
  });

  it('veri yokken AI istek atmaz', async () => {
    const out = await requestAiCoachAnalysis(emptyData());
    expect(out.empty).toBe(true);
    expect(out.narrative).toBe('');
  });
});
