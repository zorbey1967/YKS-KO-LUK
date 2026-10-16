import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getPersonDisplayName, splitPersonName } from '../lib/displayName';
import {
  LIBRARY_CLOCK_MS,
  LIBRARY_EMOJI_LABELS,
  LIBRARY_EMOJIS,
  LIBRARY_HEARTBEAT_MS,
  LIBRARY_ROOM_ID,
  formatStudyClock,
  libraryDisplayName,
  libraryShownLabel,
  libraryTextLeaksEmail,
  pickLibraryEmoji,
  resolveLibraryPrefs,
  roomLabel,
  sanitizeLibraryPeers,
  writeLibraryJoined,
  writeLibraryNameMode,
  type LibraryNameMode,
  type LibraryPeer,
} from '../lib/libraryPresence';
import { supabase, withTimeout } from '../lib/supabase';
import { appendLibrarySession } from '../lib/studentProgress';

export function LibraryPage() {
  const { user, profile, go, data, setData } = useApp();
  const [peers, setPeers] = useState<LibraryPeer[]>([]);
  const [share, setShare] = useState(false);
  const [msg, setMsg] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);
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

  const persistPrefs = useCallback((next: { nameMode?: LibraryNameMode | null; joinedRoomId?: string | null; joinedAt?: string | null; emoji?: string | null }) => {
    if (!user) return;
    setData((prev) => {
      const merged = { ...prev.libraryPrefs, ...next };
      if (merged.nameMode === 'real' || merged.nameMode === 'alias') writeLibraryNameMode(user.id, merged.nameMode);
      writeLibraryJoined(user.id, Boolean(merged.joinedRoomId));
      return { ...prev, libraryPrefs: merged };
    });
  }, [setData, user]);

  /** Figür seçimi: odaya katılmaz, ayrılmaz, heartbeat başlatmaz. */
  const selectEmoji = useCallback((em: string) => {
    if (!user) return;
    persistPrefs({ emoji: em });
  }, [persistPrefs, user]);

  const leaveRoom = useCallback(async () => {
    if (!user) return;
    setData((prev) => {
      const closed = appendLibrarySession(prev, prev.libraryPrefs.joinedAt);
      writeLibraryJoined(user.id, false);
      return { ...closed, libraryPrefs: { ...closed.libraryPrefs, joinedRoomId: null, joinedAt: null } };
    });
    setPeers([]);
    if (!supabase) return;
    try {
      await withTimeout(
        supabase.from('study_presence').delete().eq('room_id', LIBRARY_ROOM_ID).eq('user_id', user.id),
      );
    } catch {
      setMsg('Ayrılma kaydı yazılamadı. Birkaç dakika içinde listeden düşersin.');
    }
  }, [setData, user]);

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
        const safeName = libraryTextLeaksEmail(display)
          ? libraryDisplayName({ mode: 'alias', profileName: '', userId: user.id })
          : display;
        const shown = libraryShownLabel(pickLibraryEmoji(user.id, prefs.emoji), safeName);
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
  }, [user, display, share, joined, nameMode, prefs.emoji]);

  if (!user) {
    return (
      <div className="card notice">
        <h3>Sessiz Kütüphane</h3>
        <p className="muted">Katılmak için giriş gerekli. Ses ve kamera yoktur. E-posta listede görünmez.</p>
        <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
      </div>
    );
  }

  function joinRoom(mode: LibraryNameMode = nameMode || 'alias') {
    if (!user) return;
    persistPrefs({
      nameMode: mode,
      emoji: pickLibraryEmoji(user.id, prefs.emoji),
      joinedRoomId: LIBRARY_ROOM_ID,
      joinedAt: prefs.joinedAt && prefs.joinedRoomId === LIBRARY_ROOM_ID ? prefs.joinedAt : new Date().toISOString(),
    });
    setPendingJoin(false);
    setConsentOpen(false);
    setMsg('');
  }

  function acceptRealName() {
    if (pendingJoin) joinRoom('real');
    else persistPrefs({ nameMode: 'real' });
    setConsentOpen(false);
  }

  function rejectRealName() {
    if (pendingJoin) joinRoom('alias');
    else persistPrefs({ nameMode: 'alias' });
    setConsentOpen(false);
  }

  function requestJoin() {
    if (!nameMode) {
      setPendingJoin(true);
      setConsentOpen(true);
      return;
    }
    joinRoom();
  }

  const elapsedMs = joined && prefs.joinedAt ? Math.max(0, now - Date.parse(prefs.joinedAt)) : 0;
  const myMinutes = Math.floor(elapsedMs / 60000);
  const rosterMinutes = peers.reduce((a, p) => a + p.minutes, 0);
  const todayTotalMin = rosterMinutes + (joined ? myMinutes : 0);
  const activeCount = peers.length || (joined ? 1 : 0);
  const myRoom = roomLabel(prefs.joinedRoomId);
  const selectedEmoji = prefs.emoji ? pickLibraryEmoji(user.id, prefs.emoji) : null;

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
        <div className="actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          {joined ? (
            <button className="btn secondary" type="button" onClick={() => void leaveRoom()}>Ayrıl</button>
          ) : (
            <button className="btn primary" type="button" onClick={requestJoin}>Katıl</button>
          )}
          {selectedEmoji ? (
            <span className="muted" style={{ alignSelf: 'center' }}>Figür: {selectedEmoji} {LIBRARY_EMOJI_LABELS[selectedEmoji as keyof typeof LIBRARY_EMOJI_LABELS] || ''}</span>
          ) : (
            <span className="muted" style={{ alignSelf: 'center' }}>Önce bir figür seçebilirsin (zorunlu değil).</span>
          )}
        </div>
      </div>

      {(consentOpen || (!nameMode && joined)) ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p>Adınız ve soyadınız olarak görünmek ister misiniz?</p>
          {(() => {
            const parts = splitPersonName(profileName);
            return parts.firstName ? (
              <>
                <p>Ad: {parts.firstName}</p>
                {parts.lastName ? <p>Soyad: {parts.lastName}</p> : null}
              </>
            ) : <p className="muted">Hayır dersen anonim öğrenci adı görünür. E-posta ve hesap kimliği gösterilmez.</p>;
          })()}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" onClick={acceptRealName}>Evet, adımı göster</button>
            <button className="btn secondary" type="button" onClick={rejectRealName}>Hayır, anonim</button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Figür seç</h3></div>
        <p className="muted">Figür seçmek odaya katılmaz ve çalışma süresini başlatmaz.</p>
        <div className="library-grid" style={{ marginTop: 8 }}>
          {LIBRARY_EMOJIS.map((em) => {
            const selected = prefs.emoji === em;
            return (
              <button
                className={`library-card${selected ? ' on' : ''}`}
                key={em}
                type="button"
                onClick={() => selectEmoji(em)}
                aria-pressed={selected}
              >
                <div className="library-emoji">{em}</div>
                <b>{LIBRARY_EMOJI_LABELS[em]}</b>
                {selected ? <p className="muted">Seçili</p> : <p className="muted">Seç</p>}
              </button>
            );
          })}
        </div>
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
            <div className="library-grid">
              <div className="library-card">
                <div className="library-emoji">{pickLibraryEmoji(user.id, prefs.emoji)}</div>
                <b>{display}</b>
                <p className="muted">🟢 Çalışıyor</p>
                <p>⏱ {myMinutes} dk</p>
              </div>
              {peers.filter((p) => p.display_name !== display).map((p) => (
                <div className="library-card" key={p.display_name}>
                  <div className="library-emoji">{p.emoji || '🦁'}</div>
                  <b>{p.display_name}</b>
                  <p className="muted">{p.minutes > 0 ? '🟢 Çalışıyor' : '⚪ Pasif'}</p>
                  <p>⏱ {p.minutes} dk</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
