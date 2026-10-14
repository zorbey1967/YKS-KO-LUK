import type { AppointmentCancelDecision, AppointmentStatus } from './coaches';

export type CancelAppt = {
  id: string;
  status: AppointmentStatus;
  studentId: string;
  coachId: string;
  cancelDecision?: AppointmentCancelDecision | null;
};

/** 040: yalnız onaylı satır; taraf öğrenci veya o randevunun koçu. */
export function canRequestApprovedCancel(
  appt: CancelAppt,
  userId: string | null | undefined,
  asCoachForThisAppt: boolean,
) {
  if (!userId) return false;
  if (appt.status !== 'onay') return false;
  const party = appt.studentId === userId || asCoachForThisAppt;
  if (!party) return false;
  return appt.cancelDecision !== 'pending';
}

export function isDuplicateCancelRequest(appt: CancelAppt) {
  return appt.status === 'onay' && appt.cancelDecision === 'pending';
}

/** 040: öğrenci karar veremez (yönetici değilse). Koç veya sunucu isAdmin. */
export function canDecideApprovedCancel(
  appt: CancelAppt,
  userId: string | null | undefined,
  opts: { asCoachForThisAppt: boolean; isAdmin: boolean },
) {
  if (!userId) return false;
  if (appt.status !== 'onay') return false;
  if (appt.cancelDecision !== 'pending') return false;
  if (opts.isAdmin) return true;
  if (appt.studentId === userId && !opts.isAdmin) return false;
  return opts.asCoachForThisAppt;
}
