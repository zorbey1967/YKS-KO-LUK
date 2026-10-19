import { describe, expect, it } from 'vitest';
import { emptyData, type AppData, type ExamTarget } from './types';
import {
  emptyExamTarget,
  examKindTone,
  examStatus,
  examStatusLabel,
  inferExamKind,
  normalizeExamTarget,
  normalizeTopics,
  primaryExam,
  removeExamTarget,
  saveExamTarget,
  splitTopicInput,
  upcomingExams,
} from './examTargets';
import { mergeAppData, mergeExamTargets } from './syncMerge';
import { normalizeData } from './storage';
import { examResultMode } from './examResultEntry';

function exam(p: Partial<ExamTarget> & { id: string; date: string }): ExamTarget {
  return { ...emptyExamTarget(), title: p.id, kind: 'TYT', ...p };
}

function withExams(list: ExamTarget[]): AppData {
  return { ...emptyData(), examTargets: list };
}

describe('sınav kaydı: yalnızca tarih', () => {
  it('kaydederken saat/süre/bitiş boşaltılır; konular temizlenir', () => {
    const d = saveExamTarget(emptyData(), exam({ id: '', date: '2026-11-04', startTime: '10:00', endTime: '12:00', durationMin: 120, topics: [' Türev ', 'türev', 'İntegral'] }));
    const t = d.examTargets[0];
    expect(t.id).toBeTruthy();
    expect([t.startTime, t.endTime, t.durationMin]).toEqual(['', '', 0]);
    expect(t.topics).toEqual(['Türev', 'İntegral']);
    expect(d.examDate).toBe('2026-11-04');
  });

  it('eski kayıtta topics yoksa boş dizi; tarih yoksa kayıt reddedilir', () => {
    expect(normalizeExamTarget({ id: 'a', title: 'X', date: '2026-10-10' })?.topics).toEqual([]);
    expect(normalizeExamTarget({ id: 'a', title: 'X' })).toBeNull();
  });

  it('konu girişi virgül/noktalı virgülle ayrılır, en çok 12', () => {
    expect(splitTopicInput('Türev, İntegral; Limit')).toEqual(['Türev', 'İntegral', 'Limit']);
    expect(normalizeTopics(Array.from({ length: 20 }, (_, i) => `K${i}`))).toHaveLength(12);
  });

  it('tek ana sınav kalır', () => {
    let d = saveExamTarget(emptyData(), exam({ id: 'a', date: '2026-11-01', isPrimary: true }));
    d = saveExamTarget(d, exam({ id: 'b', date: '2026-12-01', isPrimary: true }));
    expect(d.examTargets.filter((t) => t.isPrimary).map((t) => t.id)).toEqual(['b']);
  });
});

describe('durum ve sıralama', () => {
  it('yaklaşan / bugün / sonuç bekliyor / sonuç girildi', () => {
    const today = '2026-10-19';
    const d = withExams([]);
    expect(examStatus(d, exam({ id: 'a', date: '2026-10-25' }), today)).toBe('upcoming');
    expect(examStatus(d, exam({ id: 'b', date: today }), today)).toBe('today');
    expect(examStatus(d, exam({ id: 'c', date: '2026-10-01' }), today)).toBe('awaiting_result');
    const done = { ...d, exams: [{ id: 'r', name: 'c', date: '2026-10-01', tyt: 80, ayt: 0, note: '', targetId: 'c' }] };
    expect(examStatus(done, exam({ id: 'c', date: '2026-10-01' }), today)).toBe('done');
    expect(examStatusLabel('upcoming', 1)).toBe('Yarın');
    expect(examStatusLabel('upcoming', 6)).toBe('6 gün kaldı');
  });

  it('yaklaşanlar tarihe göre; geçmiş dahil değil', () => {
    const list = [exam({ id: 'x', date: '2026-12-01' }), exam({ id: 'y', date: '2026-10-01' }), exam({ id: 'z', date: '2026-11-01' })];
    expect(upcomingExams(list, '2026-10-19').map((t) => t.id)).toEqual(['z', 'x']);
  });

  it('tür tonu ve sonuç modu: yazılı/vize puan, TYT/AYT net', () => {
    expect(examKindTone('AYT SAY')).toBe('ayt');
    expect(examKindTone('Vize')).toBe('uni');
    expect(examKindTone('Yazılı')).toBe('school');
    expect(examResultMode('Final')).toBe('yazili');
    expect(examResultMode('Diğer')).toBe('yazili');
    expect(examResultMode('TYT')).toBe('tyt');
    expect(inferExamKind('3D AYT denemesi')).toBe('AYT');
    expect(inferExamKind('Fizik yazılısı')).toBe('Yazılı');
  });
});

describe('silme: mezar taşı ve senkron', () => {
  it('silinen sınav tombstone bırakır; ana sınav sonrakine geçer; bağlı AI planı kalkar', () => {
    const d0 = withExams([exam({ id: 'a', date: '2027-06-19', isPrimary: true }), exam({ id: 'b', date: '2026-11-01' })]);
    const d1 = removeExamTarget({ ...d0, examDate: '2027-06-19', examPlan: { examId: 'a' } as AppData['examPlan'] }, 'a', '2026-10-19T10:00:00.000Z');
    expect(d1.examTargets.map((t) => t.id)).toEqual(['b']);
    expect(primaryExam(d1.examTargets)?.id).toBe('b');
    expect(d1.examTargets[0].isPrimary).toBe(true);
    expect(d1.examDate).toBe('2026-11-01');
    expect(d1.examPlan).toBeNull();
    expect(d1.tombstones).toContainEqual({ kind: 'examTarget', id: 'a', at: '2026-10-19T10:00:00.000Z' });
  });

  it('başka cihazdaki eski kopya silinen sınavı geri getirmez', () => {
    const shared = [exam({ id: 'a', date: '2026-11-01' }), exam({ id: 'b', date: '2026-12-01' })];
    const phone = removeExamTarget(withExams(shared), 'a');
    const laptop = withExams(shared);
    const merged = mergeAppData(laptop, phone);
    expect(merged.examTargets.map((t) => t.id)).toEqual(['b']);
    const mergedOther = mergeAppData(phone, laptop);
    expect(mergedOther.examTargets.map((t) => t.id)).toEqual(['b']);
  });

  it('aynı sınavda son güncellenen kazanır; iki ana sınav olursa yenisi kalır', () => {
    const a1 = exam({ id: 'a', date: '2026-11-01', title: 'Eski ad', updatedAt: '2026-10-01T00:00:00Z', isPrimary: true });
    const a2 = exam({ id: 'a', date: '2026-11-02', title: 'Yeni ad', updatedAt: '2026-10-05T00:00:00Z', isPrimary: true });
    const b = exam({ id: 'b', date: '2026-12-01', updatedAt: '2026-10-09T00:00:00Z', isPrimary: true });
    const out = mergeExamTargets([a1], [a2, b], []);
    expect(out.find((t) => t.id === 'a')?.title).toBe('Yeni ad');
    expect(out.filter((t) => t.isPrimary).map((t) => t.id)).toEqual(['b']);
  });

  it('eski examDate tek başına silinmiş legacy sınavı yeniden oluşturmaz', () => {
    const raw = { ...emptyData(), grade: 'Mezun / YKS', examDate: '2027-06-19', examTargets: [], tombstones: [{ kind: 'examTarget', id: 'ex_legacy', at: '2026-10-19T00:00:00Z' }] };
    expect(normalizeData(raw).examTargets).toEqual([]);
    const fresh = { ...emptyData(), grade: 'Mezun / YKS', examDate: '2027-06-19', examTargets: [] };
    expect(normalizeData(fresh).examTargets.map((t) => t.id)).toEqual(['ex_legacy']);
  });
});
