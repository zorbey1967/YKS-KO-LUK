import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const coachesPage = readFileSync(join(root, 'src/pages/CoachesPage.tsx'), 'utf8');
const sql = readFileSync(join(root, 'supabase/migrations/007_slots_reputation.sql'), 'utf8');

describe('randevu: bekleyen red ≠ onaylı iptal', () => {
  it('respond_appointment yalnız bekliyor satırını onaylar veya reddeder; silmez', () => {
    expect(sql).toContain("if appt.status is distinct from 'bekliyor'");
    expect(sql).toContain("raise exception 'talep açık değil'");
    expect(sql).toContain("set status = 'iptal' where id = appt.id and status = 'bekliyor'");
    expect(sql.toLowerCase()).not.toMatch(/delete from public\.appointments/);
  });

  it('035 koç DELETE kapatır; geçmiş satır RLS ile kalır', () => {
    const s = readFileSync(join(root, 'supabase/migrations/035_appointments_no_client_delete.sql'), 'utf8');
    expect(s).toContain('for delete using (public.is_admin())');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('039 onaylı iptal talebi respond_appointment’ı değiştirmez; silmez', () => {
    const s = readFileSync(join(root, 'supabase/migrations/039_approved_appointment_cancel.sql'), 'utf8');
    expect(s).toContain('request_cancel_approved_appointment');
    expect(s).toContain('decide_approved_appointment_cancel');
    expect(s).toContain("yalnız onaylı randevu için iptal talebi");
    expect(s).toContain('karar yalnız koç veya yönetici');
    expect(s).toContain("'ok', true, 'status', 'onay'");
    expect(s).toContain("'deleted', false");
    expect(s).not.toContain('create or replace function public.respond_appointment');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('040 denetim tablosu; öğrenci karar veremez; duplicate kilit', () => {
    const s = readFileSync(join(root, 'supabase/migrations/040_approved_cancel_audit.sql'), 'utf8');
    expect(s).toContain('appointment_cancel_events');
    expect(s).toContain('for update');
    expect(s).toContain("'duplicate'");
    expect(s).toContain('if appt.student_id = auth.uid() and not public.is_admin()');
    expect(s).not.toContain('create or replace function public.respond_appointment');
  });

  it('koç UI reddi yalnız bekliyor talebe; onaylı iptal ayrı RPC', () => {
    expect(coachesPage).toContain("asCoach && a.status === 'bekliyor'");
    expect(coachesPage).toContain('Reddet');
    expect(coachesPage).toContain('Onayla');
    expect(coachesPage).toContain('requestCancelApprovedAppointment');
    expect(coachesPage).toContain('decideApprovedAppointmentCancel');
    expect(coachesPage).toContain('canRequestApprovedCancel');
    expect(coachesPage).toContain('canDecideApprovedCancel');
    expect(coachesPage).not.toContain("respondAppointment(a.id, false)");
  });
});
