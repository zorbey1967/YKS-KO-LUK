import { istanbulToday, istanbulWallIso } from './meeting';

export type CountdownPhase = 'calm' | 'mid' | 'focus' | 'warn' | 'alert' | 'today' | 'past' | 'unset';

export type ExamClock = {
  days: number;
  hours: number;
  minutes: number;
  ms: number;
  phase: CountdownPhase;
  label: string;
  headline: string;
};

export function istanbulDateKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const g = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Takvim günü farkı (İstanbul tarih anahtarı). Saat kaymasıyla bir gün sapmaz. */
export function calendarDaysUntil(date: string, today = istanbulToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 0;
  const [y1, m1, d1] = date.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const a = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const b = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((a - b) / 86400000);
}

export function examInstant(date: string, startTime?: string) {
  const t = (startTime || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  const time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00';
  return new Date(istanbulWallIso(date, time)).getTime();
}

export function remainingClock(date: string, startTime?: string, now = Date.now(), endTime?: string): ExamClock {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { days: 0, hours: 0, minutes: 0, ms: 0, phase: 'unset', label: 'Tarih yok', headline: 'Sınav tarihi yok' };
  }
  const today = istanbulToday();
  const start = examInstant(date, startTime);
  const ms = start - now;
  if (date < today) {
    return { days: 0, hours: 0, minutes: 0, ms: 0, phase: 'past', label: 'Sınav tamamlandı', headline: 'Sınav tamamlandı' };
  }
  if (date === today) {
    if (ms > 0) {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return { days: 0, hours, minutes, ms, phase: 'today', label: 'Bugün', headline: 'Kalan süre: BUGÜN' };
    }
    const end = /^\d{1,2}:\d{2}$/.test(endTime || '') ? examInstant(date, endTime) : start + 3 * 3600000;
    if (now > end) {
      return { days: 0, hours: 0, minutes: 0, ms: 0, phase: 'past', label: 'Sınav tamamlandı', headline: 'Sınav tamamlandı' };
    }
    return { days: 0, hours: 0, minutes: 0, ms: 0, phase: 'today', label: 'Bugün', headline: 'Sınav başladı' };
  }
  const days = Math.max(0, calendarDaysUntil(date, today));
  const hours = Math.max(0, Math.floor((ms % 86400000) / 3600000));
  const minutes = Math.max(0, Math.floor((ms % 3600000) / 60000));
  let phase: CountdownPhase = 'calm';
  if (days <= 7) phase = 'alert';
  else if (days <= 14) phase = 'warn';
  else if (days <= 30) phase = 'focus';
  else if (days <= 180) phase = 'mid';
  else phase = 'calm';
  const tomorrow = addDays(today, 1);
  const headline = date === tomorrow ? 'Yarın' : `${days} gün kaldı`;
  return { days, hours, minutes, ms: Math.max(0, ms), phase, label: `${days} gün`, headline };
}

export function countdownKindLabel(kind: string, title: string) {
  const k = kind.toLocaleUpperCase('tr-TR');
  if (k.includes('LGS')) return 'LGS’ye kalan süre';
  if (k.includes('KPSS')) return 'KPSS’ye kalan süre';
  if (k.includes('AYT')) return 'AYT’ye kalan süre';
  if (k.includes('TYT')) return 'TYT’ye kalan süre';
  if (k.includes('YKS')) return 'YKS’ye kalan süre';
  return `${title}’ye kalan süre`;
}

export function notifyMilestone(date: string, today: string): '7' | '3' | '1' | '0' | null {
  if (date === today) return '0';
  if (date === addDays(today, 1)) return '1';
  if (date === addDays(today, 3)) return '3';
  if (date === addDays(today, 7)) return '7';
  return null;
}
