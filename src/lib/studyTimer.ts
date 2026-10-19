import type { Session } from './types';
import { today as todayKey } from './util';

export const LIVE_KEY = 'yks_timer_live_v1';
export const INTENT_KEY = 'yks_timer_intent_v1';

/** Canlı timer taslağı kullanıcıya özel; A→B geçişinde sızıntı olmasın. */
export function liveStorageKey(userId?: string | null) {
  return userId ? `${LIVE_KEY}_${userId}` : `${LIVE_KEY}_guest`;
}
export const MIN_SAVE_SEC = 60;
/** Duvar saati bu kadar ileri zıplarsa (uyku/NTP) kalan süreye güvenilir; ekstra süre eklenmez. */
export const MAX_CLOCK_JUMP_MS = 36 * 60 * 60 * 1000;

export type StudyKind =
  | 'free'
  | 'pomodoro'
  | 'questions'
  | 'learn'
  | 'review'
  | 'exam'
  | 'custom';

export const STUDY_KINDS: { id: StudyKind; label: string; hint: string }[] = [
  { id: 'free', label: 'Serbest çalışma', hint: 'Kendi sürenle odaklan' },
  { id: 'pomodoro', label: 'Pomodoro', hint: '25 dk odak, kısa ara' },
  { id: 'questions', label: 'Soru çözümü', hint: 'Kitap veya set' },
  { id: 'learn', label: 'Konu öğrenme', hint: 'Yeni konu' },
  { id: 'review', label: 'Konu tekrarı', hint: 'Aralıklı tekrar' },
  { id: 'exam', label: 'Deneme sınavı', hint: 'Süre tutarak deneme' },
  { id: 'custom', label: 'Kendi oturumum', hint: 'Dakikayı sen yaz' },
];

export type LiveTimer = {
  id: string;
  kind: StudyKind;
  subject: string;
  topic?: string;
  source?: string;
  taskId?: string;
  plannedSec: number;
  remainingMs: number;
  running: boolean;
  endAt: number | null;
  startedAt: string | null;
  sessionDate: string;
  saved: boolean;
  lastWall: number | null;
};

export type TimerIntent = {
  kind?: StudyKind;
  subject: string;
  topic?: string;
  minutes?: number;
  taskId?: string;
  source?: string;
};

export function takeTimerIntent(store: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage): TimerIntent | null {
  try {
    const raw = store.getItem(INTENT_KEY);
    if (!raw) return null;
    store.removeItem(INTENT_KEY);
    const v = JSON.parse(raw) as TimerIntent;
    return v?.subject ? v : null;
  } catch {
    return null;
  }
}

export function setTimerIntent(intent: TimerIntent, store: Pick<Storage, 'setItem'> = sessionStorage): void {
  store.setItem(INTENT_KEY, JSON.stringify(intent));
}

export type PersistFail = 'baslamadi' | 'kisa' | 'zaten_kayitli';

export function kindLabel(kind: StudyKind): string {
  return STUDY_KINDS.find((k) => k.id === kind)?.label || 'Çalışma';
}

/** Koç raporu faz adını öğrenci diline çevirir; teknik jargonu ekranda göstermez. */
export function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    'Başlangıç': 'Hedefini kaydet',
    'Okul mastery': 'Konuları pekiştir',
    'TYT tabanı': 'TYT temeli',
    'AYT ivme': 'AYT hızlanma',
    'Sınav temposu': 'Sınav temposu',
    'GY tabanı': 'GY temeli',
    'Deneme + GK': 'Deneme ve GK',
  };
  return map[phase] || phase;
}

export function defaultPlanSec(kind: StudyKind, requestedSec?: number): number {
  if (requestedSec && requestedSec > 0) return requestedSec;
  if (kind === 'pomodoro') return 25 * 60;
  if (kind === 'exam') return 90 * 60;
  return 40 * 60;
}

export function idleLive(opts: {
  id: string;
  kind?: StudyKind;
  subject?: string;
  topic?: string;
  source?: string;
  taskId?: string;
  plannedSec?: number;
  now?: number;
}): LiveTimer {
  const kind = opts.kind || 'free';
  const plannedSec = defaultPlanSec(kind, opts.plannedSec);
  const now = opts.now ?? Date.now();
  return {
    id: opts.id,
    kind,
    subject: (opts.subject || 'Odak').trim() || 'Odak',
    topic: opts.topic,
    source: opts.source,
    taskId: opts.taskId,
    plannedSec,
    remainingMs: plannedSec * 1000,
    running: false,
    endAt: null,
    startedAt: null,
    sessionDate: dateKeyFromMs(now),
    saved: false,
    lastWall: null,
  };
}

export function dateKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function clockSkew(live: LiveTimer, now: number): 'ok' | 'back' | 'jump' | 'invalid' {
  if (!Number.isFinite(now) || now <= 0) return 'invalid';
  const last = live.lastWall;
  if (last == null) return 'ok';
  if (now + 1500 < last) return 'back';
  if (now - last > MAX_CLOCK_JUMP_MS) return 'jump';
  return 'ok';
}

export function remainingMs(live: LiveTimer, now = Date.now()): number {
  const stored = Math.max(0, live.remainingMs);
  if (!live.running || live.endAt == null) return stored;
  const skew = clockSkew(live, now);
  if (skew !== 'ok') return stored;
  return Math.max(0, live.endAt - now);
}

export function elapsedMs(live: LiveTimer, now = Date.now()): number {
  return Math.max(0, live.plannedSec * 1000 - remainingMs(live, now));
}

export function elapsedSec(live: LiveTimer, now = Date.now()): number {
  return Math.floor(elapsedMs(live, now) / 1000);
}

export function remainingSec(live: LiveTimer, now = Date.now()): number {
  return Math.ceil(remainingMs(live, now) / 1000);
}

export function syncFromClock(live: LiveTimer, now = Date.now()): LiveTimer {
  if (!live.running) return live;
  const skew = clockSkew(live, now);
  const rem = remainingMs(live, now);
  if (skew !== 'ok') {
    return {
      ...live,
      remainingMs: rem,
      endAt: (Number.isFinite(now) && now > 0 ? now : live.lastWall || 0) + rem,
      lastWall: Number.isFinite(now) && now > 0 ? now : live.lastWall,
    };
  }
  if (rem <= 0) {
    return {
      ...live,
      running: false,
      endAt: null,
      remainingMs: 0,
      lastWall: now,
    };
  }
  return { ...live, remainingMs: rem, lastWall: now };
}

export function startLive(live: LiveTimer, now = Date.now()): LiveTimer | { error: 'already_running' | 'bitti' } {
  const synced = syncFromClock(live, now);
  if (synced.running) return { error: 'already_running' };
  const rem = remainingMs(synced, now);
  if (rem <= 0) return { error: 'bitti' };
  return {
    ...synced,
    running: true,
    remainingMs: rem,
    endAt: now + rem,
    lastWall: now,
    startedAt: synced.startedAt || new Date(now).toISOString(),
    sessionDate: synced.startedAt ? synced.sessionDate : dateKeyFromMs(now),
  };
}

export function pauseLive(live: LiveTimer, now = Date.now()): LiveTimer {
  const synced = syncFromClock(live, now);
  if (!synced.running) return synced;
  const rem = remainingMs(synced, now);
  return {
    ...synced,
    running: false,
    remainingMs: rem,
    endAt: null,
    lastWall: now,
  };
}

export function cancelLive(live: LiveTimer, now = Date.now()): LiveTimer {
  return idleLive({
    id: live.id,
    kind: live.kind,
    subject: live.subject,
    plannedSec: live.plannedSec,
    now,
  });
}

export function changePlan(
  live: LiveTimer,
  plannedSec: number,
): LiveTimer | { error: 'running' | 'invalid' } {
  if (plannedSec < 60 || plannedSec > 6 * 3600) return { error: 'invalid' };
  if (live.running) return { error: 'running' };
  if (live.startedAt) return { error: 'running' };
  return {
    ...live,
    plannedSec,
    remainingMs: plannedSec * 1000,
    endAt: null,
  };
}

export function changeKind(
  live: LiveTimer,
  kind: StudyKind,
  now = Date.now(),
): LiveTimer | { error: 'running' } {
  if (live.running || live.startedAt) return { error: 'running' };
  const plannedSec = defaultPlanSec(kind, kind === 'custom' || kind === 'free' ? live.plannedSec : undefined);
  return idleLive({
    id: live.id,
    kind,
    subject: live.subject,
    topic: live.topic,
    source: live.source,
    taskId: live.taskId,
    plannedSec,
    now,
  });
}

export function changeSubject(live: LiveTimer, subject: string): LiveTimer {
  return { ...live, subject: subject.trim() || 'Odak' };
}

export function canPersist(live: LiveTimer, now = Date.now()): { ok: true; elapsedSec: number } | { ok: false; reason: PersistFail } {
  if (live.saved) return { ok: false, reason: 'zaten_kayitli' };
  if (!live.startedAt) return { ok: false, reason: 'baslamadi' };
  const sec = elapsedSec(live, now);
  if (sec < MIN_SAVE_SEC) return { ok: false, reason: 'kisa' };
  return { ok: true, elapsedSec: sec };
}

export function persistFailLabel(reason: PersistFail): string {
  if (reason === 'baslamadi') return 'Sayaç henüz başlamadı; kayıt yok.';
  if (reason === 'kisa') return 'En az 1 dakika çalışınca kaydedebilirsin.';
  return 'Bu oturum zaten kaydedildi.';
}

export function toSession(live: LiveTimer, now = Date.now()): Session | null {
  const gate = canPersist(live, now);
  if (!gate.ok) return null;
  const sec = gate.elapsedSec;
  return {
    id: live.id,
    date: live.sessionDate || todayKey(),
    minutes: Math.max(1, Math.round(sec / 60)),
    seconds: sec,
    subject: live.subject,
    createdAt: live.startedAt || new Date(now).toISOString(),
    kind: live.kind,
    plannedMinutes: Math.round(live.plannedSec / 60),
    topic: live.topic,
    source: live.source,
    taskId: live.taskId,
    startedAt: live.startedAt || undefined,
    endedAt: new Date(now).toISOString(),
  };
}

export function markSaved(live: LiveTimer): LiveTimer {
  return { ...live, saved: true, running: false, endAt: null, remainingMs: remainingMs(live) };
}

export function parseLive(raw: unknown): LiveTimer | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  const plannedSec = Number(x.plannedSec);
  if (!Number.isFinite(plannedSec) || plannedSec < 60) return null;
  const kind = String(x.kind || 'free') as StudyKind;
  if (!STUDY_KINDS.some((k) => k.id === kind)) return null;
  return {
    id: String(x.id || ''),
    kind,
    subject: String(x.subject || 'Odak'),
    plannedSec,
    remainingMs: Math.max(0, Number(x.remainingMs) || 0),
    running: Boolean(x.running),
    endAt: x.endAt == null ? null : Number(x.endAt) || null,
    startedAt: x.startedAt ? String(x.startedAt) : null,
    sessionDate: String(x.sessionDate || ''),
    saved: Boolean(x.saved),
    lastWall: x.lastWall == null ? null : Number(x.lastWall) || null,
    topic: x.topic ? String(x.topic) : undefined,
    source: x.source ? String(x.source) : undefined,
    taskId: x.taskId ? String(x.taskId) : undefined,
  };
}

export function loadLive(
  store: Pick<Storage, 'getItem' | 'removeItem'> = localStorage,
  userId?: string | null,
): LiveTimer | null {
  try {
    const raw = store.getItem(liveStorageKey(userId));
    if (!raw) {
      // Eski global anahtar: başka hesaba taşınmasın diye sil.
      try { store.removeItem(LIVE_KEY); } catch { /* ignore */ }
      return null;
    }
    const live = parseLive(JSON.parse(raw));
    if (!live?.id) return null;
    return live;
  } catch {
    return null;
  }
}

export function writeLive(
  live: LiveTimer,
  store: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
  userId?: string | null,
): void {
  try { store.removeItem(LIVE_KEY); } catch { /* ignore */ }
  store.setItem(liveStorageKey(userId), JSON.stringify(live));
}

export function clearLive(
  store: Pick<Storage, 'removeItem'> = localStorage,
  userId?: string | null,
): void {
  store.removeItem(liveStorageKey(userId));
  try { store.removeItem(LIVE_KEY); } catch { /* ignore */ }
}

export function dailyTotals(sessions: Session[], date: string): { minutes: number; count: number } {
  const list = sessions.filter((s) => s.date === date);
  return {
    minutes: list.reduce((a, s) => a + (Number(s.minutes) || 0), 0),
    count: list.length,
  };
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
