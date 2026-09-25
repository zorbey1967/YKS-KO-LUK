import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useApp } from '../context/AppContext';
import { appointmentStatusLabel } from '../lib/coaches';
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

function tokenErrorMessage(error: string, status?: number) {
  if (status === 401) return 'Oturum gerekli veya süresi doldu. Hesabım’dan tekrar gir.';
  if (status === 403) return 'Bu görüşmeye katılamazsın. Onaylı randevu, tarafın olman ve zaman penceresi gerekir.';
  if (status === 503) return 'Görüşme sunucusu ayarı yok veya geçici hata.';
  return error;
}

function mediaErrorMessage(e: unknown) {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Kamera veya mikrofon izni reddedildi.';
  }
  if (name === 'NotFoundError') return 'Kamera veya mikrofon bulunamadı.';
  return 'Görüşmeye bağlanılamadı.';
}

export function MeetingPage() {
  const { user, go, toast, profile } = useApp();
  const [apptId, setApptId] = useState(() => appointmentIdFromHash());
  const [row, setRow] = useState<MyAppointment | null>(null);
  const [reason, setReason] = useState<JoinBlockReason>(user ? 'not-found' : 'no-auth');
  const [room, setRoom] = useState<MeetingRoomRow | null>(null);
  const [roomNote, setRoomNote] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const livekit = livekitPlaceholder();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<Room | null>(null);

  useEffect(() => {
    const sync = () => setApptId(appointmentIdFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function detach() {
    const lk = sessionRef.current;
    sessionRef.current = null;
    if (lk) {
      lk.removeAllListeners();
      void lk.disconnect();
    }
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setConnected(false);
  }

  useEffect(() => () => { detach(); }, []);

  useEffect(() => {
    if (!user) {
      setReason('no-auth');
      setRow(null);
      detach();
      return;
    }
    if (!apptId) {
      setReason('not-found');
      setRow(null);
      detach();
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
        detach();
        return;
      }
      setRow(found.row);
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
        setRoomNote(local.can ? 'Sunucu join kontrolü yok. İstemci saati yetki sayılmaz; bağlantı kapalı.' : '');
      }
    })();
    return () => { alive = false; };
  }, [user, apptId]);

  const canShell = reason === 'ok';

  async function joinLive() {
    if (!row || reason !== 'ok' || busy) return;
    if (row.status !== 'onay' || !row.id) {
      toast('Yalnız onaylı randevuya katılınır.');
      return;
    }
    setBusy(true);
    detach();
    try {
      const tok = await requestMeetingToken(row.id);
      if (!tok.ok) {
        toast(tokenErrorMessage(tok.error, tok.status));
        return;
      }
      const lk = new Room({ adaptiveStream: true, dynacast: true });
      sessionRef.current = lk;
      lk.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && remoteRef.current) track.attach(remoteRef.current);
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
      });
      lk.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); });
      lk.on(RoomEvent.Disconnected, () => setConnected(false));
      await lk.connect(tok.data.url, tok.data.token);
      await lk.localParticipant.enableCameraAndMicrophone();
      const cam = lk.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cam && localRef.current) cam.attach(localRef.current);
      setConnected(true);
      toast('Görüşme açık. Kayıt yok.');
    } catch (e) {
      detach();
      toast(mediaErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Görüşme</div>
        <h2>{row ? `${row.coachName} • ${row.date} ${row.time}` : 'Randevuya bağlı oda'}</h2>
        <p>Onaylı randevu ve zaman penceresi. Kayıt kapalı. Kamera ve mikrofon izni istenir.</p>
      </div>

      {!user ? (
        <div className="notice" style={{ marginTop: 16 }}>
          Görüşme için giriş gerekli.
          <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('account')}>Giriş</button>
        </div>
      ) : null}

      {user && reason !== 'ok' ? (
        <div className="notice" style={{ marginTop: 16 }} role="status">
          {joinReasonLabel(reason)}
        </div>
      ) : null}

      {row ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Randevu</h3><span>{row.status}</span></div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
            {row.studentName} • {row.minutes} dk • kayıt yok
          </p>
          <p style={{ fontSize: 13, marginTop: 0 }}>{appointmentStatusLabel(row, row.studentId === user?.id ? 'student' : 'coach')}</p>
          {row.cancelReason === 'student_no_show' ? (
            <div className="notice" role="status">
              {row.studentId === user?.id
                ? `Otomatik iptal: derse ilk 10 dakikada katılmadın. Puanın düştü. Kalan puan: ${profile?.score ?? '—'}.`
                : 'Öğrenci ilk 10 dakikada katılmadığı için randevu no-show iptal edildi.'}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="meeting-shell" style={{ marginTop: 16 }}>
        <div className="meeting-tile">
          <video ref={localRef} autoPlay muted playsInline />
          <span>Sen</span>
        </div>
        <div className="meeting-tile">
          <video ref={remoteRef} autoPlay playsInline />
          <span>Karşı taraf</span>
          <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Bağlantı</h3><span>{connected ? 'canlı' : 'kayıt kapalı'}</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {connected ? 'Oda açık. Kayıt alınmıyor.' : livekit.reason}
        </p>
        {room ? <p style={{ fontSize: 13 }}>Oda durumu: {room.status}</p> : null}
        {roomNote ? <div className="notice">{roomNote}</div> : null}
        <div className="actions">
          <button className="btn primary" type="button" disabled={!canShell || busy || !row || connected} onClick={() => void joinLive()}>
            {busy ? 'Bağlanıyor…' : 'Bağlan'}
          </button>
          <button className="btn secondary" type="button" onClick={() => { detach(); go('coaches'); }}>Ayrıl</button>
        </div>
        {canShell ? <p style={{ fontSize: 12, color: 'var(--muted)' }}>Token sunucuda üretilir. İzin tarayıcıdan istenir. 18 yaş kilidi yok.</p> : null}
      </div>
    </>
  );
}
