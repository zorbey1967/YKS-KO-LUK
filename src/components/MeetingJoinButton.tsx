import type { CoachAppointment } from '../lib/coaches';
import { isAppointmentParty, isMeetingJoinVisible, openMeeting } from '../lib/meeting';

export function MeetingJoinButton({
  appt,
  userId,
  coachId,
  now,
}: {
  appt: Pick<CoachAppointment, 'id' | 'date' | 'time' | 'minutes' | 'status' | 'studentId' | 'coachId' | 'startsAt'>;
  userId?: string | null;
  coachId?: string | null;
  now?: number;
}) {
  if (!isAppointmentParty(appt, userId, coachId)) return null;
  if (!appt.id || appt.status !== 'onay') return null;
  if (!isMeetingJoinVisible(appt, now)) return null;
  return (
    <button className="btn primary" type="button" onClick={() => openMeeting(appt.id)}>
      Görüşmeye Katıl
    </button>
  );
}
