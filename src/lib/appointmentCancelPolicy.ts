import type { AppointmentCancelDecision, AppointmentStatus } from './coaches';

export type CancelAppt = {
  id: string;
  status: AppointmentStatus;
  studentId: string;
  coachId: string;
  cancelDecision?: AppointmentCancelDecision | null;
  cancelRequestedBy?: string | null;
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

/** 063: talebi açan taraf karar veremez; karşı taraf (öğrenci veya o randevunun koçu) ya da yönetici karar verir. */
export function canDecideApprovedCancel(
  appt: CancelAppt,
  userId: string | null | undefined,
  opts: { asCoachForThisAppt: boolean; isAdmin: boolean },
) {
  if (!userId) return false;
  if (appt.status !== 'onay') return false;
  if (appt.cancelDecision !== 'pending') return false;
  if (opts.isAdmin) return true;
  const party = appt.studentId === userId || opts.asCoachForThisAppt;
  if (!party) return false;
  if (!appt.cancelRequestedBy) return opts.asCoachForThisAppt;
  return appt.cancelRequestedBy !== userId;
}
