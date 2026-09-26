import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useApp } from '../context/AppContext';
import { appointmentStatusLabel } from '../lib/coaches';
import {
  appointmentIdFromHash,
  endMeetingSession,
  ensureMeetingRoom,
  fetchAppointmentForMeeting,
  fetchMeetingSession,
  formatLessonClock,
  joinReasonLabel,
  livekitPlaceholder,
  requestMeetingToken,
  serverCanJoin,
  setMeetingPresence,
  type JoinBlockReason,
  type MeetingRoomRow,
  type MeetingSessionState,
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
  const [session, setSession] = useState<MeetingSessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const livekit = livekitPlaceholder();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<Room | null>(null);
  const connectedRef = useRef(false);
  const endingRef = useRef(false);
  const tokenExpiresAtRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const sync = () => setApptId(appointmentIdFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    endingRef.current = false;
  }, [apptId]);

  function detach() {
    const lk = sessionRef.current;
    sessionRef.current = null;
    connectedRef.current = false;
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
        setSession(null);
        detach();
        return;
      }
      setRow(found.row);
      const statusReason: JoinBlockReason =
        found.row.status === 'bekliyor' ? 'pending'
          : found.row.status === 'iptal' ? 'cancelled'
            : found.row.status === 'tamamlandi' ? 'done'
              : found.row.status !== 'onay' ? 'pending'
                : 'ok';
      const remote = await serverCanJoin(found.row.id);
      if (!alive) return;
      if (!remote.schema) {
        setReason('missing-schema');
        setRoom(null);
        setRoomNote('Sunucu join kontrolü yok. İstemci saati yetki sayılmaz; bağlantı kapalı.');
        return;
      }
      if (statusReason !== 'ok') {
        setReason(statusReason);
        setRoom(null);
        setRoomNote('');
        return;
      }
      setReason(remote.join ? 'ok' : 'forbidden');
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
    })();
    return () => { alive = false; };
  }, [user, apptId]);

  useEffect(() => {
    if (!user || !apptId || reason === 'no-auth' || reason === 'not-found') return;
    let alive = true;
    const tick = async () => {
      const res = await fetchMeetingSession(apptId);
      if (!alive) return;
      if (!res.ok) return;
      setSession(res.state);
      if (res.state.status === 'ended' || res.state.remainingSec === 0) {
        if (!endingRef.current) {
          endingRef.current = true;
          void endMeetingSession(apptId);
          if (connectedRef.current) {
            detach();
            toast('Görüşme sona erdi.');
          }
        }
        setReason((r) => (r === 'ok' ? 'done' : r));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => { alive = false; window.clearInterval(id); };
  }, [user, apptId, reason, toast]);

  useEffect(() => {
    if (!connected || !apptId) return;
    let alive = true;
    const beat = async () => {
      const res = await setMeetingPresence(apptId, true);
      if (!alive) return;
      if (res.ok) setSession(res.state);
    };
    void beat();
    const id = window.setInterval(() => void beat(), 10000);
    return () => {
      alive = false;
      window.clearInterval(id);
      void setMeetingPresence(apptId, false);
    };
  }, [connected, apptId]);

  useEffect(() => {
    if (!connected || !apptId || !row?.id) return;
    let alive = true;
    let timer = 0;
    const schedule = () => {
      const left = tokenExpiresAtRef.current - Date.now() - 90_000;
      timer = window.setTimeout(() => {
        void (async () => {
          if (!alive || !connectedRef.current || endingRef.current) return;
          const tok = await requestMeetingToken(row.id);
          if (!alive || !connectedRef.current) return;
          if (!tok.ok) {
            detach();
            setReason('done');
            toast(tokenErrorMessage(tok.error, tok.status));
            return;
          }
          tokenExpiresAtRef.current = Date.parse(tok.data.expiresAt) || Date.now() + 600_000;
          const lk = sessionRef.current;
          if (!lk) return;
          refreshingRef.current = true;
          try {
            await lk.disconnect();
            await lk.connect(tok.data.url, tok.data.token);
            await lk.localParticipant.enableCameraAndMicrophone();
            const cam = lk.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
            if (cam && localRef.current) cam.attach(localRef.current);
            if (alive) schedule();
          } catch {
            if (alive) {
              detach();
              toast('Görüşme bağlantısı yenilenemedi.');
            }
          } finally {
            refreshingRef.current = false;
          }
        })();
      }, Math.max(5_000, left));
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [connected, apptId, row?.id, toast]);

  const ended = session?.status === 'ended' || session?.remainingSec === 0 || reason === 'done';
  const canShell = reason === 'ok' && !ended;
  const remaining = session?.remainingSec ?? null;
  const waitingOther = connected && remaining === null && session?.status !== 'ended';

  async function joinLive() {
    if (!row || !canShell || busy || ended) return;
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
      lk.on(RoomEvent.Disconnected, () => {
        if (refreshingRef.current) return;
        connectedRef.current = false;
        setConnected(false);
      });
      await lk.connect(tok.data.url, tok.data.token);
      await lk.localParticipant.enableCameraAndMicrophone();
      const cam = lk.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cam && localRef.current) cam.attach(localRef.current);
      tokenExpiresAtRef.current = Date.parse(tok.data.expiresAt) || Date.now() + 600_000;
      connectedRef.current = true;
      setConnected(true);
      toast('Görüşme açık. Kayıt yok.');
    } catch (e) {
      detach();
      toast(mediaErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function finishMeeting() {
    if (!row?.id || endingRef.current) return;
    endingRef.current = true;
    const res = await endMeetingSession(row.id);
    detach();
    setReason('done');
    setSession((s) => (s ? { ...s, status: 'ended', remainingSec: 0 } : s));
    if (!res.ok) toast(res.error);
    else toast('Görüşme sona erdi.');
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Görüşme</div>
        <h2>{row ? `${row.coachName} • ${row.date} ${row.time}` : 'Randevuya bağlı oda'}</h2>
        <p>Onaylı randevuya istediğin zaman girilir. Sayaç, randevu saati sonrası iki taraf da odadayken 40:00 başlar. Kayıt kapalı.</p>
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
        <div className="section-title"><h3>Bağlantı</h3><span>{ended ? 'bitti' : connected ? 'canlı' : 'kayıt kapalı'}</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {ended
            ? 'Görüşme sona erdi. Yeniden başlatılmaz.'
            : connected
              ? (waitingOther ? 'Karşı taraf bekleniyor. Sayaç henüz başlamadı.' : livekit.reason)
              : livekit.reason}
        </p>
        {remaining !== null && !ended ? (
          <p style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>{formatLessonClock(remaining)}</p>
        ) : null}
        {waitingOther ? <p style={{ fontSize: 13 }}>Öğrenci ve koç aynı odadayken süre 40:00’dan başlar.</p> : null}
        {room ? <p style={{ fontSize: 13 }}>Oda durumu: {ended ? 'ended' : room.status}</p> : null}
        {roomNote ? <div className="notice">{roomNote}</div> : null}
        <div className="actions">
          <button className="btn primary" type="button" disabled={!canShell || busy || !row || connected || ended} onClick={() => void joinLive()}>
            {busy ? 'Bağlanıyor…' : 'Bağlan'}
          </button>
          <button className="btn secondary" type="button" disabled={!row || ended} onClick={() => void finishMeeting()}>
            Görüşmeyi Bitir
          </button>
          <button className="btn secondary" type="button" onClick={() => { detach(); go('coaches'); }}>Ayrıl</button>
        </div>
        {canShell ? <p style={{ fontSize: 12, color: 'var(--muted)' }}>Token sunucuda üretilir. İzin tarayıcıdan istenir. 18 yaş kilidi yok.</p> : null}
      </div>
    </>
  );
}
