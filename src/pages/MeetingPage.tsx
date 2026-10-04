import { useEffect, useRef, useState } from 'react';
import { ConnectionState, isRemoteParticipant, Room, RoomEvent, Track } from 'livekit-client';
import { useApp } from '../context/AppContext';
import {
  appointmentIdFromHash,
  endMeetingSession,
  ensureMeetingRoom,
  fetchAppointmentForMeeting,
  fetchMeetingSession,
  formatLessonClock,
  joinReasonLabel,
  requestMeetingToken,
  newMeetingConnectionId,
  serverCanJoin,
  setMeetingPresence,
  tokenErrorMessage,
  type JoinBlockReason,
  type MeetingSessionState,
  type MyAppointment,
} from '../lib/meeting';
import {
  attachLocalCamera,
  createMeetingRoom,
  ensureAudioPlayback,
  logMeetingErr,
  syncRemoteMedia,
  tryEnableCamera,
  tryEnableMicrophone,
  type MediaToggleResult,
} from '../lib/meetingLivekit';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = (parts[0] || 'G').charAt(0);
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : (parts[0] || '').charAt(1);
  return `${a}${b}`.toUpperCase();
}

function mediaUserMessage(kind: 'kamera' | 'mikrofon', result: MediaToggleResult) {
  if (result.ok) return '';
  if (result.reason === 'denied') {
    return kind === 'kamera' ? 'Kamera izni yok. Görüşme açık kalır.' : 'Mikrofon izni yok. Görüşme açık kalır.';
  }
  if (result.reason === 'missing') {
    return kind === 'kamera' ? 'Kamera bulunamadı. Görüşme açık kalır.' : 'Mikrofon bulunamadı. Görüşme açık kalır.';
  }
  return kind === 'kamera' ? 'Kamera açılamadı. Görüşme açık kalır.' : 'Mikrofon açılamadı. Görüşme açık kalır.';
}

export function MeetingPage() {
  const { user, go, toast, profile } = useApp();
  const [apptId, setApptId] = useState(() => appointmentIdFromHash());
  const [row, setRow] = useState<MyAppointment | null>(null);
  const [reason, setReason] = useState<JoinBlockReason>(user ? 'not-found' : 'no-auth');
  const [roomNote, setRoomNote] = useState('');
  const [session, setSession] = useState<MeetingSessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [peerIn, setPeerIn] = useState(false);
  const [peerVideo, setPeerVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [netHint, setNetHint] = useState('');
  const [joinError, setJoinError] = useState('');
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<Room | null>(null);
  const connectedRef = useRef(false);
  const endingRef = useRef(false);
  const tokenExpiresAtRef = useRef(0);
  const refreshingRef = useRef(false);
  const autoJoinForRef = useRef('');
  const joinGenRef = useRef(0);
  const camOnRef = useRef(false);
  const micOnRef = useRef(false);
  const resyncTimerRef = useRef<number[]>([]);
  const lkConnIdRef = useRef('');
  const mediaBusyRef = useRef(false);
  const joinLockRef = useRef(false);
  const [endArmed, setEndArmed] = useState(false);
  const endArmTimerRef = useRef(0);

  function applyRemote(lk: Room) {
    if (sessionRef.current !== lk) return;
    const { anyone, hasVideo } = syncRemoteMedia(lk, remoteRef.current, remoteAudioRef.current);
    setPeerIn(anyone);
    setPeerVideo(hasVideo);
  }

  function clearResync() {
    for (const id of resyncTimerRef.current) window.clearTimeout(id);
    resyncTimerRef.current = [];
  }

  function clearEndArm() {
    if (endArmTimerRef.current) window.clearTimeout(endArmTimerRef.current);
    endArmTimerRef.current = 0;
    setEndArmed(false);
  }

  function scheduleResync(lk: Room) {
    applyRemote(lk);
    for (const ms of [80, 250, 800]) {
      const id = window.setTimeout(() => {
        if (sessionRef.current === lk && connectedRef.current) applyRemote(lk);
      }, ms);
      resyncTimerRef.current.push(id);
    }
  }

  function listenRoom(lk: Room) {
    const onRemoteChange = () => applyRemote(lk);
    lk.on(RoomEvent.Connected, onRemoteChange);
    lk.on(RoomEvent.Reconnected, onRemoteChange);
    lk.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (sessionRef.current !== lk) return;
      if (state === ConnectionState.Connected) {
        setNetHint('');
        applyRemote(lk);
        return;
      }
      if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
        setNetHint('Bağlantı yeniden kuruluyor…');
      }
    });
    lk.on(RoomEvent.Disconnected, () => {
      if (refreshingRef.current) return;
      if (lk.state === ConnectionState.Reconnecting || lk.state === ConnectionState.SignalReconnecting) return;
      connectedRef.current = false;
      setConnected(false);
      setPeerIn(false);
      setPeerVideo(false);
      setNetHint('Bağlantı koptu.');
    });
    lk.on(RoomEvent.MediaDevicesError, (err) => {
      logMeetingErr('mediaDevicesError', err);
    });
    lk.on(RoomEvent.ParticipantConnected, (participant) => {
      if (!isRemoteParticipant(participant)) return;
      if (participant.identity === lk.localParticipant.identity) return;
      applyRemote(lk);
    });
    lk.on(RoomEvent.ParticipantDisconnected, onRemoteChange);
    lk.on(RoomEvent.TrackPublished, onRemoteChange);
    lk.on(RoomEvent.TrackUnpublished, onRemoteChange);
    lk.on(RoomEvent.TrackMuted, onRemoteChange);
    lk.on(RoomEvent.TrackUnmuted, onRemoteChange);
    lk.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (!isRemoteParticipant(participant)) return;
      if (participant.identity === lk.localParticipant.identity) return;
      if (track.kind === Track.Kind.Video && remoteRef.current) track.attach(remoteRef.current);
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
      applyRemote(lk);
    });
    lk.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      if (!isRemoteParticipant(participant)) return;
      track.detach();
      applyRemote(lk);
    });
    lk.on(RoomEvent.LocalTrackPublished, () => {
      attachLocalCamera(lk, localRef.current);
    });
  }

  useEffect(() => {
    const sync = () => setApptId(appointmentIdFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    endingRef.current = false;
    autoJoinForRef.current = '';
    joinGenRef.current += 1;
    lkConnIdRef.current = '';
    detach();
    setSession(null);
    setRoomNote('');
  }, [apptId]);

  function detach() {
    clearResync();
    clearEndArm();
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
    setCamOn(false);
    setMicOn(false);
    camOnRef.current = false;
    micOnRef.current = false;
    setPeerIn(false);
    setPeerVideo(false);
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
        setRoomNote('Sunucu join kontrolü yok. İstemci saati yetki sayılmaz; bağlantı kapalı.');
        return;
      }
      if (statusReason !== 'ok') {
        setReason(statusReason);
        setRoomNote('');
        return;
      }
      setReason(remote.join ? 'ok' : 'forbidden');
      if (remote.join) {
        const ensured = await ensureMeetingRoom(found.row.id);
        if (!alive) return;
        if ('id' in ensured) {
          setRoomNote('');
        } else {
          setRoomNote(ensured.error);
        }
      } else {
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
          const tok = await requestMeetingToken(row.id, lkConnIdRef.current);
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
          const keepCam = camOnRef.current;
          const keepMic = micOnRef.current;
          try {
            await lk.disconnect();
            await lk.connect(tok.data.url, tok.data.token, { autoSubscribe: true });
            scheduleResync(lk);
            void ensureAudioPlayback(lk);
            if (keepCam) {
              const cam = await tryEnableCamera(lk, localRef.current);
              camOnRef.current = cam.ok;
              setCamOn(cam.ok);
            } else {
              camOnRef.current = false;
              setCamOn(false);
            }
            if (keepMic) {
              const mic = await tryEnableMicrophone(lk);
              micOnRef.current = mic.ok;
              setMicOn(mic.ok);
            } else {
              micOnRef.current = false;
              setMicOn(false);
            }
          } catch (err) {
            logMeetingErr('Room.connect.refresh', err);
            if (alive) {
              detach();
              toast('Görüşme bağlantısı yenilenemedi.');
            }
            return;
          } finally {
            refreshingRef.current = false;
          }
          if (alive) schedule();
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
  const dropped = !connected && !busy && netHint === 'Bağlantı koptu.';
  const reconnecting = Boolean(netHint) && connected;
  const phase = ended
    ? 'ended'
    : busy || (canShell && !connected && !dropped)
      ? 'connecting'
      : dropped
        ? 'dropped'
        : reconnecting
          ? 'reconnect'
          : connected && !peerIn
            ? 'waiting'
            : connected && peerIn
              ? 'live'
              : 'idle';
  const statusLabel = ended
    ? (session?.remainingSec === 0 ? 'Süre doldu' : 'Sona erdi')
    : phase === 'connecting'
      ? 'Bağlanıyor'
      : phase === 'dropped'
        ? 'Bağlantı kesildi'
        : phase === 'reconnect'
          ? 'Yeniden bağlanıyor'
          : phase === 'waiting'
            ? 'Karşı taraf bekleniyor'
            : phase === 'live'
              ? (remaining === null ? 'Bağlı' : 'Görüşme aktif')
              : 'Kapalı';
  const statusKind = ended || phase === 'dropped' ? 'is-end' : phase === 'live' ? 'is-live' : phase === 'connecting' || phase === 'waiting' || phase === 'reconnect' ? 'is-wait' : '';
  const showRetry = (canShell && !!row && !connected && !busy && !ended && autoJoinForRef.current === row.id) || (dropped && canShell && !!row && !busy);
  const selfName = (profile?.name || 'Siz').trim() || 'Siz';
  const peerName = row
    ? (row.studentId === user?.id ? row.coachName : row.studentName) || 'Karşı taraf'
    : 'Karşı taraf';
  const clockLabel = ended ? '00:00' : remaining !== null ? formatLessonClock(remaining) : '—:—';
  const selfMediaLine = `${camOn ? 'Kamera açık' : 'Kamera kapalı'} · ${micOn ? 'Mikrofon açık' : 'Mikrofon kapalı'}`;

  async function joinLive() {
    if (!row || !canShell || busy || ended || joinLockRef.current) return;
    if (row.status !== 'onay' || !row.id) {
      toast('Yalnız onaylı randevuya katılınır.');
      return;
    }
    joinLockRef.current = true;
    setBusy(true);
    setJoinError('');
    setNetHint('');
    const gen = joinGenRef.current;
    const prev = sessionRef.current;
    sessionRef.current = null;
    connectedRef.current = false;
    clearResync();
    if (prev) {
      prev.removeAllListeners();
      try { await prev.disconnect(); } catch { /* ignore */ }
    }
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setConnected(false);
    setCamOn(false);
    setMicOn(false);
    camOnRef.current = false;
    micOnRef.current = false;
    setPeerIn(false);
    setPeerVideo(false);
    if (gen !== joinGenRef.current) {
      joinLockRef.current = false;
      setBusy(false);
      return;
    }
    if (!lkConnIdRef.current) lkConnIdRef.current = newMeetingConnectionId();
    try {
      let tok: Awaited<ReturnType<typeof requestMeetingToken>>;
      try {
        tok = await requestMeetingToken(row.id, lkConnIdRef.current);
      } catch {
        setJoinError('Görüşmeye bağlanılamadı.');
        toast('Görüşmeye bağlanılamadı.');
        return;
      }
      if (gen !== joinGenRef.current) return;
      if (!tok.ok) {
        const msg = tokenErrorMessage(tok.error, tok.status);
        setJoinError(msg);
        toast(msg);
        return;
      }
      const lk = createMeetingRoom();
      sessionRef.current = lk;
      listenRoom(lk);
      try {
        await lk.connect(tok.data.url, tok.data.token, { autoSubscribe: true });
      } catch (err) {
        logMeetingErr('Room.connect', err);
        if (gen === joinGenRef.current) {
          detach();
          setJoinError('Görüşmeye bağlanılamadı.');
          toast('Görüşmeye bağlanılamadı.');
        }
        return;
      }
      if (gen !== joinGenRef.current) {
        if (sessionRef.current === lk) sessionRef.current = null;
        lk.removeAllListeners();
        void lk.disconnect();
        return;
      }
      tokenExpiresAtRef.current = Date.parse(tok.data.expiresAt) || Date.now() + 600_000;
      connectedRef.current = true;
      setConnected(true);
      camOnRef.current = false;
      micOnRef.current = false;
      setCamOn(false);
      setMicOn(false);
      setNetHint('');
      scheduleResync(lk);
      void ensureAudioPlayback(lk);
    } finally {
      joinLockRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user?.id || !row?.id || row.status !== 'onay' || !canShell || ended || connected || busy) return;
    if (joinLockRef.current) return;
    if (autoJoinForRef.current === row.id) return;
    autoJoinForRef.current = row.id;
    void joinLive();
  }, [user?.id, row, canShell, ended, connected, busy]);

  async function openCamera() {
    const lk = sessionRef.current;
    if (!lk || !connectedRef.current || mediaBusyRef.current) return;
    mediaBusyRef.current = true;
    try {
      if (camOn) {
        try {
          await lk.localParticipant.setCameraEnabled(false);
          if (localRef.current) localRef.current.srcObject = null;
          camOnRef.current = false;
          setCamOn(false);
        } catch (err) {
          logMeetingErr('setCameraEnabled(false)', err);
        }
        return;
      }
      void ensureAudioPlayback(lk);
      const result = await tryEnableCamera(lk, localRef.current);
      camOnRef.current = result.ok;
      setCamOn(result.ok);
      if (!result.ok) toast(mediaUserMessage('kamera', result));
    } finally {
      mediaBusyRef.current = false;
    }
  }

  async function openMicrophone() {
    const lk = sessionRef.current;
    if (!lk || !connectedRef.current || mediaBusyRef.current) return;
    mediaBusyRef.current = true;
    try {
      if (micOn) {
        try {
          await lk.localParticipant.setMicrophoneEnabled(false);
          micOnRef.current = false;
          setMicOn(false);
        } catch (err) {
          logMeetingErr('setMicrophoneEnabled(false)', err);
        }
        return;
      }
      void ensureAudioPlayback(lk);
      const result = await tryEnableMicrophone(lk);
      micOnRef.current = result.ok;
      setMicOn(result.ok);
      if (!result.ok) toast(mediaUserMessage('mikrofon', result));
    } finally {
      mediaBusyRef.current = false;
    }
  }

  async function finishMeeting() {
    if (!row?.id || endingRef.current || !connectedRef.current) return;
    if (!endArmed) {
      setEndArmed(true);
      if (endArmTimerRef.current) window.clearTimeout(endArmTimerRef.current);
      endArmTimerRef.current = window.setTimeout(() => setEndArmed(false), 4000);
      return;
    }
    clearEndArm();
    endingRef.current = true;
    const res = await endMeetingSession(row.id);
    detach();
    setReason('done');
    setSession((s) => (s ? { ...s, status: 'ended', remainingSec: 0 } : s));
    if (!res.ok) toast(res.error);
    else toast('Görüşme sona erdi.');
  }

  return (
    <div className={`meeting-room meeting-room--${phase}`}>
      <div className="meeting-stage" onClick={() => { const lk = sessionRef.current; if (lk && connectedRef.current) void ensureAudioPlayback(lk); }}>
        <div className="meeting-hud">
          <button className="meeting-hud-back" type="button" onClick={() => { detach(); go('coaches'); }}>Randevular</button>
          <p className={`meeting-clock${remaining === null && !ended ? ' meeting-clock--idle' : ''}`} aria-live="polite">{clockLabel}</p>
          <span className={`meeting-pill ${statusKind}`}>{statusLabel}</span>
        </div>

        <div className={`meeting-tile meeting-tile--remote${peerVideo ? '' : ' is-idle'}`}>
          <video ref={remoteRef} className={peerVideo ? '' : 'is-off'} autoPlay playsInline />
          {!peerVideo ? (
            <div className="meeting-placeholder">
              <div className="meeting-avatar" aria-hidden="true">{initials(peerName)}</div>
              <p className="meeting-placeholder-title">
                {ended
                  ? (session?.remainingSec === 0 ? 'Toplantı süresi doldu' : 'Görüşme sona erdi')
                  : phase === 'connecting'
                    ? 'Bağlantı kuruluyor'
                    : phase === 'dropped'
                      ? 'Bağlantı kesildi'
                      : phase === 'reconnect'
                        ? 'Bağlantı yeniden kuruluyor'
                        : peerIn
                          ? peerName
                          : 'Karşı taraf bekleniyor'}
              </p>
              {!ended && peerIn ? <p className="meeting-placeholder-sub">Kamera kapalı</p> : null}
              {!ended && !peerIn && connected ? <p className="meeting-placeholder-sub">Bağlı · {selfMediaLine}</p> : null}
              {phase === 'connecting' ? <p className="meeting-placeholder-sub">Odaya bağlanılıyor…</p> : null}
              {phase === 'dropped' && joinError ? <p className="meeting-placeholder-sub">{joinError}</p> : null}
              {!user ? <p className="meeting-placeholder-sub">Görüşme için giriş gerekli.</p> : null}
              {user && reason !== 'ok' && !ended ? <p className="meeting-placeholder-sub">{joinReasonLabel(reason)}</p> : null}
              {joinError && !connected && phase !== 'dropped' ? <p className="meeting-placeholder-sub">{joinError}</p> : null}
              {roomNote ? <p className="meeting-placeholder-sub">{roomNote}</p> : null}
              {phase === 'connecting' ? <span className="meeting-spinner" aria-hidden="true" /> : null}
              {!user ? (
                <button className="btn primary" type="button" onClick={() => go('account')}>Giriş</button>
              ) : null}
            </div>
          ) : null}
          {peerIn ? <span className="meeting-chip">{peerName}</span> : null}
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        </div>

        <div className={`meeting-tile meeting-tile--local${camOn ? '' : ' is-idle'}`}>
          <video ref={localRef} className={camOn ? '' : 'is-off'} autoPlay muted playsInline />
          {!camOn ? (
            <div className="meeting-placeholder meeting-placeholder--local">
              <div className="meeting-avatar meeting-avatar--sm" aria-hidden="true">{initials(selfName)}</div>
              <p className="meeting-placeholder-title meeting-placeholder-title--sm">{selfName}</p>
              <p className="meeting-placeholder-sub">Kamera kapalı</p>
            </div>
          ) : null}
          <span className="meeting-chip">{selfName}{micOn ? '' : ' · sessiz'}</span>
        </div>
      </div>

      <div className="meeting-dock">
        <div className="meeting-ctrl">
          {showRetry ? (
            <button className="btn primary meeting-ctrl-retry" type="button" disabled={busy} onClick={() => { autoJoinForRef.current = ''; void joinLive(); }}>
              Yeniden dene
            </button>
          ) : null}
          <button
            className={`meeting-ctrl-btn${micOn ? ' is-on' : ' is-off'}`}
            type="button"
            disabled={!connected || ended || busy}
            aria-pressed={micOn}
            aria-label={micOn ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
            onClick={() => void openMicrophone()}
          >
            {micOn ? 'Mikrofon açık' : 'Mikrofon kapalı'}
          </button>
          <button
            className={`meeting-ctrl-btn${camOn ? ' is-on' : ' is-off'}`}
            type="button"
            disabled={!connected || ended || busy}
            aria-pressed={camOn}
            aria-label={camOn ? 'Kamerayı kapat' : 'Kamerayı aç'}
            onClick={() => void openCamera()}
          >
            {camOn ? 'Kamera açık' : 'Kamera kapalı'}
          </button>
          <button
            className={`meeting-ctrl-end${endArmed ? ' is-armed' : ''}`}
            type="button"
            disabled={!connected || ended || busy}
            aria-label={endArmed ? 'Bitirmeyi onayla' : 'Görüşmeyi bitir'}
            onClick={() => void finishMeeting()}
          >
            {endArmed ? 'Emin misin? Bitir' : 'Görüşmeyi bitir'}
          </button>
        </div>
      </div>
    </div>
  );
}
