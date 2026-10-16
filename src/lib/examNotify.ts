import type { AppData, ExamTarget } from './types';
import { istanbulToday } from './meeting';
import { notifyMilestone } from './countdown';

function istanbulHour(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(now));
  return Number(parts.find((p) => p.type === 'hour')?.value || 0);
}

/** Sınav günü sonuç/analiz hatırlatmaları: 3 uyarı, yaklaşık 1 saat arayla. */
const RESULT_SLOTS = [
  { slot: 'r0', hour: 12, text: (title: string) => `${title} sonuçlarını kaydetmeye hazır mısın?` },
  { slot: 'r1', hour: 13, text: (title: string) => `${title} için kısa bir analiz yapabilirsin.` },
  { slot: 'r2', hour: 14, text: (title: string) => `${title} performansını değerlendir.` },
] as const;

export function dueExamNotices(data: AppData, targets: ExamTarget[], now = Date.now()) {
  if (!data.examNotifyPrefs?.exams) return [] as { key: string; text: string }[];
  const today = istanbulToday();
  const hour = istanbulHour(now);
  const out: { key: string; text: string }[] = [];
  for (const t of targets) {
    if (!t.notify) continue;
    const m = notifyMilestone(t.date, today);
    if (m) {
      const key = `${t.id}:${m}`;
      if (!data.examNotifyLog?.[key]) {
        const text = m === '0'
          ? `Bugün ${t.title} var.`
          : m === '1'
            ? `Yarın ${t.title} var.`
            : `Sınavına ${m} gün kaldı. (${t.title})`;
        out.push({ key, text });
      }
    }
    if (t.date === today) {
      for (const s of RESULT_SLOTS) {
        if (hour < s.hour) continue;
        const key = `${t.id}:${s.slot}`;
        if (data.examNotifyLog?.[key]) continue;
        out.push({ key, text: s.text(t.title) });
      }
    }
  }
  return out;
}

export function canUseBrowserNotify() {
  return typeof Notification !== 'undefined';
}

export async function requestBrowserNotify(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!canUseBrowserNotify()) return 'unsupported';
  try {
    const p = await Notification.requestPermission();
    return p === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function showBrowserNotify(title: string, body: string) {
  if (!canUseBrowserNotify() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}
