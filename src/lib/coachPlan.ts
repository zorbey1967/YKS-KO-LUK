import type { AppData, Task } from './types';
import type { CoachHomework } from './coaches';

export function homeworkTaskId(homeworkId: string) {
  return `hw:${homeworkId}`;
}

/** Koç ödevini öğrenci planına id ile yansıtır; aynı ödev iki satır olmaz; silinmiş hw geri gelmez. */
export function applyCoachHomeworks(data: AppData, rows: CoachHomework[], now = new Date().toISOString()): AppData {
  let tasks = data.tasks.slice();
  let changed = false;
  for (const h of rows) {
    const id = homeworkTaskId(h.id);
    if (data.tombstones.some((t) => t.kind === 'task' && t.id === id)) continue;
    const existing = tasks.find((t) => t.id === id || t.homeworkId === h.id);
    const done = Boolean(h.done || existing?.done);
    const date = h.due || existing?.date || '';
    if (existing) {
      if (existing.done === done && existing.title === h.title && existing.date === date) continue;
      tasks = tasks.map((t) => (t.id === existing.id ? { ...existing, title: h.title, done, date, origin: 'coach' as const, homeworkId: h.id, updatedAt: now } : t));
      changed = true;
    } else {
      tasks = [{
        id,
        title: h.title,
        subject: 'Koç ödevi',
        minutes: 40,
        priority: 'Yüksek',
        done,
        date,
        origin: 'coach',
        homeworkId: h.id,
        updatedAt: now,
      }, ...tasks];
      changed = true;
    }
  }
  return changed ? { ...data, tasks } : data;
}

export function appendGeneratedTasks(data: AppData, incoming: Task[]): AppData {
  const coach = data.tasks.filter((t) => t.origin === 'coach');
  const others = data.tasks.filter((t) => t.origin !== 'coach');
  const fresh = incoming.filter((n) => {
    if (n.origin === 'coach') return false;
    return !data.tasks.some((t) => t.id === n.id || (t.origin === 'coach' && t.title === n.title && t.date === n.date));
  });
  return { ...data, tasks: [...coach, ...fresh, ...others] };
}

export function coachTasksUntouched(before: AppData, after: AppData): boolean {
  const a = before.tasks.filter((t) => t.origin === 'coach');
  const b = after.tasks.filter((t) => t.origin === 'coach');
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.id === b[i]?.id && t.title === b[i]?.title && t.done === b[i]?.done);
}
