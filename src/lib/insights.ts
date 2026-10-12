import type { AppData, ScheduleDay, Task } from './types';
import { remainingClock, istanbulDateKey } from './countdown';
import { today, uid } from './util';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function weekdayName(d = new Date()) {
  const iso = istanbulDateKey(d);
  const dt = new Date(`${iso}T12:00:00+03:00`);
  return DAYS[dt.getUTCDay()];
}

export function weekdayNameIstanbul(iso: string) {
  const dt = new Date(`${iso}T12:00:00+03:00`);
  return DAYS[Number.isNaN(dt.getTime()) ? new Date().getUTCDay() : dt.getUTCDay()];
}

export function todaySchedule(data: AppData): ScheduleDay | undefined {
  const name = weekdayName();
  return data.schedule.days.find((x) => x.day === name);
}

export function examCountdown(iso: string) {
  const c = remainingClock(iso);
  if (c.phase === 'unset') return { days: 0, label: 'Tarih yok', past: false, unset: true };
  if (c.phase === 'past') return { days: 0, label: 'Sınav tamamlandı', past: true, unset: false };
  if (c.phase === 'today') return { days: 0, label: c.label, past: false, unset: false };
  return { days: c.days, label: c.label, past: false, unset: false };
}

export function weekGoalPct(data: AppData) {
  const target = Math.max(0, (data.weekHours || 0) * 60);
  if (target <= 0) return { pct: 0, hoursLabel: 'belirtilmedi' };
  return { pct: Math.min(100, Math.round((weekMinutes(data) / target) * 100)), hoursLabel: `${data.weekHours}s` };
}

export function studyStreak(data: AppData) {
  const uniqueDays = [...new Set(data.sessions.map((x) => x.date))].sort().reverse();
  let streak = 0;
  for (let i = 0; ; i++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const s = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (uniqueDays.includes(s)) streak++;
    else break;
  }
  return streak;
}

export function weekMinutes(data: AppData) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  return data.sessions.filter((x) => x.date >= weekKey).reduce((a, x) => a + x.minutes, 0);
}

export function blocksToTasks(day: ScheduleDay, date = today()): Task[] {
  return day.blocks.map((b) => ({
    id: uid('sch_'),
    title: b.title,
    subject: 'Program',
    minutes: b.minutes,
    priority: 'Normal',
    done: false,
    date,
  }));
}

export const STUDY_SUBJECTS = ['Matematik', 'Türkçe', 'Edebiyat', 'Tarih', 'Coğrafya', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Deneme', 'Odak'];
