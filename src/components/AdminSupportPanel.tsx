import { useEffect, useMemo, useState } from 'react';
import {
  adminSetSupportStatus,
  addSupportReply,
  listAdminSupportTickets,
  listSupportReplies,
  type SupportReply,
  type SupportTicket,
} from '../lib/supportCloud';
import {
  filterAdminSupportTickets,
  parseSupportStatus,
  SUPPORT_NUDGE_MARKER,
  supportReplyRoleLabel,
  supportSenderRoleLabel,
  supportStatusLabel,
  type SupportAdminFilter,
  type SupportStatus,
} from '../lib/supportAccess';

export function AdminSupportPanel() {
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [err, setErr] = useState('');
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const [lastAdminReply, setLastAdminReply] = useState<Record<string, string>>({});
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<SupportAdminFilter>('all');

  async function load() {
    const res = await listAdminSupportTickets();
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setErr('');
    setRows(res.rows);
    const flags: Record<string, boolean> = {};
    const adminMap: Record<string, string> = {};
    await Promise.all(res.rows.slice(0, 60).map(async (t) => {
      const list = await listSupportReplies(t.id);
      flags[t.id] = list.some((r) => r.body === SUPPORT_NUDGE_MARKER);
      const last = [...list].reverse().find((r) => r.role === 'admin' && r.body !== SUPPORT_NUDGE_MARKER);
      if (last) adminMap[t.id] = last.body;
    }));
    setNudged(flags);
    setLastAdminReply(adminMap);
  }

  useEffect(() => {
    let alive = true;
    void listAdminSupportTickets().then(async (res) => {
      if (!alive) return;
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setRows(res.rows);
      const flags: Record<string, boolean> = {};
      const adminMap: Record<string, string> = {};
      await Promise.all(res.rows.slice(0, 60).map(async (t) => {
        const list = await listSupportReplies(t.id);
        if (!alive) return;
        flags[t.id] = list.some((r) => r.body === SUPPORT_NUDGE_MARKER);
        const last = [...list].reverse().find((r) => r.role === 'admin' && r.body !== SUPPORT_NUDGE_MARKER);
        if (last) adminMap[t.id] = last.body;
      }));
      if (alive) {
        setNudged(flags);
        setLastAdminReply(adminMap);
      }
    });
    return () => {
      alive = false;
      setRows([]);
      setActive(null);
      setReplies([]);
      setNudged({});
      setLastAdminReply({});
      setReply('');
      setErr('');
    };
  }, []);

  const visible = useMemo(
    () => filterAdminSupportTickets(rows, filter, nudged),
    [rows, filter, nudged],
  );
  const fresh = rows.filter((r) => r.status === 'new').length;
  const nudgedCount = rows.filter((r) => nudged[r.id]).length;

  async function openTicket(t: SupportTicket) {
    setActive(t);
    setReply('');
    const list = await listSupportReplies(t.id);
    setNudged((prev) => ({ ...prev, [t.id]: list.some((r) => r.body === SUPPORT_NUDGE_MARKER) }));
    const visibleReplies = list.filter((r) => r.body !== SUPPORT_NUDGE_MARKER);
    setReplies(visibleReplies);
    const last = [...visibleReplies].reverse().find((r) => r.role === 'admin');
    if (last) setLastAdminReply((prev) => ({ ...prev, [t.id]: last.body }));
    if (t.status === 'new') {
      const res = await adminSetSupportStatus(t.id, 'reviewing');
      if (res.ok) {
        const next = { ...t, status: 'reviewing' as const };
        setActive(next);
        setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      }
    }
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
    setErr('');
    const res = await addSupportReply(active.id, reply.trim());
    if (res.ok) {
      await adminSetSupportStatus(active.id, 'replied');
      const text = reply.trim();
      setReply('');
      const list = await listSupportReplies(active.id);
      setReplies(list.filter((r) => r.body !== SUPPORT_NUDGE_MARKER));
      setLastAdminReply((prev) => ({ ...prev, [active.id]: text }));
      const next = { ...active, status: 'replied' as const };
      setActive(next);
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    } else setErr(res.error || 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    setBusy(false);
  }

  const filters: { id: SupportAdminFilter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'new', label: 'Yeni' },
    { id: 'unread', label: 'Okunmamış' },
    { id: 'replied', label: 'Yanıtlandı' },
    { id: 'nudged', label: 'Hatırlatıldı' },
  ];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">
        <h3>📩 Gelen Destek Mesajları</h3>
        <span>{fresh} yeni</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Öğrenci ve koç destek mesajları. Yalnızca yönetici görür. Hatırlat 🔔 yalnızca bu panelde görünür.
      </p>
      {err ? <p className="notice">{err}</p> : null}
      <div className="grid stats" style={{ marginBottom: 12 }}>
        <div className="card stat"><div className="label">YENİ / OKUNMAMIŞ</div><div className="value">{fresh}</div></div>
        <div className="card stat"><div className="label">HATIRLATILDI</div><div className="value">{nudgedCount}</div></div>
        <div className="card stat"><div className="label">TOPLAM</div><div className="value">{rows.length}</div></div>
      </div>
      <div className="chip-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.id}
            className={`chip ${filter === f.id ? 'on' : ''}`}
            type="button"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button className="btn secondary" type="button" onClick={() => void load()}>Yenile</button>
      </div>
      {!visible.length ? <p className="muted">Bu filtrede destek kaydı yok.</p> : null}
      {visible.map((t) => {
        const name = `${t.first_name} ${t.last_name}`.trim() || '—';
        const role = supportSenderRoleLabel(t.sender_role);
        return (
          <button
            key={t.id}
            className="plan-item"
            type="button"
            onClick={() => void openTicket(t)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <span>
              {nudged[t.id] ? '🔔 ' : ''}{name}
              <br />
              <small className="muted">
                {role} · {t.email || '—'} · {t.subject}
                <br />
                {new Date(t.created_at).toLocaleString('tr-TR')} · {supportStatusLabel(t.status)}
                {t.status === 'new' ? ' · okunmadı' : ' · okundu'}
                {nudged[t.id] ? ' · hatırlatıldı' : ''}
                {lastAdminReply[t.id] ? ` · yanıt: ${lastAdminReply[t.id].slice(0, 60)}` : ''}
              </small>
            </span>
          </button>
        );
      })}
      {active ? (
        <div style={{ marginTop: 16 }}>
          <h4>{active.subject}</h4>
          <p className="muted">
            {`${active.first_name} ${active.last_name}`.trim() || '—'}
            <br />
            {supportSenderRoleLabel(active.sender_role)} · {active.email || '—'}
            <br />
            {new Date(active.created_at).toLocaleString('tr-TR')}
            {nudged[active.id] ? ' · 🔔 Hatırlatıldı' : ''}
          </p>
          <p><b>Mesaj:</b> {active.body}</p>
          <label className="muted">Durum
            <select
              value={active.status}
              disabled={busy}
              onChange={(e) => void setStatus(parseSupportStatus(e.target.value))}
            >
              <option value="new">Yeni / Okunmadı</option>
              <option value="reviewing">İnceleniyor</option>
              <option value="replied">Yanıtlandı</option>
            </select>
          </label>
          {replies.map((r) => (
            <p key={r.id} className="muted">
              <b>{supportReplyRoleLabel(r.role)}:</b> {r.body}
            </p>
          ))}
          <label className="muted" style={{ display: 'block', marginTop: 8 }}>Yanıtla
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Yönetici yanıtı"
              maxLength={4000}
            />
          </label>
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
              Yanıtla
            </button>
            <button className="btn secondary" type="button" onClick={() => { setActive(null); setReplies([]); setReply(''); }}>
              Kapat
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
