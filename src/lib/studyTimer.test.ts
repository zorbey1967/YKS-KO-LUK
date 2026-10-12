import { describe, expect, it } from 'vitest';
import {
  canPersist,
  changePlan,
  dailyTotals,
  dateKeyFromMs,
  elapsedSec,
  idleLive,
  parseLive,
  pauseLive,
  remainingMs,
  startLive,
  syncFromClock,
  toSession,
} from './studyTimer';

const T0 = Date.parse('2026-10-12T21:30:00+03:00');

describe('studyTimer saat damgası', () => {
  it('süreyi tik sayısından değil endAt − now ile hesaplar', () => {
    const idle = idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 });
    const started = startLive(idle, T0);
    if ('error' in started) throw new Error(started.error);
    const later = T0 + 10_000;
    expect(remainingMs(started, later)).toBe(40 * 60 * 1000 - 10_000);
    expect(elapsedSec(started, later)).toBe(10);
  });

  it('sekme arka planda kalsa da duraklatılmamış süre akar', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 25 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const afterBg = T0 + 120_000;
    const synced = syncFromClock(started, afterBg);
    expect(elapsedSec(synced, afterBg)).toBe(120);
    expect(synced.running).toBe(true);
  });

  it('duraklatınca süre donar, devam edince kaldığı yerden gider', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const paused = pauseLive(started, T0 + 30_000);
    expect(paused.running).toBe(false);
    expect(elapsedSec(paused, T0 + 90_000)).toBe(30);
    const resumed = startLive(paused, T0 + 90_000);
    if ('error' in resumed) throw new Error(resumed.error);
    expect(elapsedSec(resumed, T0 + 100_000)).toBe(40);
  });

  it('aynı anda ikinci oturumu başlatmaz', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const again = startLive(started, T0 + 1000);
    expect(again).toEqual({ error: 'already_running' });
  });

  it('başlamadan veya 1 dakikadan kısa kaydı yazmaz', () => {
    const idle = idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 });
    expect(canPersist(idle, T0).ok).toBe(false);
    const started = startLive(idle, T0);
    if ('error' in started) throw new Error(started.error);
    expect(canPersist(started, T0 + 59_000).ok).toBe(false);
    expect(toSession(started, T0 + 59_000)).toBeNull();
    expect(canPersist(started, T0 + 60_000).ok).toBe(true);
  });

  it('aynı oturumu ikinci kez kaydetmez', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const gate = canPersist({ ...started, saved: true }, T0 + 120_000);
    expect(gate).toEqual({ ok: false, reason: 'zaten_kayitli' });
  });

  it('gece yarısını geçen oturumun tarihi başlangıç gününde kalır', () => {
    const before = new Date(2026, 9, 12, 23, 50, 0).getTime();
    const started = startLive(idleLive({ id: 's_1', plannedSec: 40 * 60, now: before }), before);
    if ('error' in started) throw new Error(started.error);
    const after = new Date(2026, 9, 13, 0, 10, 0).getTime();
    const rec = toSession(started, after);
    expect(started.sessionDate).toBe(dateKeyFromMs(before));
    expect(rec?.date).toBe(started.sessionDate);
    expect(rec?.date).toBe('2026-10-12');
    expect(rec?.seconds).toBe(20 * 60);
  });

  it('çalışırken süre seçimini değiştirmez', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 40 * 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    expect(changePlan(started, 25 * 60)).toEqual({ error: 'running' });
  });

  it('süre bitince running kapanır', () => {
    const started = startLive(idleLive({ id: 's_1', plannedSec: 60, now: T0 }), T0);
    if ('error' in started) throw new Error(started.error);
    const done = syncFromClock(started, T0 + 61_000);
    expect(done.running).toBe(false);
    expect(done.remainingMs).toBe(0);
  });

  it('günlük toplam yalnızca kayıtlardan gelir', () => {
    const day = dailyTotals(
      [
        { id: 'a', date: '2026-10-12', minutes: 40, seconds: 2400, subject: 'Matematik', createdAt: '' },
        { id: 'b', date: '2026-10-12', minutes: 12, seconds: 720, subject: 'Fizik', createdAt: '' },
        { id: 'c', date: '2026-10-11', minutes: 90, seconds: 5400, subject: 'Kimya', createdAt: '' },
      ],
      '2026-10-12',
    );
    expect(day).toEqual({ minutes: 52, count: 2 });
  });

  it('bozuk localStorage taslağını yok sayar', () => {
    expect(parseLive(null)).toBeNull();
    expect(parseLive({ plannedSec: 10 })).toBeNull();
    expect(parseLive({ id: 'x', kind: 'free', plannedSec: 2400, remainingMs: 1000, running: false })).toMatchObject({
      id: 'x',
      plannedSec: 2400,
    });
  });
});
