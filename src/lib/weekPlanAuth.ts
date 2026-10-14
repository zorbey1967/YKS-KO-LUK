export type WeekPlanCoachWrite = {
  coachAccountActive: boolean;
  coachRowStatus: 'active' | 'pasif' | 'pending' | 'rejected';
  matchStatus: 'active' | 'ended' | null;
  hasPastAppointment: boolean;
};

export function canCoachWriteWeekPlan(input: WeekPlanCoachWrite) {
  return (
    input.coachAccountActive
    && input.coachRowStatus === 'active'
    && input.matchStatus === 'active'
  );
}

export function canStudentWriteWeekPlan(hasActiveAssignedCoach: boolean) {
  return !hasActiveAssignedCoach;
}
