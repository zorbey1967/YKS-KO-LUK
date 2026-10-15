import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getPersonDisplayName } from '../lib/displayName';
import {
  LIBRARY_HEARTBEAT_MS,
  LIBRARY_ROOM_ID,
  libraryDisplayName,
  libraryTextLeaksEmail,
  readLibraryJoined,
  readLibraryNameMode,
  writeLibraryJoined,
  writeLibraryNameMode,
  type LibraryNameMode,
} from '../lib/libraryPresence';
import { supabase, withTimeout } from '../lib/supabase';

type Peer = { display_name: string; minutes: number; share_exams: boolean };

export function LibraryPage() {
  const { user, profile, go } = useApp();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [share, setShare] = useState(false);
  const [msg, setMsg] = useState('');
  const [joined, setJoined] = useState(() => Boolean(user && readLibraryJoined(user.id)));
  const [nameMode, setNameMode] = useState<LibraryNameMode | null>(() => (user ? readLibraryNameMode(user.id) : null));
  const tickInFlight = useRef(false);
  const profileName = getPersonDisplayName(profile?.name, '');
  const display = useMemo(
    () => (user ? libraryDisplayName({ mode: nameMode, profileName, userId: user.id }) : 'Öğrenci'),
    [nameMode, profileName, user],
  );

  const leaveRoom = useCallback(async () => {
    if (!user || !supabase) return;
    writeLibraryJoined(user.id, false);
    setJoined(false);
    setPeers([]);
    try {
      await withTimeout(
        supabase.from('study_presence').delete().eq('room_id', LIBRARY_ROOM_ID).eq('user_id', user.id),
      );
    } catch {
      setMsg('Ayrılma kaydı yazılamadı. Birkaç dakika içinde listeden düşersin.');
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setJoined(false);
      setNameMode(null);
      return;
    }
    setNameMode(readLibraryNameMode(user.id));
    setJoined(readLibraryJoined(user.id));
  }, [user]);

  useEffect(() => {
    const sb = supabase;
    if (!user || !sb || !joined || !nameMode) return;
    let alive = true;
    const tick = async () => {
      if (!alive || tickInFlight.current) return;
      tickInFlight.current = true;
      try {
        const shown = libraryTextLeaksEmail(display) ? libraryDisplayName({ mode: 'alias', profileName: '', userId: user.id }) : display;
        const hb = await withTimeout(sb.rpc('library_heartbeat', { p_display: shown, p_share: share }));
        if (!alive) return;
        if (hb.error) {
          setMsg(/does not exist/i.test(hb.error.message) ? 'Kütüphane odası şu an kapalı.' : 'Katılım kaydedilemedi.');
          return;
        }
        setMsg('');
        const roster = await withTimeout(sb.rpc('library_roster'));
        if (!alive) return;
        const raw = roster.data;
        const list = Array.isArray(raw) ? raw as Peer[] : [];
        setPeers(list.filter((p) => !libraryTextLeaksEmail(String(p.display_name || ''))));
      } finally {
        tickInFlight.current = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), LIBRARY_HEARTBEAT_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [user, display, share, joined, nameMode]);

  if (!user) {
    return (
      <div className="card notice">
        <h3>Sessiz Kütüphane</h3>
        <p className="muted">Katılmak için giriş gerekli. Ses ve kamera yoktur. E-posta listede görünmez.</p>
        <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
      </div>
    );
  }

  const uid = user.id;

  function acceptRealName() {
    writeLibraryNameMode(uid, 'real');
    setNameMode('real');
  }

  function rejectRealName() {
    writeLibraryNameMode(uid, 'alias');
    setNameMode('alias');
  }

  function joinRoom() {
    if (!nameMode) return;
    writeLibraryJoined(uid, true);
    setJoined(true);
    setMsg('');
  }

  return (
    <div className="card">
      <div className="section-title"><h3>Sessiz Kütüphane</h3></div>
      <p className="muted">Mikrofon ve kamera kapalı. E-posta ve hesap kimliği gösterilmez.</p>
      {msg ? <p className="notice">{msg}</p> : null}

      {!nameMode ? (
        <div style={{ marginTop: 12 }}>
          <p>Adınızı ve soyadınızı kütüphanede kullanalım mı?</p>
          {profileName ? <p className="muted">Profilindeki ad: {profileName}</p> : (
            <p className="muted">Profilinde ad yoksa “Evet” ile takma ad yerine sonra Hesabım’dan ad ekleyebilirsin; şimdilik güvenli görünen ad kullanılır.</p>
          )}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" onClick={acceptRealName}>Evet, kullan</button>
            <button className="btn secondary" type="button" onClick={rejectRealName}>Hayır</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 8 }}>Listede görünen adın: {display}</p>
          {!joined ? (
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn primary" type="button" onClick={joinRoom}>Katıl</button>
            </div>
          ) : (
            <>
              <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
                Deneme netlerimi diğer katılımcılara aç (varsayılan kapalı)
              </label>
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn secondary" type="button" onClick={() => void leaveRoom()}>Ayrıl</button>
              </div>
              <div style={{ marginTop: 16 }}>
                {!peers.length ? <p className="muted">Şu an başka katılımcı görünmüyor.</p> : null}
                {peers.map((p) => (
                  <div className="plan-item" key={`${p.display_name}-${p.minutes}`}>
                    <span>
                      {p.display_name}
                      <br />
                      <small className="muted">{p.minutes} dk • aktif • net paylaşımı {p.share_exams ? 'açık' : 'kapalı'}</small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
