import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { appointmentStatusLabel } from '../lib/coaches';
import { fetchMyCoach } from '../lib/cloudPlatform';
import { listMyAppointments, type MyAppointment } from '../lib/meeting';
import { supabase, withTimeout } from '../lib/supabase';
import { partySafeAnalysis } from '../lib/meetingRecordings';

type RecRow = { appointment_id: string; recording_status: string };
type AiRow = { appointment_id: string; analysis_status: string; under_admin_review: boolean };

export function MeetingsPage() {
  const { user, go, profile } = useApp();
  const [rows, setRows] = useState<MyAppointment[]>([]);
  const [recs, setRecs] = useState<Map<string, RecRow>>(new Map());
  const [ai, setAi] = useState<Map<string, AiRow>>(new Map());
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const mine = await fetchMyCoach(user.id);
      const coachId = profile?.role === 'coach' && mine && mine.status === 'active' ? mine.id : null;
      const list = await listMyAppointments(user.id, coachId);
      if (!alive) return;
      if (!list.ok) {
        setMsg(list.error);
        return;
      }
      setRows(list.rows);
      if (!supabase) return;
      const rec = await withTimeout(supabase.from('meeting_recordings').select('appointment_id, recording_status'));
      if (!rec.error && rec.data) {
        setRecs(new Map((rec.data as RecRow[]).map((r) => [r.appointment_id, r])));
      }
      const st = await withTimeout(supabase.rpc('my_meeting_ai_status'));
      if (!st.error && Array.isArray(st.data)) {
        setAi(new Map((st.data as AiRow[]).map((r) => [r.appointment_id, r])));
      }
    })();
    return () => { alive = false; };
  }, [user, profile?.role]);

  if (!user) {
    return (
      <div className="card notice">
        <h3>Görüşmelerim</h3>
        <p className="muted">Kayıtlar için giriş gerekli.</p>
        <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title"><h3>Görüşmelerim</h3></div>
      <p className="muted">Kayıt varsayılan kapalı. LiveKit Egress bu ortamda bağlı değil; otomatik ses/video kaydı başlamaz. İki tarafın izni ve yaş doğrulaması olmadan kayıt açılmaz. Yapay zekâ sonucu hesap kapatmaz.</p>
      {msg ? <p className="notice" role="status">{msg}</p> : null}
      {!rows.length ? <p className="muted">Kayıtlı görüşme yok.</p> : null}
      {rows.map((a) => {
        const rec = recs.get(a.id);
        const analysis = ai.get(a.id);
        const safe = analysis ? partySafeAnalysis({ analysis_status: analysis.analysis_status, under_admin_review: analysis.under_admin_review }) : null;
        return (
          <div className="plan-item" key={a.id}>
            <span>
              {a.date} {a.time} • {a.minutes} dk<br />
              <small className="muted">Koç: {a.coachName} • {appointmentStatusLabel(a, 'student')}</small><br />
              <small className="muted">Kayıt: {rec?.recording_status || 'yok'} • Analiz: {safe?.analysisStatus || 'yok'}</small>
              {safe?.underAdminReview ? <small className="muted"><br />Bu görüşme inceleme kuyruğunda.</small> : null}
            </span>
            <button className="btn secondary" type="button" onClick={() => go('meeting', `id=${encodeURIComponent(a.id)}`)}>Aç</button>
          </div>
        );
      })}
    </div>
  );
}
