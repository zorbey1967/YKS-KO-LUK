/** Sessiz kütüphane / koç odası süre. Çift sekme aynı satır; kopukluk boşluğu sayılmaz. */

export const HEARTBEAT_MAX_MS = 30_000;
export const GAP_MS = 45_000;

export type PresenceRow = {
  userId: string;
  displayName: string;
  accumulatedMs: number;
  lastSeen: number;
  shareExams: boolean;
};

export function applyHeartbeat(row: PresenceRow, now: number): PresenceRow {
  const delta = now - row.lastSeen;
  const add = delta > 0 && delta <= GAP_MS ? Math.min(delta, HEARTBEAT_MAX_MS) : 0;
  return { ...row, accumulatedMs: row.accumulatedMs + add, lastSeen: now };
}

export function mergeTabs(existing: PresenceRow | null, incoming: PresenceRow, now: number): PresenceRow {
  if (!existing) return { ...incoming, lastSeen: now };
  return applyHeartbeat(existing, now);
}

export function canJoinCoachRoom(input: {
  studentId: string;
  coachUserId: string;
  assignedStudentIds: string[];
  kickedIds: string[];
}) {
  if (input.kickedIds.includes(input.studentId)) return false;
  return input.assignedStudentIds.includes(input.studentId);
}

export function libraryRosterPublic(rows: PresenceRow[]) {
  return rows.map((r) => ({
    displayName: r.displayName,
    minutes: Math.floor(r.accumulatedMs / 60000),
    lastExam: null as string | null,
    shareExams: r.shareExams,
  }));
}
