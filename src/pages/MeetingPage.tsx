import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  appointmentIdFromHash,
  ensureMeetingRoom,
  fetchAppointmentForMeeting,
  joinReasonLabel,
  joinWindow,
  livekitPlaceholder,
  requestMeetingToken,
  serverCanJoin,
  type JoinBlockReason,
  type MeetingRoomRow,
  type MyAppointment,
} from '../lib/meeting';

export function MeetingPage() {
  const { user, go, toast } = useApp();
  const [apptId, setApptId] = useState(() => appointmentIdFromHash());
  const [row, setRow] = useState<MyAppointment | null>(null);
  const [reason, setReason] = useState<JoinBlockReason>(user ? 'not-found' : 'no-auth');
  const [room, setRoom] = useState<MeetingRoomRow | null>(null);
  const [roomNote, setRoomNote] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const livekit = livekitPlaceholder();

  useEffect(() => {
    const sync = () => setApptId(appointmentIdFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (!user) {
      setReason('no-auth');
      setRow(null);
      return;
    }
    if (!apptId) {
      setReason('not-found');
      setRow(null);
      return;
    }
    let alive = true;
    void (async () => {
      const found = await fetchAppointmentForMeeting(apptId, user.id);
      if (!alive) return;
      if (!found.ok) {
        setRow(null);
        setReason(found.reason);
        setRoom(null);
        setRoomNote('');
        setTokenReady(false);
        return;
      }
      setRow(found.row);
      setTokenReady(false);
      const local = joinWindow(found.row);
      const remote = await serverCanJoin(found.row.id);
      if (!alive) return;
      if (remote.schema) {
        setReason(remote.join ? 'ok' : (local.reason === 'ok' ? 'forbidden' : local.reason));
        if (remote.join) {
          const ensured = await ensureMeetingRoom(found.row.id);
          if (!alive) return;
          if ('id' in ensured) {
            setRoom(ensured);
            setRoomNote('');
          } else {
            setRoom(null);
            setRoomNote(ensured.error);
          }
        } else {
          setRoom(null);
          setRoomNote('');
        }
      } else {
        setReason(local.can ? 'missing-schema' : local.reason);
        setRoom(null);
        setRoomNote(local.can ? 'Sunucu join kontrolü yok (004 uygulanmadı). İstemci saati yetki sayılmaz; bağlantı kapalı.' : '');
      }
    })();
    return () => { alive = false; };
  }, [user, apptId]);

  const canShell = reason === 'ok';

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Görüşme</div>
        <h2>{row ? `${row.coachName} • ${row.date} ${row.time}` : 'Randevuya bağlı oda'}</h2>
        <p>Yalnızca onaylı randevu ve zaman penceresi. Kayıt kapalı. Kamera A3’te.</p>
      </div>

      {!user ? (
        <div className="notice" style={{ marginTop: 16 }}>
          Görüşme için giriş gerekli.
          <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('account')}>Giriş</button>
        </div>
      ) : null}

      {user && reason !== 'ok' ? (
        <div className={reason === 'missing-schema' ? 'notice' : 'notice'} style={{ marginTop: 16 }} role="status">
          {joinReasonLabel(reason)}
        </div>
      ) : null}

      {row ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Randevu</h3><span>{row.status}</span></div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
            {row.studentName} • {row.minutes} dk • kayıt yok
          </p>
        </div>
      ) : null}

      <div className="meeting-shell" style={{ marginTop: 16 }}>
        <div className="meeting-tile"><span>Sen</span><small>Kamera A3’te istenir</small></div>
        <div className="meeting-tile"><span>Karşı taraf</span><small>A3: LiveKit oda</small></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Bağlantı</h3><span>token</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {tokenReady ? 'Sunucu token verdi. Kamera/mikrofon A3’te bağlanır. Kayıt yok.' : livekit.reason}
        </p>
        {room ? <p style={{ fontSize: 13 }}>Oda durumu: {room.status} (kayıt kapalı)</p> : null}
        {roomNote ? <div className="notice">{roomNote}</div> : null}
        <div className="actions">
          <button
            className="btn primary"
            type="button"
            disabled={!canShell || tokenBusy || !row}
            onClick={() => {
              if (!row || reason !== 'ok') return;
              setTokenBusy(true);
              void requestMeetingToken(row.id).then((res) => {
                setTokenBusy(false);
                if (!res.ok) {
                  setTokenReady(false);
                  toast(res.error);
                  return;
                }
                setTokenReady(true);
                toast('Görüşme yetkisi alındı. Kamera A3’te açılır.');
              });
            }}
          >
            {tokenBusy ? 'İsteniyor…' : 'Bağlan'}
          </button>
          <button className="btn secondary" type="button" onClick={() => go('coaches')}>Ayrıl</button>
        </div>
        {canShell ? <p style={{ fontSize: 12, color: 'var(--muted)' }}>Yetki sunucuda can_join_meeting ile. getUserMedia yok. JWT ekranda gösterilmez.</p> : null}
      </div>
    </>
  );
}
