import type { AppData, ExamTarget } from './types';

/**
 * Sınav günü sonuç girişi için otomatik mesaj/toast yok.
 * Yaklaşan gün toast’ı da kapalı — sayaç kartı yeter; öğrenci tarihe tıklayarak sonuç girer.
 */
export function dueExamNotices(_data: AppData, _targets: ExamTarget[], _now = Date.now()) {
  return [] as { key: string; text: string }[];
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
