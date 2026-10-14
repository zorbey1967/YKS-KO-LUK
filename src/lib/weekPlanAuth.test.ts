import { describe, expect, it } from 'vitest';
import { canCoachWriteWeekPlan, canStudentWriteWeekPlan } from './weekPlanAuth';

describe('weekPlanAuth', () => {
  it('yalnızca aktif atama yazar', () => {
    expect(canCoachWriteWeekPlan({
      coachAccountActive: true,
      coachRowStatus: 'active',
      matchStatus: 'active',
      hasPastAppointment: true,
    })).toBe(true);
  });
  it('öğrenci aktif koç yoksa yazar', () => {
    expect(canStudentWriteWeekPlan(false)).toBe(true);
    expect(canStudentWriteWeekPlan(true)).toBe(false);
  });
});
