import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import { commitSession, patchSession } from './studyLoop';
import { applyQuizResult, setMistakeReason } from './mistakeBook';
import { addDays, dueReviews, enqueueReview, markReviewResult, snoozeReview, topicMastery } from './spacedReview';
import { nextStudySuggestion } from './studySuggest';
import { normalizeData } from './storage';
import { elapsedSec, idleLive, parseLive, pauseLive, remainingMs, startLive, syncFromClock } from './studyTimer';

const T0 = Date.parse('2026-10-12T12:00:00');

describe('oturum idempotent kayıt', () => {
  it('aynı id ikinci kez günlük süreyi artırmaz', () => {
    const rec = {
      id: 's_1',
      date: '2026-10-12',
      minutes: 20,
      seconds: 1200,
      subject: 'Matematik',
      createdAt: '',
      taskId: 't1',
    };
    const base = { ...emptyData(), tasks: [{ id: 't1', title: 'Paragraf', subject: 'Türkçe', minutes: 20, priority: 'normal', done: false, date: '2026-10-11' }] };
    const first = commitSession(base, rec);
    const retry = commitSession(first.data, rec);
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(retry.data.sessions).toHaveLength(1);
    expect(retry.data.tasks[0].done).toBe(true);
  });

  it('normalize yinelenen oturum id’sini atar', () => {
    const d = normalizeData({
      sessions: [
        { id: 's_1', date: '2026-10-12', minutes: 10, seconds: 600, subject: 'A', createdAt: '' },
        { id: 's_1', date: '2026-10-12', minutes: 99, seconds: 99, subject: 'B', createdAt: '' },
      ],
    });
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0].minutes).toBe(10);
  });
});

describe('saat sıçraması ve duraklatma', () => {
  it('geri alınan sistem saati duraklatılmış süre eklemez', () => {
    const started = startLive(idleLive({ id: 's', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const paused = pauseLive(started, T0 + 30_000);
    expect(elapsedSec(paused, T0 - 120_000)).toBe(30);
  });

  it('aşırı ileri saat sıçramasında kalan süre şişmez', () => {
    const started = startLive(idleLive({ id: 's', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const later = T0 + 48 * 3600 * 1000;
    expect(remainingMs(started, later)).toBe(started.remainingMs);
    const synced = syncFromClock(started, later);
    expect(elapsedSec(synced, later)).toBe(0);
  });

  it('JSON taslağından yenilemede süre endAt ile devam eder', () => {
    const started = startLive(idleLive({ id: 's', plannedSec: 25 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const restored = parseLive(JSON.parse(JSON.stringify(started)));
    expect(restored).toBeTruthy();
    expect(elapsedSec(restored!, T0 + 15_000)).toBe(15);
  });
});

describe('yanlış defteri ve tekrar kuyruğu', () => {
  it('aynı soru id ikinci yanlışta satır çoğalmaz', () => {
    let d = emptyData();
    d = applyQuizResult(d, { questionId: 'q1', correct: false, subject: 'Matematik', topic: 'Fonksiyon', level: 'YKS TYT' });
    d = applyQuizResult(d, { questionId: 'q1', correct: false, subject: 'Matematik', topic: 'Fonksiyon', level: 'YKS TYT' });
    expect(d.mistakes).toHaveLength(1);
    expect(d.mistakes[0].wrongCount).toBe(2);
    expect(d.reviews).toHaveLength(1);
  });

  it('doğru cevap aynı kaydı günceller, yeni satır açmaz', () => {
    let d = emptyData();
    d = applyQuizResult(d, { questionId: 'q1', correct: false, subject: 'Fizik', topic: 'Kinematik' });
    d = setMistakeReason(d, 'q1', 'bilgi');
    d = applyQuizResult(d, { questionId: 'q1', correct: true, subject: 'Fizik', topic: 'Kinematik' });
    expect(d.mistakes).toHaveLength(1);
    expect(d.mistakes[0].reason).toBe('bilgi');
    expect(d.mistakes[0].lastCorrectAt).toBeTruthy();
  });

  it('öğrenci A yanlışını öğrenci B verisine yazmaz', () => {
    const a = applyQuizResult(emptyData(), { questionId: 'qA', correct: false, subject: 'Kimya', topic: 'Gazlar' });
    const b = emptyData();
    expect(b.mistakes).toHaveLength(0);
    expect(a.mistakes[0].questionId).toBe('qA');
  });

  it('erteleme ve due tarihi', () => {
    let d = enqueueReview(emptyData(), { kind: 'topic', subject: 'Tarih', topic: 'Osmanlı', at: '2026-10-12T10:00:00' });
    expect(dueReviews(d, '2026-10-12')).toHaveLength(0);
    expect(dueReviews(d, '2026-10-13')).toHaveLength(1);
    d = snoozeReview(d, d.reviews[0].id, '2026-10-13', 1);
    expect(dueReviews(d, '2026-10-13')).toHaveLength(0);
    expect(dueReviews(d, '2026-10-14')).toHaveLength(1);
  });

  it('doğru cevap aralığı uzatır; ustalık tekrar geçmişinden üretilmez', () => {
    let d = enqueueReview(emptyData(), { kind: 'mistake', questionId: 'q1', subject: 'Mat', topic: 'Türev', at: '2026-10-12T10:00:00' });
    const id = d.reviews[0].id;
    d = markReviewResult(d, { id, correct: true, at: '2026-10-13T10:00:00', subject: 'Mat', topic: 'Türev', questionId: 'q1' });
    expect(d.reviews[0].dueDate).toBe(addDays('2026-10-13', 3));
    expect(topicMastery(d, 'YKS TYT|Mat|Türev')).toBeNull();
    d = { ...d, qb: { 'YKS TYT|Mat|Türev': { key: 'YKS TYT|Mat|Türev', answered: 4, correct: 3, wrong: 1, index: 4, completed: false, answeredIds: ['a'], updatedAt: '' } } };
    expect(topicMastery(d, 'YKS TYT|Mat|Türev')).toEqual({ answered: 4, acc: 75 });
  });
});

describe('öneri algoritması', () => {
  it('veri yoksa uydurmaz', () => {
    const s = nextStudySuggestion(emptyData(), '2026-10-12');
    expect(s.kind).toBe('onboard');
    expect(s.evidence).toEqual([]);
  });

  it('due tekrarı gecikmiş görevden önce önerir', () => {
    let d = emptyData();
    d = enqueueReview(d, { kind: 'topic', subject: 'Geometri', topic: 'Üçgen', at: '2026-10-01T10:00:00' });
    d = { ...d, tasks: [{ id: 't', title: 'Eski ödev', subject: 'Türkçe', minutes: 30, priority: 'high', done: false, date: '2026-10-10' }] };
    const s = nextStudySuggestion(d, '2026-10-12');
    expect(s.topic).toBe('Üçgen');
    expect(s.reason).toMatch(/tekrar/i);
  });
});

describe('oturum özeti tahminsiz', () => {
  it('boş soru sayısını 0 diye yazmaz', () => {
    const d = commitSession(emptyData(), {
      id: 's', date: '2026-10-12', minutes: 20, seconds: 1200, subject: 'Matematik', createdAt: '',
    }).data;
    const patched = patchSession(d, 's', {});
    expect(patched.sessions[0].asked).toBeUndefined();
  });
});
