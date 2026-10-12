import type { AppData, ExamTarget } from './types';
import { istanbulToday } from './meeting';
import { notifyMilestone } from './countdown';

export function dueExamNotices(data: AppData, targets: ExamTarget[]) {
  if (!data.examNotifyPrefs?.exams) return [] as { key: string; text: string }[];
  const today = istanbulToday();
  const out: { key: string; text: string }[] = [];
  for (const t of targets) {
    if (!t.notify) continue;
    const m = notifyMilestone(t.date, today);
    if (!m) continue;
    const key = `${t.id}:${m}`;
    if (data.examNotifyLog?.[key]) continue;
    const text = m === '0'
      ? `Bugün ${t.title} var.`
      : m === '1'
        ? `Yarın ${t.title} var.`
        : `Sınavına ${m} gün kaldı. (${t.title})`;
    out.push({ key, text });
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
