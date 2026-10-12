import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchMyCoach } from '../lib/cloudPlatform';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { appointmentStatusLabel } from '../lib/coaches';
import { listMyAppointments, splitAppointmentsBySlot, type MyAppointment } from '../lib/meeting';
import { MeetingJoinButton } from './MeetingJoinButton';

export function NextAppointmentCard() {
  const { user, go } = useApp();
  const [current, setCurrent] = useState<MyAppointment | null>(null);
  const [oldCount, setOldCount] = useState(0);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const mine = await fetchMyCoach(user.id);
      const cid = mine && mine.status === 'active' ? mine.id : null;
      const res = await listMyAppointments(user.id, cid);
      if (!alive) return;
      if (!res.ok) {
        setReady(true);
        return;
      }
      const split = splitAppointmentsBySlot(res.rows);
      setCoachId(cid);
      setCurrent(split.current[0] || null);
      setOldCount(split.past.length);
      setReady(true);
    })();
    return () => { alive = false; };
  }, [user]);

  if (!user || !ready || (!current && oldCount === 0)) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">
        <h3>Sıradaki ders</h3>
        <button className="btn secondary" type="button" onClick={() => go('coaches')}>Koçlar</button>
      </div>
      {current ? (
        <div className="plan-item">
          <span>
            {current.studentId === user.id
              ? getCoachDisplayName(current.coachName)
              : getPersonDisplayName(current.studentName, 'Öğrenci')}
            {' • '}{current.date} {current.time} ({current.minutes} dk)
            <br />
            <small className="muted">{appointmentStatusLabel(current, current.studentId === user.id ? 'student' : 'coach')}</small>
          </span>
          <MeetingJoinButton appt={current} userId={user.id} coachId={coachId} />
        </div>
      ) : (
        <div className="empty">Bu saat için randevu yok.</div>
      )}
      {oldCount ? (
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn secondary" type="button" onClick={() => go('coaches', 'eski=1')}>
            Eski randevularım ({oldCount})
          </button>
        </div>
      ) : null}
    </div>
  );
}
