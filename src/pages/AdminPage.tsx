import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  addAdminNote,
  addFinance,
  adminSnapshot,
  loadAdminNotes,
  loadAdminSettings,
  loadFinance,
  maskEmail,
  platformOwnerEmail,
  saveAdminSettings,
  saveFinance,
  setApptStatus,
  type FinanceKind,
  type FinanceStatus,
} from '../lib/admin';
import {
  COACH_TRACKS,
  formatTry,
  loadCoachDesk,
  patchCoachAccount,
  appointmentStatusLabel,
  type AppointmentStatus,
  type CoachStatus,
  type CoachTrack,
} from '../lib/coaches';
import {
  adminPatchCoach,
  adminSetAccountStatus,
  adminSetCoachStatus,
  fetchAdminBundle,
  insertAdminNote,
  insertFinanceRow,
  markFinancePaid,
  respondAppointment,
  updateAppointmentStatus,
  type CloudAdminBundle,
  type CloudCoach,
} from '../lib/cloudPlatform';
import { today } from '../lib/util';

type Tab = 'ozet' | 'kullanici' | 'koc' | 'eslesme' | 'finans' | 'randevu' | 'ayar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ozet', label: 'Genel bakış' },
  { id: 'kullanici', label: 'Kullanıcılar' },
  { id: 'koc', label: 'Koçlar' },
  { id: 'eslesme', label: 'Eşleştirme' },
  { id: 'finans', label: 'Finans' },
  { id: 'randevu', label: 'Randevular' },
  { id: 'ayar', label: 'Ayarlar' },
];

function statusLabel(s: CoachStatus) {
  return s === 'pending' ? 'Başvuru' : s === 'active' ? 'Aktif' : s === 'pasif' ? 'Pasif' : 'Red';
}

export function AdminGate() {
  const { go, user } = useApp();
  return (
    <div className="card notice" style={{ marginTop: 8 }}>
      <div className="section-title"><h3>Yetkisiz</h3></div>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        {user
          ? 'Bu hesap yönetici paneline giremez. Öğrenci ve koç oturumları bu ekranı kullanamaz.'
          : 'Yönetici paneli için Hesabım’dan yönetici hesabınla giriş yap.'}
      </p>
      <div className="actions">
        <button className="btn primary" type="button" onClick={() => go(user ? 'home' : 'account')}>{user ? 'Ana sayfa' : 'Hesabım'}</button>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { user, profile, data, toast, go, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>('ozet');
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [coachFilter, setCoachFilter] = useState<CoachStatus | 'Tümü'>('Tümü');
  const [apptFilter, setApptFilter] = useState<AppointmentStatus | 'Tümü'>('Tümü');
  const [apptDate, setApptDate] = useState('');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editTrack, setEditTrack] = useState<CoachTrack>('YKS Sayısal');
  const [editFocus, setEditFocus] = useState('');
  const [payCoach, setPayCoach] = useState('');
  const [payAmount, setPayAmount] = useState('1000');
  const [payKind, setPayKind] = useState<FinanceKind>('odeme');
  const [payNote, setPayNote] = useState('');
  const [pct, setPct] = useState(() => String(loadAdminSettings().commissionPct));
  const [noteCoach, setNoteCoach] = useState('');
  const [noteText, setNoteText] = useState('');
  const [cloud, setCloud] = useState<CloudAdminBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const owner = isAdmin;
  const localSnap = useMemo(
    () => adminSnapshot(user?.email ? { name: profile?.name || '', email: user.email, plan: profile?.plan || 'Ücretsiz', grade: data.grade } : undefined),
    [user?.email, profile?.name, profile?.plan, data.grade, tick],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAdminBundle().then((b) => {
      if (!alive) return;
      setCloud(b);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [tick]);

  if (!owner) return <AdminGate />;

  function refresh() {
    setTick((n) => n + 1);
  }

  const coaches: CloudCoach[] = cloud?.coaches ?? localSnap.coaches.map(({ passHash: _hash, ...c }) => ({ ...c, userId: null }));
  const desks = cloud?.desks ?? localSnap.desks;
  const apptsAll = cloud?.appts ?? localSnap.appts;
  const links = cloud?.links ?? localSnap.links;
  const finance = cloud?.finance.length ? cloud.finance : loadFinance();
  const notes = cloud?.notes.length ? cloud.notes : loadAdminNotes();
  const source = cloud ? 'supabase' : 'yerel yedek';
  const studentCount = cloud ? cloud.profiles.filter((p) => p.role !== 'coach').length : localSnap.studentCount;
  const activeCoaches = coaches.filter((a) => a.status === 'active').length;
  const pendingCoaches = coaches.filter((a) => a.status === 'pending').length;
  const pendingAppts = apptsAll.filter((a) => a.status === 'bekliyor').length;
  const paid = finance.filter((f) => f.status === 'odendi' && f.kind === 'odeme');
  const gross = paid.reduce((a, f) => a + f.amount, 0);
  const commission = paid.reduce((a, f) => a + f.commission, 0);

  async function setStatus(id: string, status: CoachStatus) {
    const cloudOk = await adminSetCoachStatus(id, status);
    if (!cloudOk) patchCoachAccount(id, { status });
    toast(status === 'active' ? 'Koç onaylandı.' : status === 'rejected' ? 'Başvuru reddedildi.' : 'Durum güncellendi.');
    refresh();
  }

  async function saveEdit() {
    if (!editId) return;
    const cloudOk = await adminPatchCoach(editId, { name: editName.trim(), track: editTrack, focus: editFocus.trim() });
    if (!cloudOk) patchCoachAccount(editId, { name: editName.trim(), track: editTrack, focus: editFocus.trim() });
    setEditId('');
    toast('Koç bilgisi kaydedildi.');
    refresh();
  }

  const users = (cloud
    ? cloud.profiles.map((p) => ({
      id: p.id,
      name: p.name || '—',
      email: p.email,
      kind: p.role === 'admin' ? 'Yönetici' : p.role === 'coach' ? 'Koç hesabı' : 'Öğrenci',
      status: p.account_status === 'pasif' ? 'Pasif' : 'Aktif',
      extra: `${p.plan} • ${p.target_department || '—'}`,
      pasif: p.account_status === 'pasif',
    }))
    : [
      ...(localSnap.current ? [{ id: 'me', name: localSnap.current.name || 'Sen', email: localSnap.current.email, kind: 'Öğrenci (bu oturum)', status: 'Girişte', extra: `${localSnap.current.grade} • ${localSnap.current.plan}`, pasif: false }] : []),
      ...localSnap.links.map((l, i) => ({ id: `st_${i}`, name: l.studentName, email: '—', kind: 'Koç öğrencisi', status: 'Kayıtlı', extra: `${l.grade} • ${l.coachName}`, pasif: false })),
    ]
  ).filter((u) => {
    const s = q.toLocaleLowerCase('tr-TR');
    if (!s) return true;
    return `${u.name} ${u.email} ${u.kind}`.toLocaleLowerCase('tr-TR').includes(s);
  });

  const coachesView = coaches.filter((c) => coachFilter === 'Tümü' || c.status === coachFilter);
  const appts = apptsAll.filter((a) => (apptFilter === 'Tümü' || a.status === apptFilter) && (!apptDate || a.date === apptDate));

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Yönetici paneli</div>
        <h2>Platform yönetimi</h2>
        <p>Kaynak: {loading ? 'yükleniyor…' : source}. Finans ödeme almaz; defter hazırlığı.</p>
      </div>
      <div className="chip-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? 'on' : ''}`} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'ozet' ? (
        <div className="grid stats" style={{ marginTop: 16 }}>
          <div className="card stat"><div className="label">Öğrenci</div><div className="value">{studentCount}</div></div>
          <div className="card stat"><div className="label">Koç</div><div className="value">{coaches.length}</div></div>
          <div className="card stat"><div className="label">Aktif koç</div><div className="value">{activeCoaches}</div></div>
          <div className="card stat"><div className="label">Bekleyen başvuru</div><div className="value">{pendingCoaches}</div></div>
          <div className="card stat"><div className="label">Gelir (defter)</div><div className="value" style={{ fontSize: 20 }}>{formatTry(gross)}</div></div>
          <div className="card stat"><div className="label">Komisyon</div><div className="value" style={{ fontSize: 20 }}>{formatTry(commission)}</div></div>
          <div className="card stat"><div className="label">Bekleyen randevu</div><div className="value">{pendingAppts}</div></div>
        </div>
      ) : null}

      {tab === 'kullanici' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Kullanıcılar</h3><span>{cloud ? 'profiles' : 'Yerel yedek'}</span></div>
          <div className="field"><label>Ara</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, e-posta, tür" /></div>
          {users.length ? users.map((u) => (
            <div className="plan-item" key={u.id}>
              <span><b>{u.name}</b><br /><small style={{ color: 'var(--muted)' }}>{maskEmail(u.email)} • {u.kind} • {u.extra}</small></span>
              <span>
                <span className="chip">{u.status}</span>
                {cloud && u.id !== user?.id ? (
                  <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => void adminSetAccountStatus(u.id, u.pasif ? 'active' : 'pasif').then((ok) => {
                    toast(ok ? 'Hesap güncellendi.' : 'Güncellenemedi (RLS / SQL).');
                    refresh();
                  })}>{u.pasif ? 'Aktif et' : 'Pasif'}</button>
                ) : null}
              </span>
            </div>
          )) : <div className="empty">Kayıt yok veya SQL henüz uygulanmadı.</div>}
        </div>
      ) : null}

      {tab === 'koc' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Koç yönetimi</h3></div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {(['Tümü', 'pending', 'active', 'pasif', 'rejected'] as const).map((s) => (
              <button key={s} className={`chip ${coachFilter === s ? 'on' : ''}`} type="button" onClick={() => setCoachFilter(s)}>
                {s === 'Tümü' ? 'Tümü' : statusLabel(s)}
              </button>
            ))}
          </div>
          {coachesView.map((c) => {
            const desk = desks[c.id] || loadCoachDesk(c.id);
            return (
              <div className="card" key={c.id} style={{ boxShadow: 'none', marginBottom: 12 }}>
                <div className="plan-item">
                  <span>
                    <b>{c.name}</b> • {c.track}
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{c.email} • {c.focus} • masa {desk.students.length} / beyan {c.studentCount}</small>
                  </span>
                  <span className="chip">{statusLabel(c.status)}</span>
                </div>
                <div className="actions">
                  {c.status === 'pending' ? (
                    <>
                      <button className="btn primary" type="button" onClick={() => void setStatus(c.id, 'active')}>Onayla</button>
                      <button className="btn secondary" type="button" onClick={() => void setStatus(c.id, 'rejected')}>Reddet</button>
                    </>
                  ) : null}
                  {c.status === 'active' ? <button className="btn" type="button" onClick={() => void setStatus(c.id, 'pasif')}>Pasif</button> : null}
                  {c.status === 'pasif' ? <button className="btn primary" type="button" onClick={() => void setStatus(c.id, 'active')}>Aktif et</button> : null}
                  <button className="btn secondary" type="button" onClick={() => { setEditId(c.id); setEditName(c.name); setEditTrack(c.track); setEditFocus(c.focus); }}>Düzenle</button>
                </div>
              </div>
            );
          })}
          {editId ? (
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div className="field"><label>Ad</label><input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="field">
                <label>Branş</label>
                <select value={editTrack} onChange={(e) => setEditTrack(e.target.value as CoachTrack)}>
                  {COACH_TRACKS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Uzmanlık</label><input value={editFocus} onChange={(e) => setEditFocus(e.target.value)} /></div>
              <div className="actions" style={{ gridColumn: '1 / -1' }}>
                <button className="btn primary" type="button" onClick={() => void saveEdit()}>Kaydet</button>
                <button className="btn" type="button" onClick={() => setEditId('')}>Vazgeç</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'eslesme' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Öğrenci–koç</h3></div>
          {links.length ? links.map((l, i) => (
            <div className="plan-item" key={`${l.coachId}_${i}`}>
              <span>{l.studentName} <small style={{ color: 'var(--muted)' }}>({l.grade})</small></span>
              <span className="chip">{l.coachName}</span>
            </div>
          )) : <div className="empty">Eşleşme yok.</div>}
          <div className="field" style={{ marginTop: 12 }}>
            <label>Yönetici notu</label>
            <select value={noteCoach} onChange={(e) => setNoteCoach(e.target.value)}>
              <option value="">Koç seç</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input style={{ marginTop: 8 }} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Müdahale notu" />
          </div>
          {notes.filter((n) => !noteCoach || n.coachId === noteCoach).slice(0, 8).map((n) => (
            <div className="plan-item" key={n.id}>
              <span>{n.text}<br /><small style={{ color: 'var(--muted)' }}>{n.at.slice(0, 16).replace('T', ' ')}</small></span>
            </div>
          ))}
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => {
              if (!noteCoach || noteText.trim().length < 2) return toast('Koç ve not gerekli.');
              void insertAdminNote(noteCoach, noteText.trim(), user?.id).then((ok) => {
                if (!ok) addAdminNote(noteCoach, noteText.trim());
                toast('Müdahale notu kaydedildi.');
                setNoteText('');
                refresh();
              });
            }}>Not kaydet</button>
          </div>
        </div>
      ) : null}

      {tab === 'finans' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Finans hazırlığı</h3><span>Kart / ödeme yok</span></div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Gerçek tahsilat yok. Komisyon %{localSnap.settings.commissionPct}. Kayıtlar deftere ve varsa Supabase’e yazılır.</p>
          <div className="form-grid">
            <div className="field">
              <label>Koç</label>
              <select value={payCoach} onChange={(e) => setPayCoach(e.target.value)}>
                <option value="">Seç</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Tutar (₺)</label><input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div className="field">
              <label>Tür</label>
              <select value={payKind} onChange={(e) => setPayKind(e.target.value as FinanceKind)}>
                <option value="odeme">Ödeme</option>
                <option value="iade">İade</option>
              </select>
            </div>
            <div className="field"><label>Not</label><input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Defter notu" /></div>
          </div>
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => {
              const acc = coaches.find((c) => c.id === payCoach);
              const amount = Math.max(0, Number(payAmount) || 0);
              if (!acc || amount <= 0) return toast('Koç ve tutar gerekli.');
              const commissionAmt = payKind === 'odeme' ? Math.round(amount * localSnap.settings.commissionPct) / 100 : 0;
              const entry = addFinance({
                date: today(),
                coachId: acc.id,
                coachName: acc.name,
                amount,
                commission: commissionAmt,
                kind: payKind,
                status: payKind === 'iade' ? 'iade' : 'bekliyor',
                note: payNote.trim() || (payKind === 'iade' ? 'İade kaydı' : 'Koçluk ödemesi'),
              });
              void insertFinanceRow(entry);
              toast('Deftere yazıldı.');
              refresh();
            }}>Deftere yaz</button>
          </div>
          {finance.map((f) => (
            <div className="plan-item" key={f.id}>
              <span>{f.coachName} • {f.note}<br /><small style={{ color: 'var(--muted)' }}>{f.date} • {f.kind} • koç {formatTry(f.amount - f.commission)}</small></span>
              <span>
                <b>{formatTry(f.amount)}</b>
                {f.status === 'bekliyor' ? (
                  <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => {
                    void markFinancePaid(f.id).then((ok) => {
                      if (!ok) saveFinance(loadFinance().map((x) => x.id === f.id ? { ...x, status: 'odendi' as FinanceStatus } : x));
                      toast('Ödendi işaretlendi (tahsilat yok).');
                      refresh();
                    });
                  }}>Ödendi</button>
                ) : <span className="chip" style={{ marginLeft: 8 }}>{f.status}</span>}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'randevu' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Randevular</h3></div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Yönetici görüşme odasına katılmaz. Katılma öğrenci veya koç hesabı ile Koçlar sayfasındadır.</p>
          <div className="form-grid">
            <div className="field"><label>Tarih</label><input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} /></div>
            <div className="field">
              <label>Durum</label>
              <select value={apptFilter} onChange={(e) => setApptFilter(e.target.value as AppointmentStatus | 'Tümü')}>
                <option value="Tümü">Tümü</option>
                <option value="bekliyor">Bekleyen</option>
                <option value="onay">Onaylı</option>
                <option value="tamamlandi">Tamamlanan</option>
                <option value="iptal">İptal</option>
              </select>
            </div>
          </div>
          {appts.length ? appts.map((a) => (
            <div className="plan-item" key={a.id}>
              <span>
                {a.studentName} → {a.coachName}
                <br />
                <small style={{ color: 'var(--muted)' }}>{a.date} {a.time} • {a.minutes} dk</small>
              </span>
              <span>
                <span className="chip">{appointmentStatusLabel(a, 'coach')}</span>
                {a.status === 'bekliyor' ? (
                  <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => {
                    void respondAppointment(a.id, true).then((res) => {
                      if (!res.ok) {
                        toast(res.error);
                        return;
                      }
                      toast(res.message);
                      refresh();
                    });
                  }}>Onayla</button>
                ) : null}
                {a.status === 'onay' ? (
                  <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => {
                    void updateAppointmentStatus(a.id, 'tamamlandi').then((ok) => {
                      if (!ok) setApptStatus(a.coachId, a.id, 'tamamlandi');
                      toast('Tamamlandı.');
                      refresh();
                    });
                  }}>Tamamla</button>
                ) : null}
              </span>
            </div>
          )) : <div className="empty">Randevu yok.</div>}
        </div>
      ) : null}

      {tab === 'ayar' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Sistem</h3></div>
          <div className="status-grid">
            <div className="status"><b>Yönetici</b><span>{maskEmail(user?.email || '')}</span></div>
            <div className="status"><b>Kilidi</b><span>{platformOwnerEmail() ? 'Ortam değişkeni' : 'Tanımsız'}</span></div>
            <div className="status"><b>Erişim</b><span>is_admin() / oturum</span></div>
            <div className="status"><b>Veri</b><span>{source}</span></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Platform komisyonu (%)</label>
            <input type="number" min={0} max={50} value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => {
              saveAdminSettings({ commissionPct: Number(pct) || 0 });
              toast('Ayar kaydedildi.');
              refresh();
            }}>Kaydet</button>
            <button className="btn" type="button" onClick={() => go('home')}>Öğrenci paneline dön</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
