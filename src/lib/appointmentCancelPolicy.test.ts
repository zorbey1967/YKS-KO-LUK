import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canDecideApprovedCancel,
  canRequestApprovedCancel,
  isDuplicateCancelRequest,
} from './appointmentCancelPolicy';

const appt = {
  id: 'a1',
  status: 'onay' as const,
  studentId: 's1',
  coachId: 'c-row',
  cancelDecision: null as null,
};

describe('onaylı iptal politikası (039/040 ile uyum)', () => {
  it('yabancı öğrenci talep açamaz; taraf açar; pending iken yinelenir', () => {
    expect(canRequestApprovedCancel(appt, 's2', false)).toBe(false);
    expect(canRequestApprovedCancel({ ...appt, status: 'bekliyor' }, 's1', false)).toBe(false);
    expect(canRequestApprovedCancel(appt, 's1', false)).toBe(true);
    expect(canRequestApprovedCancel(appt, 'coach-user', true)).toBe(true);
    expect(isDuplicateCancelRequest({ ...appt, cancelDecision: 'pending' })).toBe(true);
    expect(canRequestApprovedCancel({ ...appt, cancelDecision: 'pending' }, 's1', false)).toBe(false);
  });

  it('öğrenci karar veremez; koç veya yönetici pending iken karar verir', () => {
    const pending = { ...appt, cancelDecision: 'pending' as const };
    expect(canDecideApprovedCancel(pending, 's1', { asCoachForThisAppt: false, isAdmin: false })).toBe(false);
    expect(canDecideApprovedCancel(pending, 's2', { asCoachForThisAppt: false, isAdmin: false })).toBe(false);
    expect(canDecideApprovedCancel(pending, 'coach-user', { asCoachForThisAppt: true, isAdmin: false })).toBe(true);
    expect(canDecideApprovedCancel(pending, 'admin', { asCoachForThisAppt: false, isAdmin: true })).toBe(true);
    expect(canDecideApprovedCancel(appt, 'coach-user', { asCoachForThisAppt: true, isAdmin: false })).toBe(false);
  });

  it('SQL: respond_appointment yok; silme yok; öğrenci decide bloğu var', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const s040 = readFileSync(join(root, 'supabase/migrations/040_approved_cancel_audit.sql'), 'utf8');
    const s039 = readFileSync(join(root, 'supabase/migrations/039_approved_appointment_cancel.sql'), 'utf8');
    expect(s039).not.toContain('create or replace function public.respond_appointment');
    expect(s040).not.toContain('create or replace function public.respond_appointment');
    expect(s040.toLowerCase()).not.toMatch(/delete from public\.appointments/);
    expect(s040).toContain('if appt.student_id = auth.uid() and not public.is_admin()');
    expect(s040).toContain("'deleted', false");
  });
});
