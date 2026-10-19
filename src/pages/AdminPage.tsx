import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  addAdminNote,
  addFinance,
  adminSnapshot,
  loadAdminNotes,
  loadAdminSettings,
  loadFinance,
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
  adminListStudentApplications,
  adminBillingOverview,
  adminListBilling,
  adminListPayments,
  adminReviewStudent,
  fetchAdminBundle,
  insertAdminNote,
  insertFinanceRow,
  markFinancePaid,
  decideApprovedAppointmentCancel,
  respondAppointment,
  updateAppointmentStatus,
  type CloudAdminBundle,
  type CloudCoach,
  type StudentApplication,
  type AdminPaymentRow,
  type BillingOverview,
  type BillingRow,
} from '../lib/cloudPlatform';
import { today } from '../lib/util';
import { activeMembershipCount, shopierRevenueFromPayments } from '../lib/shopierRevenue';
import { istanbulToday } from '../lib/meeting';
import { displayMembershipName, labelStoredPlan } from '../lib/subscription';
import { canDecideApprovedCancel } from '../lib/appointmentCancelPolicy';
import { normalizePlanId } from '../lib/plans';
import { paymentStatusLabel } from '../lib/billing';
import { SQL_DRAFTS, draftStatusLabel } from '../lib/deployStatus';
import { supabase, withTimeout } from '../lib/supabase';
import { AdminSupportPanel } from '../components/AdminSupportPanel';
import {
  adminListModerationViolations,
  adminReviewModerationViolation,
  fetchModerationConfig,
  moderationAccountMismatch,
  moderationKindLabel,
  moderationStatusLabel,
  type ModerationViolationRow,
} from '../lib/moderationCloud';
import type { ModerationStatus } from '../lib/contentModeration';

type Tab = 'ozet' | 'basvuru' | 'uyelik' | 'kullanici' | 'koc' | 'eslesme' | 'finans' | 'randevu' | 'denetim' | 'mesajlar' | 'ayar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ozet', label: 'Genel Bakış' },
  { id: 'basvuru', label: 'Öğrenciler ve Koçlar' },
  { id: 'kullanici', label: 'Hesap Yönetimi' },
  { id: 'uyelik', label: 'Üyelikler ve Denemeler' },
  { id: 'finans', label: 'Ödemeler' },
  { id: 'denetim', label: 'Görüşme Denetimi' },
  { id: 'mesajlar', label: '📩 Gelen Destek Mesajları' },
  { id: 'ayar', label: 'Sistem Güvenliği' },
];

function statusLabel(s: CoachStatus) {
  return s === 'pending' ? 'Başvuru' : s === 'active' ? 'Aktif' : s === 'pasif' ? 'Pasif' : 'Red';
}

export function AdminGate() {
  const { go, user } = useApp();
  return (
    <div className="card notice" style={{ marginTop: 8 }}>
      <div className="section-title"><h3>Yetkisiz</h3></div>
      <p className="muted">
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
  const [apptDate, setApptDate] = useState(istanbulToday);
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
  const [apps, setApps] = useState<StudentApplication[] | null>(null);
  const [billingRows, setBillingRows] = useState<BillingRow[] | null>(null);
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [payRows, setPayRows] = useState<AdminPaymentRow[] | null>(null);
  const [appFilter, setAppFilter] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [rejectId, setRejectId] = useState('');
  const [violations, setViolations] = useState<ModerationViolationRow[] | null>(null);
  const [modCfg, setModCfg] = useState<{
    lexicon: boolean;
    voiceStt: boolean;
    voiceEnforcement: boolean;
    gemini: boolean;
    note: string;
    configured: boolean;
  } | null>(null);
  const [violNote, setViolNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const owner = isAdmin;
  const localSnap = useMemo(
    () => adminSnapshot(user?.email ? { name: profile?.name || '', email: user.email, plan: displayMembershipName(profile, Date.now(), isAdmin), grade: data.grade } : undefined),
    [user?.email, profile?.name, profile?.plan, data.grade, tick],
  );
  const shopierRev = useMemo(() => shopierRevenueFromPayments(payRows), [payRows]);
  const shopierActive = useMemo(() => activeMembershipCount(billingRows), [billingRows]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAdminBundle().then((b) => {
      if (!alive) return;
      setCloud(b);
      setLoading(false);
    });
    void adminListStudentApplications().then((rows) => {
      if (!alive) return;
      setApps(rows);
    });
    void adminListBilling().then((rows) => {
      if (!alive) return;
      setBillingRows(rows);
    });
    void adminBillingOverview().then((o) => {
      if (!alive) return;
      setBillingOverview(o);
    });
    void adminListPayments().then((rows) => {
      if (!alive) return;
      setPayRows(rows);
    });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    if (!owner || tab !== 'kullanici') return;
    let alive = true;
    void fetchModerationConfig().then((c) => {
      if (alive) setModCfg(c);
    });
    void adminListModerationViolations().then((res) => {
      if (!alive) return;
      setViolations(res.ok ? res.rows : []);
      if (!res.ok && res.error) toast(res.error);
    });
    return () => { alive = false; };
  }, [owner, tab, tick, toast]);

  if (!owner) return <AdminGate />;

  function refresh() {
    setTick((n) => n + 1);
  }

  async function reviewViolation(row: ModerationViolationRow, status: ModerationStatus, reactivate: boolean) {
    const profile = cloud?.profiles.find((p) => p.id === row.user_id);
    const isAdminTarget = profile?.role === 'admin';
    // Önce DB+Auth (admin-account-status); başarısızsa ihlal satırı değişmez → tutarsız “başarı” yok.
    if (status === 'suspended' && !isAdminTarget) {
      const sync = await adminSetAccountStatus(row.user_id, 'pasif');
      if (!sync.ok) {
        toast(`Askı başarısız (DB/Auth). İhlal kaydı değiştirilmedi: ${sync.error}`);
        return;
      }
      if (sync.db === false || sync.auth === false) {
        toast('Hesap senkronu eksik (DB veya Auth). İhlal kaydı yazılmadı; durumu kontrol edin.');
        return;
      }
    } else if (status === 'restored' && reactivate) {
      const sync = await adminSetAccountStatus(row.user_id, 'active');
      if (!sync.ok) {
        toast(`Geri açma başarısız (DB/Auth). İhlal kaydı değiştirilmedi: ${sync.error}`);
        return;
      }
      if (sync.db === false || sync.auth === false) {
        toast('Hesap senkronu eksik (DB veya Auth). İhlal kaydı yazılmadı; durumu kontrol edin.');
        return;
      }
    } else if (status === 'suspended' && isAdminTarget) {
      toast('Yönetici hesabı Auth ile askıya alınmaz; yalnızca ihlal kaydı güncellenecek.');
    }

    const res = await adminReviewModerationViolation({
      id: row.id,
      status,
      notes: violNote,
      reactivate,
    });
    if (!res.ok) {
      toast(
        (status === 'suspended' || (status === 'restored' && reactivate))
          ? `Hesap durumu güncellendi ancak ihlal kaydı yazılamadı: ${res.error || 'hata'}. Uyumsuzluk panoda görünecek.`
          : (res.error || 'Güncellenemedi.'),
      );
      refresh();
      return;
    }
    toast(
      status === 'suspended' || (status === 'restored' && reactivate)
        ? 'Hesap (DB+Auth) ve ihlal kaydı güncellendi.'
        : 'İhlal kaydı güncellendi.',
    );
    setViolNote('');
    refresh();
  }

  const coaches: CloudCoach[] = cloud?.coaches ?? localSnap.coaches.map(({ passHash: _hash, ...c }) => ({ ...c, userId: null }));
  const desks = cloud?.desks ?? localSnap.desks;
  const apptsAll = cloud?.appts ?? localSnap.appts;
  const links = cloud?.links ?? localSnap.links;
  const finance = cloud?.finance.length ? cloud.finance : loadFinance();
  const notes = cloud?.notes.length ? cloud.notes : loadAdminNotes();
  const studentCount = cloud ? cloud.profiles.filter((p) => p.role !== 'coach').length : localSnap.studentCount;
  const activeCoaches = coaches.filter((a) => a.status === 'active').length;
  const pendingCoaches = coaches.filter((a) => a.status === 'pending').length;
  const pendingAppts = apptsAll.filter((a) => a.status === 'bekliyor').length;

  const fallbackApps: StudentApplication[] = (cloud?.profiles || [])
    .filter((p) => p.role === 'student' && p.signup_intent !== 'coach')
    .map((p) => ({
      id: p.id,
      name: p.name || 'Öğrenci',
      email: p.email,
      registered_at: '',
      account_status: p.account_status,
      email_confirmed: true,
      signup_grade: p.signup_grade || p.target_department || '',
      signup_track: p.signup_track || '',
      signup_exam: p.signup_exam || '',
      approval_note: p.approval_note || '',
    }));
  const studentApps = apps ?? fallbackApps;
  const appsView = studentApps.filter((a) => a.account_status === appFilter);

  async function reviewStudent(id: string, status: 'active' | 'rejected', note = '') {
    const msg = status === 'active'
      ? 'Bu öğrencinin sisteme erişmesine izin vermek istediğinize emin misiniz?'
      : 'Bu başvuruyu reddetmek istediğinize emin misiniz?';
    if (!confirm(msg)) return;
    const res = await adminReviewStudent(id, status, note);
    toast(res.ok ? (status === 'active' ? 'Öğrenci onaylandı.' : 'Başvuru reddedildi.') : res.error);
    setRejectId('');
    setRejectNote('');
    refresh();
  }

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
      status: p.account_status === 'pasif' ? 'Pasif' : p.account_status === 'pending' ? 'Onay bekliyor' : p.account_status === 'rejected' ? 'Red' : 'Aktif',
      accountStatus: p.account_status,
      role: p.role,
      extra: `${labelStoredPlan(p.plan)} • ${p.target_department || '—'}`,
      pasif: p.account_status === 'pasif',
    }))
    : [
      ...(localSnap.current ? [{ id: 'me', name: localSnap.current.name || 'Sen', email: localSnap.current.email, kind: 'Öğrenci (bu oturum)', status: 'Girişte', accountStatus: 'active' as const, role: 'student' as const, extra: `${localSnap.current.grade} • ${localSnap.current.plan}`, pasif: false }] : []),
      ...localSnap.links.map((l, i) => ({ id: `st_${i}`, name: l.studentName, email: '—', kind: 'Koç öğrencisi', status: 'Kayıtlı', accountStatus: 'active' as const, role: 'student' as const, extra: `${l.grade} • ${l.coachName}`, pasif: false })),
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
        <h2>Yönetim</h2>
        <p>{loading ? 'Kayıtlar yükleniyor…' : (cloud ? 'Sayılar sunucudan gelir; uydurma istatistik yok.' : 'Sunucu listesi alınamadı. Aşağıdakiler bu tarayıcıdaki yedektir.')}</p>
      </div>
      <div className="chip-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? 'on' : ''}`} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'ozet' ? (
        <>
        <div className="grid stats" style={{ marginTop: 16 }}>
          <div className="card stat"><div className="label">Öğrenci kaydı</div><div className="value">{studentCount}</div></div>
          <div className="card stat"><div className="label">Aktif koç</div><div className="value">{activeCoaches}</div></div>
          <div className="card stat"><div className="label">Koç başvurusu</div><div className="value">{pendingCoaches}</div></div>
          <div className="card stat"><div className="label">Bekleyen randevu</div><div className="value">{pendingAppts}</div></div>
          {billingRows ? (
            <div className="card stat"><div className="label">Açık deneme</div><div className="value">{billingRows.filter((r) => r.subscription_status === 'trialing').length}</div></div>
          ) : null}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Askıya alma, deneme ve görsel analiz canlıya işlenmeden çalışmaz. Sistem Güvenliği sekmesinde taslak durumunu görebilirsin.</p>
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => go('analytics')}>Analizler sayfası</button>
          </div>
        </div>
        </>
      ) : null}

      {tab === 'basvuru' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Öğrenci başvuruları</h3><span>{apps == null ? 'profiles yedeği' : 'sunucu'}</span></div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {(['pending', 'active', 'rejected'] as const).map((s) => (
              <button key={s} className={`chip ${appFilter === s ? 'on' : ''}`} type="button" onClick={() => setAppFilter(s)}>
                {s === 'pending' ? 'Bekleyen' : s === 'active' ? 'Onaylanan' : 'Reddedilen'}
              </button>
            ))}
          </div>
          {appsView.length ? appsView.map((a) => (
            <div className="card" key={a.id} style={{ boxShadow: 'none', marginBottom: 12 }}>
              <div className="plan-item">
                <span>
                  <b>{a.name}</b>
                  <br />
                  <small className="muted">
                    {a.email}
                    {a.signup_grade ? ` • ${a.signup_grade}` : ''}
                    {a.signup_track ? ` • ${a.signup_track}` : ''}
                    {a.signup_exam ? ` • ${a.signup_exam}` : ''}
                    {a.registered_at ? ` • ${a.registered_at.slice(0, 10)}` : ''}
                  </small>
                  <br />
                  <small className="muted">
                    E-posta: {a.email_confirmed ? 'Doğrulandı' : 'Doğrulanmadı'} • Durum: {a.account_status === 'pending' ? 'Onay bekliyor' : a.account_status === 'active' ? 'Onaylandı' : 'Reddedildi'}
                  </small>
                </span>
              </div>
              {a.account_status === 'pending' ? (
                <div className="actions">
                  <button className="btn primary" type="button" onClick={() => void reviewStudent(a.id, 'active')}>Öğrenciyi onayla</button>
                  <button className="btn secondary" type="button" onClick={() => { setRejectId(a.id); setRejectNote(''); }}>Reddet</button>
                </div>
              ) : null}
              {rejectId === a.id ? (
                <div className="field" style={{ marginTop: 8 }}>
                  <label>Red nedeni (isteğe bağlı)</label>
                  <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                  <div className="actions">
                    <button className="btn" type="button" onClick={() => void reviewStudent(a.id, 'rejected', rejectNote)}>Reddi onayla</button>
                    <button className="btn secondary" type="button" onClick={() => setRejectId('')}>Vazgeç</button>
                  </div>
                </div>
              ) : null}
            </div>
          )) : <div className="empty">{appFilter === 'pending' ? 'Bekleyen öğrenci başvurusu yok.' : 'Kayıt yok.'}</div>}
        </div>
      ) : null}

      {tab === 'uyelik' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Üyelikler</h3><span>{billingRows ? 'sunucu' : 'kayıt yok'}</span></div>
          {(() => {
            const rows = billingRows || [];
            const n = (pred: (r: BillingRow) => boolean) => rows.filter(pred).length;
            const soon = Date.now() + 7 * 86400000;
            return (
              <div className="grid stats" style={{ marginBottom: 16 }}>
                <div className="card stat"><div className="label">Aktif öğrenci</div><div className="value">{n((r) => r.account_status === 'active')}</div></div>
                <div className="card stat"><div className="label">Deneme</div><div className="value">{n((r) => r.subscription_status === 'trialing')}</div></div>
                <div className="card stat"><div className="label">Pro</div><div className="value">{n((r) => r.subscription_status === 'active' && normalizePlanId(r.plan) === 'pro')}</div></div>
                <div className="card stat"><div className="label">Premium</div><div className="value">{n((r) => r.subscription_status === 'active' && normalizePlanId(r.plan) === 'premium')}</div></div>
                <div className="card stat"><div className="label">7 gün içinde biten</div><div className="value">{n((r) => {
                  const t = r.subscription_ends_at || r.trial_ends_at;
                  const ms = t ? new Date(t).getTime() : 0;
                  return ms > Date.now() && ms <= soon;
                })}</div></div>
                <div className="card stat"><div className="label">İptal</div><div className="value">{billingOverview ? billingOverview.canceled : n((r) => r.subscription_status === 'canceled')}</div></div>
                <div className="card stat"><div className="label">Başarısız ödeme</div><div className="value">{billingOverview ? billingOverview.failed_payments : '—'}</div></div>
                <div className="card stat"><div className="label">Doğrulanmış tahsilat</div><div className="value">{billingOverview ? `${billingOverview.verified_total_try} TL` : '—'}</div></div>
              </div>
            );
          })()}
          <p className="muted">Doğrulanmış toplam başarılı ödemelerin toplamıdır. Shopier ayrımı aşağıdaki kartlarda; ödeme tablosu okunamazsa tire görünür. Sahte ciro yok.</p>
          <div className="grid stats" style={{ marginBottom: 16 }}>
            <div className="card stat"><div className="label">Shopier sipariş</div><div className="value">{payRows ? shopierRev.orderCount : '—'}</div></div>
            <div className="card stat"><div className="label">Shopier brüt</div><div className="value">{payRows ? `${shopierRev.grossTry} TL` : '—'}</div></div>
            <div className="card stat"><div className="label">Shopier iade</div><div className="value">{payRows ? `${shopierRev.refundedTry} TL` : '—'}</div></div>
            <div className="card stat"><div className="label">Abonelik net</div><div className="value">{payRows ? `${shopierRev.netTry} TL` : '—'}</div></div>
            <div className="card stat"><div className="label">Aktif üyelik</div><div className="value">{billingRows ? shopierActive : '—'}</div></div>
            <div className="card stat"><div className="label">Koç defteri (ayrı)</div><div className="value">{formatTry(localSnap.gross)}</div></div>
          </div>
          <p className="muted">Koç kazancı Shopier brütünden düşülmez; ayrı defterdir. Tam iadede o ödemenin 30 günü düşülür, kalan süre yoksa erişim kapanır. Kısmi iade erişimi değiştirmez.</p>
          {(billingRows || []).length ? (billingRows || []).map((r) => (
            <div className="plan-item" key={r.id}>
              <span>
                <b>{r.name}</b>
                <br />
                <small className="muted">{r.email} • {labelStoredPlan(r.plan)} • {r.subscription_status || 'legacy'} • {r.account_status}</small>
              </span>
            </div>
          )          ) : <div className="empty">Kayıt yok veya üyelik verisi okunamadı.</div>}
          <div className="section-title" style={{ marginTop: 20 }}><h3>Ödemeler</h3><span>{payRows ? 'sunucu' : 'okunamadı'}</span></div>
          {payRows === null ? (
            <p className="muted">Ödeme listesi okunamadı. Kart veya gizli anahtar gösterilmez.</p>
          ) : payRows.length === 0 ? (
            <p className="muted">Doğrulanmış ödeme satırı yok.</p>
          ) : payRows.map((p) => (
            <div className="plan-item" key={p.id}>
              <span>
                <b>{paymentStatusLabel(p.status)}</b>
                <br />
                <small className="muted">
                  {[p.email, p.provider, p.providerPaymentId || '—', p.planId ? labelStoredPlan(p.planId) : '',
                    p.coversEnd ? `dönem sonu ${new Date(p.coversEnd).toLocaleDateString('tr-TR')}` : '',
                    p.refundedAt ? `iade ${new Date(p.refundedAt).toLocaleDateString('tr-TR')}` : '',
                    p.status === 'succeeded' && p.refundedTotalTry ? `kısmi iade ${p.refundedTotalTry} TL` : '',
                  ].filter(Boolean).join(' • ')}
                </small>
              </span>
              <b>{p.amountTry} {p.currency}</b>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'kullanici' ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>AI Küfür ve Uygunsuz Dil Denetimi</h3></div>
            <p className="muted" style={{ marginTop: 0 }}>
              Profil adları sunucu lexikonu ile denetlenir. Ses denetimi yalnızca imzalı sunucu STT webhook ile yapılır;
              istemci transcript ve ses seviyesi ceza üretmez. Yönetici hesapları otomatik askıya alınmaz.
            </p>
            {modCfg ? (
              <p className="muted">
                Lexikon: {modCfg.lexicon ? 'açık' : 'yok'}
                {' · '}STT webhook: {modCfg.voiceStt ? 'yapılandırıldı' : 'eksik (ses BLOCKED)'}
                {' · '}Ses askısı: {modCfg.voiceEnforcement ? 'açık' : 'kapalı'}
                {' · '}Gemini: {modCfg.gemini ? 'var' : 'yok'}
                {modCfg.note ? ` · ${modCfg.note}` : ''}
              </p>
            ) : <p className="muted">Yapılandırma okunuyor…</p>}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>İhlal Kayıtları</h3><span>{violations ? `${violations.length} kayıt` : '…'}</span></div>
            <div className="field"><label>Yönetici gerekçesi</label><input value={violNote} onChange={(e) => setViolNote(e.target.value)} placeholder="İnceleme notu" maxLength={500} /></div>
            {violations === null ? <p className="muted">Yükleniyor…</p> : null}
            {violations && !violations.length ? <p className="muted">İhlal kaydı yok veya 050 henüz uygulanmadı.</p> : null}
            {(violations || []).map((v) => {
              const who = users.find((u) => u.id === v.user_id);
              const mismatch = moderationAccountMismatch(v.status, who?.accountStatus);
              return (
                <div className="plan-item" key={v.id} style={{ alignItems: 'flex-start' }}>
                  <span>
                    <b>{who?.name || v.user_id.slice(0, 8)}</b>
                    <br />
                    <small className="muted">
                      {moderationKindLabel(v.kind)} · {v.evidence_label || v.category}
                      {' · '}güven %{(v.confidence * 100).toFixed(0)}
                      {' · '}{new Date(v.created_at).toLocaleString('tr-TR')}
                      <br />
                      İhlal: {moderationStatusLabel(v.status)}
                      {' · '}Hesap: {who?.status || 'bilinmiyor'}
                      {v.admin_notes ? ` · Not: ${v.admin_notes}` : ''}
                      {mismatch === 'viol_suspended_acct_active' ? (
                        <><br /><span style={{ color: 'var(--danger, #b91c1c)' }}>Uyumsuz: ihlal askıda, hesap aktif — Askıda tut ile DB+Auth düzeltin.</span></>
                      ) : null}
                      {mismatch === 'viol_restored_acct_pasif' ? (
                        <><br /><span style={{ color: 'var(--danger, #b91c1c)' }}>Uyumsuz: ihlal açık/incelemede, hesap pasif — Geri aç ile DB+Auth düzeltin.</span></>
                      ) : null}
                    </small>
                  </span>
                  <span className="actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn secondary" type="button" onClick={() => void reviewViolation(v, 'reviewing', false)}>İnceleniyor</button>
                    <button className="btn" type="button" onClick={() => void reviewViolation(v, 'suspended', false)}>Askıda tut</button>
                    <button className="btn primary" type="button" onClick={() => void reviewViolation(v, 'restored', true)}>Geri aç</button>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Kullanıcılar</h3><span>{cloud ? 'profiles' : 'Yerel yedek'}</span></div>
            <div className="field"><label>Ara</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad veya rol" /></div>
            {users.length ? users.map((u) => (
              <div className="plan-item" key={u.id}>
                <span><b>{u.name}</b><br /><small style={{ color: 'var(--muted)' }}>{u.id.slice(0, 8)}… • {u.kind} • {u.status}</small></span>
                <span>
                  <span className="chip">{u.status}</span>
                  {cloud && u.id !== user?.id ? (
                    <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => {
                      const next = u.pasif ? 'active' : 'pasif';
                      const q = next === 'pasif'
                        ? 'Bu hesabı askıya almak istiyor musun? Veriler silinmez; kişi giriş yapamaz ve koç listesinde görünmez.'
                        : 'Bu hesabı yeniden açmak istiyor musun?';
                      if (!confirm(q)) return;
                      void adminSetAccountStatus(u.id, next).then((res) => {
                        toast(res.ok ? (next === 'active' ? 'Hesap yeniden açıldı.' : 'Hesap askıya alındı.') : (res.error || 'İşlem yapılmadı.'));
                        refresh();
                      });
                    }}>{u.pasif ? 'Yeniden etkinleştir' : 'Hesabı askıya al'}</button>
                  ) : null}
                </span>
              </div>
            )) : <div className="empty">Kayıt yok veya SQL henüz uygulanmadı.</div>}
          </div>
        </>
      ) : null}

      {tab === 'basvuru' ? (
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

      {tab === 'basvuru' ? (
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
          <div className="section-title"><h3>Koç defteri</h3><span>Shopier cirosu değil</span></div>
          <p className="muted">Bu sekme koç ödemeleridir; Shopier üyelik tahsilatı Üyelik sekmesindedir. Komisyon %{localSnap.settings.commissionPct}.</p>
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

      {tab === 'basvuru' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Randevular</h3></div>
          <p className="muted">Yönetici görüşmeye katılmaz. Liste varsayılan olarak bugün. Katılma öğrenci veya koç hesabıyla Koçlar sayfasındadır.</p>
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
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={() => setApptDate(istanbulToday())}>Bugün</button>
            <button className="btn" type="button" onClick={() => setApptDate('')}>Tüm günler</button>
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
                {canDecideApprovedCancel(a, user?.id, { asCoachForThisAppt: false, isAdmin }) ? (
                  <>
                    <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => {
                      void decideApprovedAppointmentCancel(a.id, true).then((res) => {
                        toast(res.ok ? res.message : res.error);
                        refresh();
                      });
                    }}>İptali onayla</button>
                    <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => {
                      void decideApprovedAppointmentCancel(a.id, false).then((res) => {
                        toast(res.ok ? res.message : res.error);
                        refresh();
                      });
                    }}>Talebi reddet</button>
                  </>
                ) : null}
                {a.status === 'onay' && a.cancelDecision !== 'pending' ? (
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
          )) : <div className="empty">{apptDate ? `${apptDate} için randevu yok.` : 'Randevu yok.'}</div>}
        </div>
      ) : null}

      {tab === 'mesajlar' ? <AdminSupportPanel /> : null}
      {tab === 'denetim' ? (
        <SecurityInbox />
      ) : null}

      {tab === 'ayar' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Sistem</h3></div>
          <div className="status-grid">
            <div className="status"><b>Giriş</b><span>Sunucu yönetici / sahip kaydı</span></div>
            <div className="status"><b>Veri kaynağı</b><span>{loading ? 'yükleniyor' : (cloud ? 'sunucu' : 'yerel yedek')}</span></div>
          </div>
          <div className="section-title" style={{ marginTop: 16 }}><h3>Canlıya henüz işlenmeyen işler</h3></div>
          {SQL_DRAFTS.map((d) => (
            <div className="plan-item" key={d.id}>
              <span><b>{d.id} — {d.title}</b><br /><small className="muted">{d.file}</small></span>
              <span className="chip">{draftStatusLabel(d.status)}</span>
            </div>
          ))}
          <p className="muted">Askıya alma tuşu, 14 günlük deneme ve sınav görseli ancak ilgili SQL ve fonksiyon canlıdaysa gerçekten işler. Aksi halde hata mesajı görürsün; başarı yazılmaz.</p>
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

function SecurityInbox() {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!supabase) {
        if (alive) setErr('Bulut yok');
        return;
      }
      const { data, error } = await withTimeout(supabase.rpc('admin_security_inbox'));
      if (!alive) return;
      if (error) {
        setErr(/does not exist|schema cache/i.test(error.message) ? 'Güvenlik kuyruğu bu ortamda yok.' : 'Kuyruk okunamadı.');
        setRows([]);
        return;
      }
      setRows(Array.isArray(data) ? data as Record<string, unknown>[] : []);
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title"><h3>Görüşme Denetimi ve Güvenlik Merkezi</h3></div>
      <p className="muted">Yüksek risk insan incelemesine gider. Tek AI kararı hesap kapatmaz. Yönetici notları öğrenciye gitmez.</p>
      {err ? <p className="notice">{err}</p> : null}
      {rows && !rows.length ? <div className="empty">İnceleme kuyruğu boş.</div> : null}
      {(rows || []).map((r) => (
        <div className="plan-item" key={String(r.id)}>
          <span>
            {String(r.appointment_id)} • risk {String(r.risk_level)} • {String(r.analysis_status)}
            <br />
            <small className="muted">{String(r.rationale || '')} • eminlık {String(r.model_confidence)}</small>
          </span>
          <span className="chip">{String(r.analysis_version)}</span>
        </div>
      ))}
    </div>
  );
}
