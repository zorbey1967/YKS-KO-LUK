/** Edge/RPC reddi. Hash gizleme bu kapının yerine geçmez. */

export function studentAiReject(role: string, isOwner: boolean) {
  if (isOwner) return null;
  if (role === 'coach') {
    return { status: 403 as const, error: 'Bu özellik öğrenci hesabına özel.' };
  }
  return null;
}

export function examScanReject(role: string, isOwner: boolean) {
  return studentAiReject(role, isOwner);
}

export function adminRpcAllowed(role: string, accountActive: boolean) {
  return role === 'admin' && accountActive;
}

export function weekPlanReadable(opts: {
  readerId: string;
  studentId: string;
  readerRole: string;
  isAdmin: boolean;
  assignedCoach: boolean;
}) {
  if (opts.isAdmin) return true;
  if (opts.readerId === opts.studentId) return true;
  if (opts.readerRole === 'coach' && opts.assignedCoach) return true;
  return false;
}
