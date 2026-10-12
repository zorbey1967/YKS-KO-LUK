import { istanbulWallIso } from './meeting';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

export function isoWeekdayMon0(iso: string) {
  const d = new Date(istanbulWallIso(iso, '12:00'));
  return (d.getUTCDay() + 6) % 7;
}

export function addCalendarDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function monthTitle(year: number, month0: number) {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export type CalCell = { iso: string; day: number; muted: boolean };

export function monthCells(year: number, month0: number): CalCell[] {
  const first = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const start = isoWeekdayMon0(first);
  const nextMonth = month0 === 11 ? 0 : month0 + 1;
  const nextYear = month0 === 11 ? year + 1 : year;
  const dim = Number(addCalendarDays(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`, -1).slice(8));
  const out: CalCell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - start;
    const iso = addCalendarDays(first, offset);
    const day = Number(iso.slice(8));
    const inMonth = offset >= 0 && offset < dim;
    out.push({ iso, day, muted: !inMonth });
  }
  return out;
}

export { WEEKDAYS };
