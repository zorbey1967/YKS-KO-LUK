import { useEffect, useState } from 'react';
import { adminSetSupportStatus, addSupportReply, listMySupportTickets, listSupportReplies, type SupportReply, type SupportTicket } from '../lib/supportCloud';
import { parseSupportStatus, supportStatusLabel, type SupportStatus } from '../lib/supportAccess';

export function AdminSupportPanel() {
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [err, setErr] = useState('');
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await listMySupportTickets();
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setErr('');
    setRows(res.rows);
  }

  useEffect(() => {
    let alive = true;
    void listMySupportTickets().then((res) => {
      if (!alive) return;
      if (res.ok) setRows(res.rows);
      else setErr(res.error);
    });
    return () => { alive = false; };
  }, []);

  const fresh = rows.filter((r) => r.status === 'new').length;

  async function openTicket(t: SupportTicket) {
    setActive(t);
    setReplies(await listSupportReplies(t.id));
  }

  async function setStatus(status: SupportStatus) {
    if (!active) return;
    setBusy(true);
    const res = await adminSetSupportStatus(active.id, status);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Durum güncellenemedi.');
      return;
    }
    const next = { ...active, status };
    setActive(next);
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    setBusy(true);
    const res = await addSupportReply(active.id, reply.trim());
    if (res.ok) {
      await adminSetSupportStatus(active.id, 'replied');
      setReply('');
      setReplies(await listSupportReplies(active.id));
      const next = { ...active, status: 'replied' as const };
      setActive(next);
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    } else setErr(res.error || 'Yanıt yazılamadı.');
    setBusy(false);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">
        <h3>Mesajlar</h3>
        <span>{fresh} yeni</span>
      </div>
      {err ? <p className="notice">{err}</p> : null}
      <div className="grid stats" style={{ marginBottom: 12 }}>
        <div className="card stat"><div className="label">YENİ DESTEK</div><div className="value">{fresh}</div></div>
        <div className="card stat"><div className="label">TOPLAM</div><div className="value">{rows.length}</div></div>
      </div>
      {!rows.length ? <p className="muted">Destek kaydı yok.</p> : null}
      {rows.map((t) => {
        const name = `${t.first_name} ${t.last_name}`.trim() || '—';
        return (
          <button key={t.id} className="plan-item" type="button" onClick={() => void openTicket(t)} style={{ width: '100%', textAlign: 'left' }}>
            <span>
              {name}
              <br />
              <small className="muted">{t.email} · {t.subject} · {new Date(t.created_at).toLocaleString('tr-TR')} · {supportStatusLabel(t.status)}</small>
            </span>
          </button>
        );
      })}
      {active ? (
        <div style={{ marginTop: 16 }}>
          <h4>{active.subject}</h4>
          <p className="muted">{`${active.first_name} ${active.last_name}`.trim() || '—'} · {active.email}</p>
          <p>{active.body}</p>
          <label className="muted">Durum
            <select
              value={active.status}
              disabled={busy}
              onChange={(e) => void setStatus(parseSupportStatus(e.target.value))}
            >
              <option value="new">Yeni</option>
              <option value="reviewing">İnceleniyor</option>
              <option value="replied">Yanıtlandı</option>
            </select>
          </label>
          {replies.map((r) => (
            <p key={r.id} className="muted"><b>{r.role === 'admin' ? 'Yönetici' : 'Öğrenci'}:</b> {r.body}</p>
          ))}
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Yanıt" />
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>Yanıtla</button>
            <button className="btn secondary" type="button" onClick={() => void load()}>Yenile</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
