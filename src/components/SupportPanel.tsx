import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  emptySupportPrefs,
  needsSupportNameConsent,
  SUPPORT_NUDGE_MARKER,
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
  const consent = data.supportPrefs?.nameConsent ?? null;
  const askConsent = Boolean(user) && needsSupportNameConsent(profile?.name, consent);
  const active = rows.find((t) => t.id === activeId) || null;
  const adminReply = replies.filter((r) => r.role === 'admin');
  const canSendNew = !rows.some((t) => t.status === 'new' || t.status === 'reviewing');

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('yks-open-support', onOpen);
    return () => window.removeEventListener('yks-open-support', onOpen);
  }, []);

  useEffect(() => {
    setRows([]);
    setActiveId(null);
    setReplies([]);
    setErr('');
    setNote('');
    if (!user) setOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;
    void listMySupportTickets().then((res) => {
      if (!alive) return;
      if (res.ok) setRows(res.rows.filter((r) => r.user_id === user.id));
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, [open, user]);

  useEffect(() => {
    if (!open || !activeId || !user) return;
    let alive = true;
    void listSupportReplies(activeId).then((list) => {
      if (alive) setReplies(list.filter((r) => r.body !== SUPPORT_NUDGE_MARKER));
    });
    return () => { alive = false; };
  }, [open, activeId, user]);

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
    const msg = body.trim();
    if (!msg) {
      setErr('Mesaj gerekli.');
      return;
    }
    setBusy(true);
    setErr('');
    setNote('');

    // Açık kayıt varken yeni ticket yerine yanıt yaz (mesaj yazma her zaman açık).
    const openTicket = rows.find((t) => t.status === 'new' || t.status === 'reviewing')
      || (activeId ? rows.find((t) => t.id === activeId) : null);
    if (openTicket && !canSendNew) {
      const res = await addSupportReply(openTicket.id, msg);
      setBusy(false);
      if (!res.ok) {
        setErr('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        return;
      }
      setNote('Mesaj gönderildi.');
      setBody('');
      setActiveId(openTicket.id);
      const list = await listSupportReplies(openTicket.id);
      setReplies(list.filter((r) => r.body !== SUPPORT_NUDGE_MARKER));
      return;
    }

    const sub = subject.trim();
    if (!sub) {
      setBusy(false);
      setErr('Konu ve mesaj gerekli.');
      return;
    }
    const names = supportNamesForTicket({ profileName: profile?.name, consent });
    const res = await createSupportTicket({ firstName: names.firstName, lastName: names.lastName, subject: sub, body: msg });
    setBusy(false);
    if (!res.ok) {
      setErr('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      return;
    }
    setNote('Gönderildi. Yönetici yanıtı burada görünür.');
    setSubject('');
    setBody('');
    setRows((prev) => [res.row, ...prev]);
    setActiveId(res.row.id);
  }

  async function nudge() {
    if (!activeId) return;
    setBusy(true);
    setErr('');
    const res = await addSupportReply(activeId, SUPPORT_NUDGE_MARKER);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Hatırlatma gönderilemedi.');
      return;
    }
    setNote('Hatırlatma yönetici paneline iletildi.');
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
                <div className="zorro-sub">Konu ve mesajını yaz; yanıt burada görünür.</div>
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
                    <p>Adınız ve soyadınız olarak kullanılmasını ister misiniz?</p>
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
                    {canSendNew ? (
                      <label className="muted">Konu
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required />
                      </label>
                    ) : (
                      <p className="muted">Açık kayda mesaj yazıyorsun.</p>
                    )}
                    <label className="muted">Mesaj
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} required />
                    </label>
                    <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
                  </form>
                )}
                {note ? <p className="notice">{note}</p> : null}
                {err ? <p className="notice">{err}</p> : null}
                <div>
                  <div className="zorro-hist-label">Mesajların</div>
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
                {active ? (
                  <div>
                    <div className="zorro-hist-label">Kayıt</div>
                    <p>{active.body}</p>
                    {adminReply.length ? adminReply.map((r) => (
                      <p key={r.id} className="muted"><b>Yanıt:</b> {r.body}</p>
                    )) : <p className="muted">Yönetici yanıtı henüz yok.</p>}
                    {active.status !== 'replied' ? (
                      <button className="btn secondary" type="button" disabled={busy} onClick={() => void nudge()}>Hatırlat</button>
                    ) : null}
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
