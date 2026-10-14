import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getPersonDisplayName } from '../lib/displayName';
import { supabase, withTimeout } from '../lib/supabase';

type Peer = { display_name: string; minutes: number; share_exams: boolean };

export function LibraryPage() {
  const { user, profile, go } = useApp();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [share, setShare] = useState(false);
  const [msg, setMsg] = useState('');
  const display = getPersonDisplayName(profile?.name, 'Öğrenci');

  useEffect(() => {
    const sb = supabase;
    if (!user || !sb) return;
    let alive = true;
    const tick = async () => {
      const hb = await withTimeout(sb.rpc('library_heartbeat', { p_display: display, p_share: share }));
      if (!alive) return;
      if (hb.error) {
        setMsg(/does not exist/i.test(hb.error.message) ? 'Kütüphane henüz sunucuda yok (037).' : 'Katılım kaydedilemedi.');
        return;
      }
      const roster = await withTimeout(sb.rpc('library_roster'));
      if (!alive) return;
      const raw = roster.data;
      setPeers(Array.isArray(raw) ? raw as Peer[] : []);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, [user, display, share]);

  if (!user) {
    return (
      <div className="card notice">
        <h3>Sessiz Kütüphane</h3>
        <p className="muted">Katılmak için giriş gerekli. Ses ve kamera yoktur.</p>
        <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title"><h3>Sessiz Kütüphane</h3></div>
      <p className="muted">Mikrofon ve kamera kapalı. Süre tek oturum satırında birikir; kopukluk boşluğu sayılmaz. E-posta ve hesap kimliği gösterilmez.</p>
      {msg ? <p className="notice">{msg}</p> : null}
      <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        Deneme netlerimi diğer katılımcılara aç (varsayılan kapalı)
      </label>
      <div style={{ marginTop: 16 }}>
        {!peers.length ? <p className="muted">Şu an başka katılımcı görünmüyor.</p> : null}
        {peers.map((p) => (
          <div className="plan-item" key={`${p.display_name}-${p.minutes}`}>
            <span>{p.display_name}<br /><small className="muted">{p.minutes} dk • net paylaşımı {p.share_exams ? 'açık' : 'kapalı'}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}
