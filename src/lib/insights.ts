import type { AppData, ScheduleDay, Task } from './types';
import { today, uid } from './util';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function weekdayName(d = new Date()) {
  return DAYS[d.getDay()];
}

export function todaySchedule(data: AppData): ScheduleDay | undefined {
  const name = weekdayName();
  return data.schedule.days.find((x) => x.day === name);
}

export function examCountdown(iso: string) {
  const end = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(end.getTime())) return { days: 0, label: 'Tarih yok', past: true };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (days > 0) return { days, label: `${days} gün`, past: false };
  if (days === 0) return { days: 0, label: 'Bugün', past: false };
  return { days, label: `${Math.abs(days)} gün önce`, past: true };
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
