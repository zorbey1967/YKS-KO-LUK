import { describe, expect, it } from 'vitest';
import {
  coachesToPasif,
  confirmOwnerUuid,
  disableSerialized,
  keepIdsForDisable,
  canDisableWithExpect,
  previewDisable,
  profilesToSuspend,
} from './disableNonOwner';

const owner = 'own-1';
const admin = 'adm-1';
const student = 'stu-1';
const coach = 'coa-1';
const inv = { total_profiles: 4, appointment_count: 7, meeting_count: 2, payment_count: 3, coach_rows: 1 };

describe('disableNonOwner', () => {
  it('boş tablo, pasif sahip ve yanlış UUID hiçbir hesabı kapatmaz', () => {
    expect(confirmOwnerUuid([], owner)).toBe(false);
    expect(profilesToSuspend(
      [{ id: student, role: 'student', account_status: 'active' }],
      [],
    ).skipped).toBe(true);
    expect(profilesToSuspend(
      [{ id: owner, role: 'admin', account_status: 'pasif' }],
      [owner],
      owner,
    ).ids).toEqual([]);
    expect(profilesToSuspend(
      [{ id: owner, role: 'admin', account_status: 'active' }, { id: student, role: 'student', account_status: 'active' }],
      [owner],
      'wrong-uuid',
    ).ids).toEqual([]);
    const prev = previewDisable({
      profiles: [{ id: owner, role: 'admin', account_status: 'active' }],
      ownerIds: [owner],
      confirmId: '00000000-0000-0000-0000-000000000000',
      coaches: [],
      inventory: inv,
    });
    expect(prev.skipped).toBe(true);
    expect(prev.would_suspend_profiles).toBe(0);
    expect(prev.total_profiles).toBe(4);
    expect(prev.appointment_count).toBe(7);
    expect(prev.meeting_count).toBe(2);
    const pasif = previewDisable({
      profiles: [{ id: owner, role: 'admin', account_status: 'pasif' }],
      ownerIds: [owner],
      confirmId: owner,
      coaches: [],
      inventory: inv,
    });
    expect(pasif.skipped).toBe(true);
    expect(pasif.reason).toContain('aktif sahip');
    expect(pasif.would_suspend_profiles).toBe(0);
  });

  it('doğrulanmış sahip + son yönetici kalır; tekrar ve eşzamanlı ikinci yazmaz', () => {
    const rows = [
      { id: owner, role: 'admin', account_status: 'active' },
      { id: student, role: 'student', account_status: 'active' },
      { id: coach, role: 'coach', account_status: 'active' },
    ];
    const first = profilesToSuspend(rows, [owner], owner);
    expect(first.skipped).toBe(false);
    expect(first.ids.sort()).toEqual([coach, student].sort());

    const after = rows.map((r) => (first.ids.includes(r.id) ? { ...r, account_status: 'pasif' } : r));
    expect(profilesToSuspend(after, [owner], owner).ids).toEqual([]);

    const shared = { profiles: [...rows], coaches: [{ user_id: coach, status: 'active' as const }] };
    const conc = disableSerialized(shared, [owner], owner, 4);
    expect(conc.filter((x) => x.wrote > 0)).toHaveLength(1);
    expect(conc.filter((x) => x.wrote === 0)).toHaveLength(3);
  });

  it('sahip yönetici değilse son aktif yönetici kilitlenmez', () => {
    const rows = [
      { id: owner, role: 'student', account_status: 'active' },
      { id: admin, role: 'admin', account_status: 'active' },
      { id: student, role: 'student', account_status: 'active' },
    ];
    const keep = keepIdsForDisable(rows, [owner]);
    expect(keep.keep.sort()).toEqual([admin, owner].sort());
    expect(profilesToSuspend(rows, [owner], owner).ids).toEqual([student]);
  });

  it('koç satırını pasife alır; randevu/görüşme/ödeme silinmez bayrakları önizlemededir', () => {
    const keep = keepIdsForDisable(
      [{ id: owner, role: 'admin', account_status: 'active' }],
      [owner],
    );
    expect(coachesToPasif(
      [{ user_id: owner, status: 'active' }, { user_id: coach, status: 'active' }],
      keep.keep,
    ).map((c) => c.user_id)).toEqual([coach]);
    const p = previewDisable({
      profiles: [
        { id: owner, role: 'admin', account_status: 'active' },
        { id: student, role: 'student', account_status: 'active' },
      ],
      ownerIds: [owner],
      confirmId: owner,
      coaches: [{ user_id: coach, status: 'active' }],
      inventory: inv,
    });
    expect(p.deleted).toBe(false);
    expect(p.appointments_preserved).toBe(true);
    expect(p.meetings_preserved).toBe(true);
    expect(p.payments_preserved).toBe(true);
    expect(p.would_suspend_profiles).toBe(1);
    expect(p.would_pasif_coaches).toBe(1);
    expect(p.payment_count).toBe(3);
    expect(canDisableWithExpect(p, null).ok).toBe(false);
    expect(canDisableWithExpect(p, {
      total_profiles: 4,
      would_suspend_profiles: 1,
      would_pasif_coaches: 1,
      coach_rows: 1,
      appointment_count: 7,
      meeting_count: 2,
      payment_count: 3,
    }).ok).toBe(true);
    expect(canDisableWithExpect(p, { ...p, payment_count: 99 }).ok).toBe(false);
  });
});
