import { describe, expect, it } from 'vitest';
import { applyHeartbeat, canJoinCoachRoom, GAP_MS, libraryRosterPublic, mergeTabs } from './studyPresence';

describe('sessiz kütüphane süre', () => {
  it('çift sekme aynı satırı günceller; kopukluk süreyi şişirmez', () => {
    const t0 = 1_000_000;
    const a = { userId: 'u1', displayName: 'Ada', accumulatedMs: 0, lastSeen: t0, shareExams: false };
    const after = applyHeartbeat(a, t0 + 10_000);
    expect(after.accumulatedMs).toBe(10_000);
    const tab2 = mergeTabs(after, { ...a, accumulatedMs: 0 }, t0 + 20_000);
    expect(tab2.accumulatedMs).toBe(20_000);
    const gap = applyHeartbeat(tab2, tab2.lastSeen + GAP_MS + 1);
    expect(gap.accumulatedMs).toBe(tab2.accumulatedMs);
  });

  it('net paylaşımı varsayılan kapalıdır', () => {
    const roster = libraryRosterPublic([
      { userId: 'secret-uuid', displayName: 'Ada', accumulatedMs: 120000, lastSeen: 1, shareExams: false },
    ]);
    expect(roster[0].shareExams).toBe(false);
    expect(JSON.stringify(roster)).not.toContain('secret-uuid');
    expect(roster[0].lastExam).toBeNull();
  });

  it('koç odasına yalnız atanan, çıkarılmamış öğrenci girer', () => {
    expect(canJoinCoachRoom({
      studentId: 's1', coachUserId: 'c1', assignedStudentIds: ['s1'], kickedIds: [],
    })).toBe(true);
    expect(canJoinCoachRoom({
      studentId: 's2', coachUserId: 'c1', assignedStudentIds: ['s1'], kickedIds: [],
    })).toBe(false);
    expect(canJoinCoachRoom({
      studentId: 's1', coachUserId: 'c1', assignedStudentIds: ['s1'], kickedIds: ['s1'],
    })).toBe(false);
  });
});
