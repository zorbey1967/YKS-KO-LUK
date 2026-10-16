import type { Schedule, ScheduleDay } from './types';

export const WEEK_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

export type WeekPlanLock = 'self' | 'coach';

export type WeekPlan = {
  days: ScheduleDay[];
  weekHours: number;
  notes: string;
  lock: WeekPlanLock;
  coachId: string | null;
  updatedAt: string;
};

export function emptyWeekPlan(): WeekPlan {
  return {
    days: WEEK_DAYS.map((day) => ({ day, blocks: [] })),
    weekHours: 0,
    notes: '',
    lock: 'self',
    coachId: null,
    updatedAt: '',
  };
}

export function scheduleFromWeekPlan(plan: WeekPlan, prev: Schedule): Schedule {
  return {
    ...prev,
    days: plan.days,
    notes: plan.notes,
    source: plan.lock === 'coach' ? 'coach' : (prev.source === 'coach' ? 'self' : (prev.source || 'self')),
    updatedAt: plan.updatedAt || prev.updatedAt,
  };
}

export function weekPlanFromSchedule(sch: Schedule, weekHours = 0): WeekPlan {
  return {
    days: Array.isArray(sch.days) && sch.days.length ? sch.days : emptyWeekPlan().days,
    weekHours,
    notes: sch.notes || '',
    lock: 'self',
    coachId: null,
    updatedAt: sch.updatedAt || '',
  };
}

export function canStudentEditPlan(lock: WeekPlanLock, _hasActiveCoach: boolean) {
  if (lock === 'coach') return false;
  return true;
}

export function canCoachEditPlan(opts: { coachId: string; assignedStudent: boolean; coachActive: boolean }) {
  return Boolean(opts.coachId && opts.assignedStudent && opts.coachActive);
}

export function tytNet(correct: number, wrong: number) {
  return Math.round((correct - wrong / 4) * 100) / 100;
}
