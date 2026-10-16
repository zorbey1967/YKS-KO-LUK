import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getPersonDisplayName } from '../lib/displayName';
import {
  LIBRARY_CLOCK_MS,
  LIBRARY_HEARTBEAT_MS,
  LIBRARY_ROOM_ID,
  LIBRARY_ROOMS,
  formatStudyClock,
  libraryDisplayName,
  libraryTextLeaksEmail,
  resolveLibraryPrefs,
  roomLabel,
  sanitizeLibraryPeers,
  writeLibraryJoined,
  writeLibraryNameMode,
  type LibraryNameMode,
  type LibraryPeer,
} from '../lib/libraryPresence';
import { supabase, withTimeout } from '../lib/supabase';

export function LibraryPage() {
  const { user, profile, go, data, setData } = useApp();
  const [peers, setPeers] = useState<LibraryPeer[]>([]);
  const [share, setShare] = useState(false);
  const [msg, setMsg] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tickInFlight = useRef(false);
  const profileName = getPersonDisplayName(profile?.name, '');

  const prefs = useMemo(
    () => (user ? resolveLibraryPrefs(data.libraryPrefs, user.id) : data.libraryPrefs),
    [data.libraryPrefs, user],
  );
  const nameMode = prefs.nameMode;
  const joined = Boolean(prefs.joinedRoomId);
  const display = useMemo(
    () => (user ? libraryDisplayName({ mode: nameMode, profileName, userId: user.id }) : 'Öğrenci'),
    [nameMode, profileName, user],
  );

  const persistPrefs = useCallback((next: { nameMode?: LibraryNameMode | null; joinedRoomId?: string | null; joinedAt?: string | null }) => {
    if (!user) return;
    setData((prev) => {
      const merged = { ...prev.libraryPrefs, ...next };
      if (merged.nameMode === 'real' || merged.nameMode === 'alias') writeLibraryNameMode(user.id, merged.nameMode);
      writeLibraryJoined(user.id, Boolean(merged.joinedRoomId));
      return { ...prev, libraryPrefs: merged };
    });
  }, [setData, user]);

  const leaveRoom = useCallback(async () => {
    if (!user || !supabase) return;
    persistPrefs({ joinedRoomId: null, joinedAt: null });
    setPeers([]);
    try {
      await withTimeout(
        supabase.from('study_presence').delete().eq('room_id', LIBRARY_ROOM_ID).eq('user_id', user.id),
      );
    } catch {
      setMsg('Ayrılma kaydı yazılamadı. Birkaç dakika içinde listeden düşersin.');
    }
  }, [persistPrefs, user]);

  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setNow(Date.now());
    }, LIBRARY_CLOCK_MS);
    return () => window.clearInterval(id);
  }, [joined]);

  useEffect(() => {
    const sb = supabase;
    if (!user || !sb || !joined || !nameMode) return;
    let alive = true;
    const tick = async () => {
      if (!alive || tickInFlight.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      tickInFlight.current = true;
      try {
        const shown = libraryTextLeaksEmail(display)
          ? libraryDisplayName({ mode: 'alias', profileName: '', userId: user.id })
          : display;
        const hb = await withTimeout(sb.rpc('library_heartbeat', { p_display: shown, p_share: share }));
        if (!alive) return;
        if (hb.error) {
          setMsg(/does not exist/i.test(hb.error.message) ? 'Kütüphane odası şu an kapalı.' : 'Katılım kaydedilemedi.');
          return;
        }
        setMsg('');
        const roster = await withTimeout(sb.rpc('library_roster'));
        if (!alive) return;
        setPeers(sanitizeLibraryPeers(roster.data));
      } finally {
        tickInFlight.current = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), LIBRARY_HEARTBEAT_MS);
    const vis = () => {
      if (typeof document !== 'undefined' && !document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
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

  function acceptRealName() {
    persistPrefs({ nameMode: 'real' });
    setConsentOpen(false);
  }

  function rejectRealName() {
    persistPrefs({ nameMode: 'alias' });
    setConsentOpen(false);
  }

  function requestJoin(roomId: string) {
    if (!nameMode) {
      setConsentOpen(true);
      return;
    }
    persistPrefs({
      joinedRoomId: roomId,
      joinedAt: prefs.joinedAt && prefs.joinedRoomId === roomId ? prefs.joinedAt : new Date().toISOString(),
    });
    setMsg('');
  }

  const elapsedMs = joined && prefs.joinedAt ? Math.max(0, now - Date.parse(prefs.joinedAt)) : 0;
  const myMinutes = Math.floor(elapsedMs / 60000);
  const rosterMinutes = peers.reduce((a, p) => a + p.minutes, 0);
  const todayTotalMin = rosterMinutes + (joined ? myMinutes : 0);
  const activeCount = peers.length || (joined ? 1 : 0);
  const myRoom = roomLabel(prefs.joinedRoomId);

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>Sessiz Kütüphane</h3></div>
        <p className="muted">Mikrofon ve kamera kapalı. E-posta ve hesap kimliği gösterilmez.</p>
        {msg ? <p className="notice">{msg}</p> : null}
        <div className="grid stats" style={{ marginTop: 12 }}>
          <div className="card stat"><div className="label">AKTİF ÖĞRENCİ</div><div className="value">{activeCount}</div></div>
          <div className="card stat"><div className="label">BUGÜN TOPLAM</div><div className="value">{todayTotalMin} dk</div></div>
          <div className="card stat"><div className="label">ÇALIŞMA SÜREM</div><div className="value">{joined ? formatStudyClock(elapsedMs) : '00:00:00'}</div></div>
          <div className="card stat"><div className="label">ODAM</div><div className="value" style={{ fontSize: 16 }}>{myRoom || '—'}</div></div>
        </div>
      </div>

      {(consentOpen || (!nameMode && joined)) ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p>Adınız ve soyadınız kütüphanede görünsün mü?</p>
          {profileName ? <p className="muted">Profilindeki ad: {profileName}</p> : (
            <p className="muted">Profilinde ad yoksa güvenli görünen ad kullanılır. E-posta asla gösterilmez.</p>
          )}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" onClick={acceptRealName}>Evet, kullan</button>
            <button className="btn secondary" type="button" onClick={rejectRealName}>Hayır, gizli isim kullan</button>
          </div>
        </div>
      ) : null}

      <div className="grid two" style={{ marginTop: 16 }}>
        {LIBRARY_ROOMS.map((room) => {
          const inThis = prefs.joinedRoomId === room.id;
          return (
            <div className="card" key={room.id}>
              <div className="section-title"><h3>{room.name}</h3></div>
              <p className="muted">{inThis ? activeCount : peers.length} öğrenci</p>
              <div className="actions" style={{ marginTop: 8 }}>
                {inThis ? (
                  <button className="btn secondary" type="button" onClick={() => void leaveRoom()}>Ayrıl</button>
                ) : (
                  <button className="btn primary" type="button" onClick={() => requestJoin(room.id)}>Odaya Katıl</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {joined ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Bugün ne kadar çalıştın?</h3></div>
            <p style={{ marginTop: 0 }}><b>{formatStudyClock(elapsedMs)}</b></p>
            <p className="muted">Sayaç yalnızca bu oturumda ilerler; her saniye sunucuya istek gitmez.</p>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
              Deneme netlerimi diğer katılımcılara aç (varsayılan kapalı)
            </label>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Şu anda birlikte çalışanlar</h3></div>
            {!peers.length ? <p className="muted">Şu an başka katılımcı görünmüyor.</p> : null}
            {peers.map((p) => (
              <div className="plan-item" key={`${p.display_name}-${p.minutes}`}>
                <span>
                  {p.display_name}
                  <br />
                  <small className="muted">{formatStudyClock(p.minutes * 60_000)} • {p.minutes > 0 ? 'aktif' : 'pasif'}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
