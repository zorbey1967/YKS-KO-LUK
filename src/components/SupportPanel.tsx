import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  emptySupportPrefs,
  needsSupportNameConsent,
  supportNamesForTicket,
  supportStatusLabel,
  type SupportNameConsent,
} from '../lib/supportAccess';
import { addSupportReply, createSupportTicket, listMySupportTickets, listSupportReplies, type SupportReply, type SupportTicket } from '../lib/supportCloud';

export function SupportPanel() {
  const { user, profile, go, data, setData, page } = useApp();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [reply, setReply] = useState('');
  const consent = data.supportPrefs?.nameConsent ?? null;
  const askConsent = Boolean(user) && needsSupportNameConsent(profile?.name, consent);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('yks-open-support', onOpen);
    return () => window.removeEventListener('yks-open-support', onOpen);
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;
    void listMySupportTickets().then((res) => {
      if (!alive) return;
      if (res.ok) setRows(res.rows);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, [open, user]);

  useEffect(() => {
    if (!open || !activeId) return;
    let alive = true;
    void listSupportReplies(activeId).then((list) => {
      if (alive) setReplies(list);
    });
    return () => { alive = false; };
  }, [open, activeId]);

  if (page === 'meeting') return null;

  function setConsent(next: SupportNameConsent) {
    setData((prev) => ({
      ...prev,
      supportPrefs: { ...(prev.supportPrefs || emptySupportPrefs()), nameConsent: next },
    }));
  }

  async function send() {
    if (!user) {
      go('account');
      return;
    }
    if (askConsent) {
      setErr('Önce ad-soyad tercihini seç.');
      return;
    }
    const sub = subject.trim();
    const msg = body.trim();
    if (!sub || !msg) {
      setErr('Konu ve mesaj gerekli.');
      return;
    }
    setBusy(true);
    setErr('');
    setNote('');
    const names = supportNamesForTicket({ profileName: profile?.name, consent });
    const res = await createSupportTicket({ firstName: names.firstName, lastName: names.lastName, subject: sub, body: msg });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setNote('Gönderildi.');
    setSubject('');
    setBody('');
    setRows((prev) => [res.row, ...prev]);
    setActiveId(res.row.id);
  }

  async function sendReply() {
    if (!activeId || !reply.trim()) return;
    setBusy(true);
    const res = await addSupportReply(activeId, reply.trim());
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Yanıt gönderilemedi.');
      return;
    }
    setReply('');
    const list = await listSupportReplies(activeId);
    setReplies(list);
  }

  return (
    <>
      {open ? null : (
        <button
          className="fab fab-support"
          type="button"
          aria-label="Destek"
          onClick={() => {
            if (!user) {
              go('account');
              return;
            }
            setOpen(true);
          }}
        >
          ❓
        </button>
      )}
      {open ? <button type="button" className="zorro-backdrop" aria-label="Destek panelini kapat" onClick={close} /> : null}
      {open ? (
        <section className="zorro-dock" id="support-panel" aria-label="Destek">
          <header className="zorro-head">
            <div className="zorro-head-id">
              <span className="zorro-mark" aria-hidden="true">❓</span>
              <div>
                <b>Destek</b>
                <div className="zorro-sub">ZORRO sohbetinden ayrı destek kaydı.</div>
              </div>
            </div>
            <button className="zorro-x" type="button" aria-label="Kapat" onClick={close}>×</button>
          </header>
          <div className="chat-msgs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!user ? (
              <p className="muted">Destek için giriş gerekli.</p>
            ) : (
              <>
                {askConsent ? (
                  <div className="card" style={{ background: 'rgba(255,255,255,.06)', color: '#fff' }}>
                    <p>Adınızı ve soyadınızı destek mesajlarında kullanmamıza izin veriyor musunuz?</p>
                    <div className="actions">
                      <button className="btn primary" type="button" onClick={() => setConsent('yes')}>Evet</button>
                      <button className="btn secondary" type="button" onClick={() => setConsent('no')}>Hayır</button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); void send(); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <label className="muted">Konu
                      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required />
                    </label>
                    <label className="muted">Mesaj
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} required />
                    </label>
                    <p className="muted" style={{ margin: 0 }}>E-posta hesabındaki adresten alınır; yeniden yazmana gerek yok.</p>
                    <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
                  </form>
                )}
                {note ? <p className="notice">{note}</p> : null}
                {err ? <p className="notice">{err}</p> : null}
                <div>
                  <div className="zorro-hist-label">Önceki mesajların</div>
                  {!rows.length ? <p className="zorro-empty">Henüz destek kaydın yok.</p> : null}
                  {rows.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`zorro-hist-item${activeId === t.id ? ' is-on' : ''}`}
                      onClick={() => setActiveId(t.id)}
                    >
                      <span className="zorro-hist-title">{t.subject}</span>
                      <span className="zorro-hist-meta">{supportStatusLabel(t.status)} · {new Date(t.created_at).toLocaleString('tr-TR')}</span>
                    </button>
                  ))}
                </div>
                {activeId ? (
                  <div>
                    <div className="zorro-hist-label">Konuşma</div>
                    {rows.filter((t) => t.id === activeId).map((t) => (
                      <p key={t.id}>{t.body}</p>
                    ))}
                    {replies.map((r) => (
                      <p key={r.id} className="muted">
                        <b>{r.role === 'admin' ? 'Destek' : 'Sen'}:</b> {r.body}
                      </p>
                    ))}
                    <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }}>
                      <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Yanıt yaz" />
                      <button className="btn secondary" type="submit" disabled={busy || !reply.trim()} style={{ marginTop: 8 }}>Yanıt gönder</button>
                    </form>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
