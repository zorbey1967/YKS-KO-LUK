import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  COACH_TRACKS,
  clearCoachSession,
  emptyDesk,
  appointmentStatusLabel,
  type CoachDesk,
  type CoachHomework,
  type CoachSession,
  type CoachTrack,
  type HumanCoach,
} from '../lib/coaches';
import { accessMessage } from '../lib/accessGate';
import { canUseAi } from '../lib/subscription';
import { CoachApplyCard } from '../components/CoachApplyCard';
import { addCoachSlot, assignCoachHomework, closeCoachSlot, decideApprovedAppointmentCancel, fetchActiveCoaches, fetchCoachDesk, fetchCoachStudentBrief, fetchLinkedStudents, fetchMyCoach, listMySlots, listOpenSlots, requestAppointment, requestCancelApprovedAppointment, respondAppointment, runAppointmentJobs, setCoachHomeworkDone, type LinkedStudentRow } from '../lib/cloudPlatform';
import { CoachStudyBriefView } from '../components/CoachStudyBrief';
import type { CoachStudyBrief } from '../lib/coachBrief';
import { invalidateMyAppointments, istanbulToday, istanbulWallIso, listMyAppointments, nextBookSlot, splitAppointmentsBySlot, type MyAppointment } from '../lib/meeting';
import { SESSION_REQUIRED, supabase } from '../lib/supabase';
import { today } from '../lib/util';
import { MeetingJoinButton } from '../components/MeetingJoinButton';
import { canDecideApprovedCancel, canRequestApprovedCancel } from '../lib/appointmentCancelPolicy';
import { CoachZorroAssist } from '../components/CoachZorroAssist';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { coachesAudience, coachesView } from '../lib/coachesView';
import {
  createSchedulePdfSignedUrl,
  filterCoachSchedulePdfsForStudents,
  listCoachSchedulePdfSubmissions,
  type SchedulePdfSubmission,
} from '../lib/schedulePdfCloud';
import {
  createCoachProgramPdfSignedUrl,
  filterCoachProgramPdfsForStudents,
  listCoachUploadedProgramPdfs,
  uploadCoachProgramPdf,
  type CoachProgramPdf,
} from '../lib/coachProgramPdfCloud';
import { assertPdfFile } from '../lib/pdfStore';

type PanelTab = 'ozet' | 'ogrenci' | 'odev' | 'randevu' | 'musait';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function CoachesPage() {
  const { toast, go, user, profile, isAdmin, accessGate } = useApp();
  const [session, setSession] = useState<CoachSession | null>(null);
  const [desk, setDesk] = useState<CoachDesk>(() => emptyDesk());
  const [tab, setTab] = useState<PanelTab>('ozet');
  const [track, setTrack] = useState<CoachTrack | 'Tümü'>('Tümü');
  const [hwStudent, setHwStudent] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDue, setHwDue] = useState(today());
  const [linked, setLinked] = useState<LinkedStudentRow[]>([]);
  const [linkedMsg, setLinkedMsg] = useState('');
  const [bookCoach, setBookCoach] = useState<HumanCoach | null>(null);
  const [bookSlots, setBookSlots] = useState<{ id: string; date: string; time: string }[]>([]);
  const [bookSlotId, setBookSlotId] = useState('');
  const [bookSlotsMsg, setBookSlotsMsg] = useState('');
  const [slotDate, setSlotDate] = useState(() => nextBookSlot().date);
  const [slotHour, setSlotHour] = useState(() => nextBookSlot().time.slice(0, 2));
  const [slotMin, setSlotMin] = useState(() => nextBookSlot().time.slice(3, 5));
  const [mySlots, setMySlots] = useState<{ id: string; date: string; time: string; status: string }[]>([]);
  const [ownCoachId, setOwnCoachId] = useState<string | null>(null);
  const [showOldAppts, setShowOldAppts] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [wantApply, setWantApply] = useState(false);
  const briefReq = useRef('');

  const [list, setList] = useState<HumanCoach[]>([]);
  const [listError, setListError] = useState('');
  const [myAppts, setMyAppts] = useState<MyAppointment[]>([]);
  const [myApptsMsg, setMyApptsMsg] = useState('');
  const [cloudCoachId, setCloudCoachId] = useState<string | null>(null);
  const [listTick, setListTick] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [showOldSlots, setShowOldSlots] = useState(false);
  const [briefId, setBriefId] = useState('');
  const [brief, setBrief] = useState<CoachStudyBrief | null>(null);
  const [briefErr, setBriefErr] = useState('');
  const [planStudent, setPlanStudent] = useState('');
  const [programBusy, setProgramBusy] = useState(false);
  const [schedulePdfs, setSchedulePdfs] = useState<SchedulePdfSubmission[]>([]);
  const [coachProgramPdfs, setCoachProgramPdfs] = useState<CoachProgramPdf[]>([]);
  const coachUx = profile?.role === 'coach' || isAdmin;
  /** Koç modu seçili ama koç kaydı onaylı değil (beklemede / reddedildi / pasif). */
  const coachModeLocked = !isAdmin && profile?.role !== 'coach' && profile?.signup_intent === 'coach';
  const view = coachesView(coachesAudience({ signedIn: Boolean(user), role: profile?.role, isAdmin }));
  const studentSideAi = canUseAi(profile ? { ...profile, role: profile.base_role ?? 'student' } : null, isAdmin);

  useEffect(() => {
    const apply = () => {
      const q = location.hash.split('?')[1] || '';
      const params = new URLSearchParams(q);
      if (params.get('eski') === '1') {
        setTab('randevu');
        setShowOldAppts(true);
      }
      setWantApply(params.get('basvuru') === '1');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [session]);

  useEffect(() => {
    if (!user) {
      setListTick((n) => n + 1);
      return;
    }
    void runAppointmentJobs().then((res) => {
      if (!res.ok) toast(res.error);
      setListTick((n) => n + 1);
    });
  }, [user, toast]);

  useEffect(() => {
    let alive = true;
    void fetchActiveCoaches({ signedIn: Boolean(user) }).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setListError('');
        setList(res.coaches);
      } else {
        setList([]);
        setListError(res.error);
      }
    });
    return () => { alive = false; };
  }, [session, user]);

  useEffect(() => {
    if (!user) {
      setMyAppts([]);
      setMyApptsMsg('');
      setCloudCoachId(null);
      return;
    }
    let alive = true;
    void listMyAppointments(user.id, cloudCoachId).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setMyAppts(res.rows);
        setMyApptsMsg('');
      } else {
        setMyAppts([]);
        setMyApptsMsg(res.error === 'no-cloud' ? '' : res.error);
      }
    });
    return () => { alive = false; };
  }, [user, cloudCoachId, listTick]);

  useEffect(() => {
    if (!user) {
      setCloudCoachId(null);
      setSession(null);
      return;
    }
    let alive = true;
    void fetchMyCoach(user.id).then((mine) => {
      if (!alive) return;
      setOwnCoachId(mine?.id || null);
      if (!coachUx || !mine || mine.status !== 'active') {
        clearCoachSession();
        setSession(null);
        setCloudCoachId(null);
        return;
      }
      setCloudCoachId(mine.id);
      setSession({ coachId: mine.id, name: getCoachDisplayName(mine.name), email: mine.email, track: mine.track });
    });
    return () => { alive = false; };
  }, [user, coachUx]);

  useEffect(() => {
    if (!view.showCoachPanel || !session) {
      setSchedulePdfs([]);
      setCoachProgramPdfs([]);
      return;
    }
    let alive = true;
    const allowed = linked.map((s) => s.id);
    const mineOnly = <T extends { coach_id: string; student_id: string }>(rows: T[]) =>
      rows.filter((r) => r.coach_id === session.coachId && r.student_id !== user?.id);
    void listCoachSchedulePdfSubmissions().then((res) => {
      if (!alive || !res.ok) return;
      setSchedulePdfs(filterCoachSchedulePdfsForStudents(mineOnly(res.rows), allowed));
    });
    void listCoachUploadedProgramPdfs().then((res) => {
      if (!alive || !res.ok) return;
      setCoachProgramPdfs(filterCoachProgramPdfsForStudents(mineOnly(res.rows), allowed));
    });
    return () => { alive = false; };
  }, [view.showCoachPanel, session, linked, user?.id]);

  useEffect(() => {
    if (!session || !cloudCoachId) {
      setMySlots([]);
      return;
    }
    let alive = true;
    void listMySlots().then((res) => {
      if (!alive) return;
      if (!res.ok) {
        toast(res.error);
        setMySlots([]);
        return;
      }
      setMySlots(res.rows);
    });
    return () => { alive = false; };
  }, [session, cloudCoachId, listTick, tab, toast]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void fetchCoachDesk(session.coachId).then((d) => {
      if (!alive || !d) return;
      setDesk(d);
    });
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 20_000);
    return () => window.clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setLinked([]);
      setLinkedMsg('');
      return;
    }
    let alive = true;
    void fetchLinkedStudents().then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setLinked([]);
        setLinkedMsg(res.missing ? 'Bağlı öğrenci özeti yok. Randevusu olan öğrenci randevu listesinden görünür.' : res.error);
        return;
      }
      setLinkedMsg('');
      setLinked(res.rows);
    });
    return () => { alive = false; };
  }, [session, listTick]);

  const coaches = useMemo(() => {
    const others = list.filter((c) => c.id !== ownCoachId);
    return track === 'Tümü' ? others : others.filter((c) => c.track === track);
  }, [list, track, ownCoachId]);
  const allAppts = useMemo(() => {
    const map = new Map<string, MyAppointment>();
    for (const a of myAppts) map.set(a.id, a);
    const coachName = getCoachDisplayName(session?.name);
    for (const a of desk.appointments) {
      if (map.has(a.id)) continue;
      map.set(a.id, { ...a, coachName, startsAt: a.startsAt ?? null });
    }
    return [...map.values()];
  }, [myAppts, desk.appointments, session]);
  /** Koç panelinde yalnız koç olarak verilen dersler; öğrenci olarak alınanlar burada sayılmaz. */
  const coachAppts = useMemo(
    () => (session ? allAppts.filter((a) => a.coachId === session.coachId && a.studentId !== user?.id) : []),
    [allAppts, session, user?.id],
  );
  const studentAppts = useMemo(
    () => (user ? allAppts.filter((a) => a.studentId === user.id) : []),
    [allAppts, user],
  );
  const coachApptSplit = useMemo(() => splitAppointmentsBySlot(coachAppts), [coachAppts, nowTick]);
  const studentRows = useMemo(
    () => (linked.length ? linked : desk.students.filter((s) => s.id.length > 20)),
    [linked, desk.students],
  );
  const slotSplit = useMemo(
    () => splitAppointmentsBySlot(mySlots.map((s) => ({ ...s, minutes: 40 }))),
    [mySlots, nowTick],
  );
  const pendingAppts = useMemo(() => coachAppts.filter((a) => a.status === 'bekliyor'), [coachAppts]);
  const todayLessons = useMemo(
    () => coachAppts.filter((a) => a.date === istanbulToday() && a.status === 'onay'),
    [coachAppts],
  );

  /** Mod değişikliği yalnız girişte: çıkış yapılır, girişte "Öğrenci olarak gir" / "Koç olarak gir" seçilir. */
  async function signOutToLogin() {
    clearCoachSession();
    setSession(null);
    setDesk(emptyDesk());
    if (supabase) await supabase.auth.signOut({ scope: 'global' });
    toast('Çıkış yapıldı. Girişte öğrenci veya koç olarak seçebilirsin.');
    go('account');
  }

  function addHomework() {
    if (!hwStudent || !hwTitle.trim()) return toast('Öğrenci ve ödev başlığı gerekli.');
    void assignCoachHomework(hwStudent, hwTitle.trim(), hwDue).then((res) => {
      if (!res.ok) {
        toast(res.missing ? 'Ödev tablosu yok. Sahte ödev yazılmadı.' : res.error);
        return;
      }
      const item: CoachHomework = { id: res.id, studentId: hwStudent, title: hwTitle.trim(), due: hwDue, done: false };
      setDesk((d) => ({ ...d, homeworks: [item, ...d.homeworks] }));
      setHwTitle('');
      toast('Ödev öğrenci hesabına yazıldı.');
    });
  }

  async function applyCloudDesk(coachId: string) {
    const d = await fetchCoachDesk(coachId);
    if (!d) return false;
    setDesk(d);
    return true;
  }

  async function setAppt(id: string, accept: boolean) {
    const res = await respondAppointment(id, accept);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    if (session) await applyCloudDesk(session.coachId);
    if (user) {
      invalidateMyAppointments();
      const mine = await listMyAppointments(user.id, cloudCoachId);
      if (mine.ok) {
        setMyAppts(mine.rows);
        setMyApptsMsg('');
      }
    }
    setListTick((n) => n + 1);
    toast(res.message);
  }

  async function studentBook() {
    if (!bookCoach) return;
    if (!user) {
      toast('Randevu için Hesabım’dan giriş yap.');
      go('account');
      return;
    }
    const studentName = getPersonDisplayName(profile?.name, '');
    if (studentName.length < 2) return toast('Hesabında görünen ad yok. Kayıt adınla giriş yap.');
    if (!bookSlotId) return toast('Koçun açtığı bir saat seç.');
    if (bookBusy) return;
    setBookBusy(true);
    const res = await requestAppointment(bookSlotId);
    setBookBusy(false);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    setBookCoach(null);
    setBookSlotId('');
    invalidateMyAppointments();
    setListTick((n) => n + 1);
    toast('Talep gönderildi. Koç onaylamadan randevu kesinleşmez. Aynı saat için başka koça da talep gönderebilirsin; biri kabul edince diğerleri düşer.');
  }

  async function addMySlot() {
    if (!user) return toast(SESSION_REQUIRED);
    const iso = istanbulWallIso(slotDate, `${slotHour}:${slotMin}`);
    const res = await addCoachSlot(iso);
    if (!res.ok) return toast(res.error);
    toast('Müsait saat açıldı.');
    const slots = await listMySlots();
    if (!slots.ok) return toast(slots.error);
    setMySlots(slots.rows);
  }

  async function closeMySlot(id: string) {
    const res = await closeCoachSlot(id);
    if (!res.ok) return toast(res.error);
    toast('Saat kapatıldı.');
    setMySlots((prev) => prev.filter((s) => s.id !== id));
  }

  async function openBook(c: HumanCoach) {
    setBookCoach(c);
    setBookSlotId('');
    setBookSlots([]);
    setBookSlotsMsg('Saatler yükleniyor…');
    const res = await listOpenSlots(c.id);
    if (!res.ok) {
      setBookSlots([]);
      setBookSlotsMsg(res.error);
      return;
    }
    setBookSlots(res.rows);
    setBookSlotsMsg(res.rows.length ? '' : 'Bu koçun en az 30 dk sonrası için açık saati yok.');
  }

  const studentName = (id: string) =>
    linked.find((s) => s.id === id)?.name || desk.students.find((s) => s.id === id)?.name || 'Öğrenci';

  function apptRow(a: MyAppointment) {
    const asCoach = Boolean(session && a.coachId === (cloudCoachId || session.coachId));
    return (
      <div className="plan-item" key={a.id}>
        <span>
          {asCoach ? a.studentName : a.coachName} • {a.date} {a.time} ({a.minutes} dk)
          <br />
          <small className="muted">{appointmentStatusLabel(a, asCoach ? 'coach' : 'student')}</small>
        </span>
        {asCoach && a.status === 'bekliyor' ? (
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" type="button" onClick={() => void setAppt(a.id, true)}>Onayla</button>
            <button className="btn secondary" type="button" onClick={() => void setAppt(a.id, false)}>Reddet</button>
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {asCoach ? <span className="chip">{a.status}</span> : null}
            {canRequestApprovedCancel(a, user?.id, asCoach) ? (
              <button className="btn secondary" type="button" onClick={() => {
                void requestCancelApprovedAppointment(a.id).then((res) => {
                  toast(res.ok ? res.message : res.error);
                  if (user) { invalidateMyAppointments(); void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); }); }
                });
              }}>İptal talebi</button>
            ) : null}
            {canDecideApprovedCancel(a, user?.id, { asCoachForThisAppt: asCoach, isAdmin: false }) ? (
              <>
                <button className="btn primary" type="button" onClick={() => {
                  void decideApprovedAppointmentCancel(a.id, true).then((res) => {
                    toast(res.ok ? res.message : res.error);
                    if (user) { invalidateMyAppointments(); void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); }); }
                  });
                }}>İptali onayla</button>
                <button className="btn secondary" type="button" onClick={() => {
                  void decideApprovedAppointmentCancel(a.id, false).then((res) => {
                    toast(res.ok ? res.message : res.error);
                    if (user) { invalidateMyAppointments(); void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); }); }
                  });
                }}>Talebi reddet</button>
              </>
            ) : null}
            <MeetingJoinButton appt={a} userId={user?.id} coachId={cloudCoachId} now={Date.now()} />
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Koçluk</div>
        <h2>{session ? `Koçluk paneli • ${getCoachDisplayName(session.name)}` : 'Koçlar'}</h2>
        <p>
          {session
            ? 'Öğrencilerin, randevuların ve müsaitliklerin bu panelde.'
            : 'Yayınlanan koçlardan randevu al. Koç olmak için çıkış yapıp girişte “Koç olarak gir” seç.'}
        </p>
      </div>

      {coachModeLocked && user ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Koç paneli kapalı</h3></div>
            <p className="muted" style={{ marginTop: 0 }}>{accessMessage(accessGate) || 'Koç kaydın onaylı değil.'}</p>
            <p className="muted">Öğrenci tarafına geçmek için çıkış yapıp girişte “Öğrenci olarak gir” seç.</p>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => void signOutToLogin()}>Çıkış yap</button>
            </div>
          </div>
          {profile?.coach_status === 'rejected' ? <CoachApplyCard reapply /> : null}
        </>
      ) : null}

      {user && wantApply && !coachUx && !coachModeLocked && profile?.coach_status !== 'active' ? <CoachApplyCard /> : null}

      {view.showCoachLoginHint ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Koç paneli için{' '}
          <button className="btn secondary" type="button" onClick={() => go('account')}>Hesabım’dan giriş</button>
        </p>
      ) : null}

      {coachUx && user && !session ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">
            {isAdmin
              ? 'Koç paneli bu hesapta onaylı koç kaydı olunca açılır. Yönetici rolü koça dönüştürülmez.'
              : 'Koç kaydın yüklenemedi. Sayfayı yenile; sorun sürerse Hesabım’dan durumu kontrol et.'}
          </p>
        </div>
      ) : null}

      {view.showCoachPanel && session ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">
              <h3>Koç paneli</h3>
              <button className="btn" type="button" onClick={() => void signOutToLogin()}>Çıkış yap</button>
            </div>
            {studentSideAi ? (
              <CoachZorroAssist students={linked} homeworks={desk.homeworks} />
            ) : (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="section-title"><h3>ZORRO — Koç Asistanı</h3></div>
                <p className="muted" style={{ margin: 0 }}>
                  Koç Asistanı, hesabındaki Premium veya 14 günlük deneme ile çalışır. Öğrenci modunda Üyelik sayfasından açabilirsin.
                </p>
              </div>
            )}
            <div className="chip-row" style={{ marginBottom: 12 }}>
              {([['ozet', 'Özet'], ['ogrenci', 'Öğrenciler'], ['odev', 'Ödev'], ['randevu', 'Randevu'], ['musait', 'Boşum']] as const).map(([id, label]) => (
                <button key={id} className={`chip ${tab === id ? 'on' : ''}`} type="button" onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <div className="grid stats">
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Öğrenci</div><div className="value">{studentRows.length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Açık ödev</div><div className="value">{desk.homeworks.filter((h) => !h.done).length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Bekleyen talep</div><div className="value">{pendingAppts.length}</div></div>
            </div>
            {tab === 'ozet' ? (
              <div style={{ marginTop: 12 }}>
                <div className="section-title"><h3>Bugün</h3></div>
                {todayLessons.length ? todayLessons.map((a) => (
                  <div className="plan-item" key={a.id}>
                    <span>{a.time} • {a.studentName}<br /><small className="muted">{a.minutes} dk</small></span>
                    <MeetingJoinButton appt={a} userId={user?.id} coachId={cloudCoachId} now={Date.now()} />
                  </div>
                )) : <div className="empty">Bugün onaylı ders yok.</div>}
                {pendingAppts.length ? (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {pendingAppts.length} yeni talep.{' '}
                    <button className="btn secondary" type="button" onClick={() => setTab('randevu')}>Randevu sekmesi</button>
                  </p>
                ) : null}
              </div>
            ) : null}
            {tab === 'randevu' ? (
              <div style={{ marginTop: 12 }}>
                <div className="section-title"><h3>Talepler</h3></div>
                {pendingAppts.length ? pendingAppts.map((a) => apptRow(a)) : <div className="empty">Bekleyen talep yok.</div>}
                <div className="section-title" style={{ marginTop: 12 }}><h3>Yaklaşan dersler</h3></div>
                {[...coachApptSplit.current, ...coachApptSplit.upcoming].filter((a) => a.status === 'onay').length
                  ? [...coachApptSplit.current, ...coachApptSplit.upcoming].filter((a) => a.status === 'onay').map((a) => apptRow(a))
                  : <div className="empty">Yaklaşan onaylı ders yok.</div>}
                {coachApptSplit.past.length ? (
                  <div className="actions" style={{ marginTop: 12 }}>
                    <button className="btn secondary" type="button" onClick={() => setShowOldAppts((v) => !v)}>
                      {showOldAppts ? 'Eski randevuları gizle' : `Eski randevular (${coachApptSplit.past.length})`}
                    </button>
                  </div>
                ) : null}
                {showOldAppts ? coachApptSplit.past.map((a) => apptRow(a)) : null}
              </div>
            ) : null}
          </div>

          {tab === 'ozet' || tab === 'ogrenci' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Öğrencilerin</h3></div>
              <p className="muted">Liste randevu / eşleşmeden gelir. İsimle sahte öğrenci eklenmez.</p>
              {linkedMsg ? <p className="notice">{linkedMsg}</p> : null}
              {studentRows.length ? studentRows.map((s) => (
                <div className="plan-item" key={s.id}>
                  <span>
                    <b>{s.name}</b>
                    <br />
                    <small className="muted">
                      {('grade' in s && s.grade) ? s.grade : ''}
                      {'dept' in s && s.dept ? ` • ${s.dept}` : ''}
                      {'examDate' in s && s.examDate ? ` • sınav ${s.examDate}` : ''}
                      {'openTasks' in s ? ` • ${s.openTasks} açık görev` : ''}
                    </small>
                  </span>
                  <button className="btn secondary" type="button" onClick={() => {
                    setPlanStudent(s.id);
                    setBriefId(s.id);
                    setBrief(null);
                    setBriefErr('');
                    briefReq.current = s.id;
                    void fetchCoachStudentBrief(s.id, today()).then((res) => {
                      if (briefReq.current !== s.id) return;
                      if (!res.ok) {
                        setBriefErr(res.missing ? 'Öğrenci özeti şu an alınamadı.' : res.error);
                        return;
                      }
                      setBrief(res.brief);
                    });
                  }}>Özet</button>
                  <span className="chip">{desk.homeworks.filter((h) => h.studentId === s.id && !h.done).length} ödev</span>
                </div>
              )) : <div className="empty">Bağlı öğrenci yok (onaylı randevu veya eşleşme).</div>}
              {briefErr ? <p className="notice">{briefErr}</p> : null}
              {brief && briefId ? (
                <CoachStudyBriefView
                  brief={brief}
                  name={(linked.find((s) => s.id === briefId) || desk.students.find((s) => s.id === briefId))?.name || 'Öğrenci'}
                />
              ) : null}
              <div style={{ marginTop: 16 }}>
                <div className="section-title"><h3>Koçun Programı (PDF)</h3></div>
                <p className="muted">Öğrenci seç → Program Yükle. Haftalık editör yok; yalnızca PDF.</p>
                <div className="field">
                  <label>Öğrenci</label>
                  <select value={planStudent} onChange={(e) => setPlanStudent(e.target.value)}>
                    <option value="">Seç</option>
                    {studentRows.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="actions" style={{ marginTop: 8 }}>
                  <label className="btn primary" style={{ cursor: programBusy || !planStudent ? 'not-allowed' : 'pointer', opacity: programBusy || !planStudent ? 0.6 : 1 }}>
                    {programBusy ? 'Yükleniyor…' : 'Program Yükle'}
                    <input
                      type="file"
                      accept="application/pdf"
                      hidden
                      disabled={programBusy || !planStudent}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        e.target.value = '';
                        if (!f || !planStudent) return;
                        setProgramBusy(true);
                        void (async () => {
                          try {
                            assertPdfFile(f);
                            const res = await uploadCoachProgramPdf(planStudent, f);
                            if (!res.ok) {
                              toast(res.error);
                              return;
                            }
                            setCoachProgramPdfs((prev) => [res.row, ...prev.filter((r) => r.id !== res.row.id)]);
                            toast('Program PDF yüklendi');
                          } catch (err) {
                            toast(err instanceof Error ? err.message : 'PDF yüklenemedi');
                          } finally {
                            setProgramBusy(false);
                          }
                        })();
                      }}
                    />
                  </label>
                </div>
                {coachProgramPdfs.filter((r) => !planStudent || r.student_id === planStudent).length ? (
                  coachProgramPdfs.filter((r) => !planStudent || r.student_id === planStudent).map((r) => (
                    <div className="plan-item" key={r.id}>
                      <span>
                        <b>{r.student_name || 'Öğrenci'}</b>
                        <br />
                        <small className="muted">{r.file_name} · {new Date(r.created_at).toLocaleString('tr-TR')}</small>
                      </span>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => {
                          void createCoachProgramPdfSignedUrl(r.storage_path).then((url) => {
                            if (!url) {
                              toast('PDF açılamadı.');
                              return;
                            }
                            window.open(url, '_blank', 'noopener,noreferrer');
                          });
                        }}
                      >
                        Görüntüle
                      </button>
                    </div>
                  ))
                ) : <div className="empty">Yüklenmiş koç programı yok.</div>}
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="section-title"><h3>Öğrencinin Ders Programları</h3></div>
                <p className="muted">Yalnızca bağlı öğrencilerin gönderdiği PDF’ler.</p>
                {schedulePdfs.length ? schedulePdfs.map((r) => (
                  <div className="plan-item" key={r.id}>
                    <span>
                      <b>{r.student_name || 'Öğrenci'}</b>
                      <br />
                      <small className="muted">{r.file_name} · {new Date(r.created_at).toLocaleString('tr-TR')}</small>
                    </span>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => {
                        void createSchedulePdfSignedUrl(r.storage_path).then((url) => {
                          if (!url) {
                            toast('PDF açılamadı.');
                            return;
                          }
                          window.open(url, '_blank', 'noopener,noreferrer');
                        });
                      }}
                    >
                      PDF’yi aç
                    </button>
                  </div>
                )) : <div className="empty">Gönderilmiş ders programı yok.</div>}
              </div>
            </div>
          ) : null}

          {tab === 'ozet' || tab === 'odev' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Ödevlendir</h3></div>
              <div className="form-grid">
                <div className="field">
                  <label>Öğrenci</label>
                  <select value={hwStudent} onChange={(e) => setHwStudent(e.target.value)}>
                    <option value="">Seç</option>
                    {studentRows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Teslim</label><input type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Ödev</label><input value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="30 paragraf + yanlış analizi" /></div>
              </div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={addHomework}>Ödev ver</button>
              </div>
              {desk.homeworks.length ? desk.homeworks.map((h) => (
                <div className="plan-item" key={h.id}>
                  <span>
                    {h.done ? '☑' : '☐'} {h.title}
                    <br />
                    <small className="muted">{studentName(h.studentId)} • {h.due || 'tarih yok'} • {h.done ? 'Yapıldı' : 'Yapılmadı'}{h.updatedAt && h.createdAt && h.updatedAt !== h.createdAt ? ' • güncellendi' : ''}</small>
                  </span>
                  <button className="btn secondary" type="button" onClick={() => {
                    void setCoachHomeworkDone(h.id, !h.done).then((res) => {
                      if (!res.ok) return toast(res.error);
                      setDesk((d) => ({ ...d, homeworks: d.homeworks.map((x) => x.id === h.id ? { ...x, done: !x.done } : x) }));
                    });
                  }}>
                    {h.done ? 'Yapılmadı' : 'Yapıldı'}
                  </button>
                </div>
              )) : <div className="empty">Ödev yok.</div>}
            </div>
          ) : null}

          {tab === 'ozet' || tab === 'musait' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Boşum / Müsaitlik</h3><span>Türkiye saati</span></div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Öğrenci yalnız burada açtığın 40 dk’lık saatlerden seçer. Saat en az 30 dk sonra olmalı. Onaylı ders sessiz silinmez.</p>
              <div className="form-grid">
                <div className="field"><label>Tarih</label><input type="date" min={istanbulToday()} value={slotDate} onChange={(e) => setSlotDate(e.target.value)} /></div>
                <div className="field">
                  <label>Saat</label>
                  <select value={slotHour} onChange={(e) => setSlotHour(e.target.value)}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Dakika</label>
                  <select value={slotMin} onChange={(e) => setSlotMin(e.target.value)}>
                    {MINS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => void addMySlot()}>Saat aç</button>
              </div>
              {[...slotSplit.current, ...slotSplit.upcoming].length ? [...slotSplit.current, ...slotSplit.upcoming].map((s) => (
                <div className="plan-item" key={s.id}>
                  <span>{s.date} {s.time} • 40 dk<br /><small style={{ color: 'var(--muted)' }}>{s.status === 'open' ? 'Açık' : s.status === 'held' ? 'Talep var' : 'Onaylı'}</small></span>
                  {s.status === 'booked' ? <span className="chip">kilitli</span> : (
                    <button className="btn secondary" type="button" onClick={() => void closeMySlot(s.id)}>Kapat</button>
                  )}
                </div>
              )) : <div className="empty">Yaklaşan açık saat yok.</div>}
              {slotSplit.past.length ? (
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn secondary" type="button" onClick={() => setShowOldSlots((v) => !v)}>
                    {showOldSlots ? 'Eski saatleri gizle' : `Eski saatler (${slotSplit.past.length})`}
                  </button>
                </div>
              ) : null}
              {showOldSlots ? slotSplit.past.map((s) => (
                <div className="plan-item" key={s.id}>
                  <span>{s.date} {s.time} • 40 dk<br /><small style={{ color: 'var(--muted)' }}>{s.status === 'open' ? 'Açık' : s.status === 'held' ? 'Talep var' : 'Onaylı'}</small></span>
                  {s.status === 'booked' ? <span className="chip">kilitli</span> : (
                    <button className="btn secondary" type="button" onClick={() => void closeMySlot(s.id)}>Kapat</button>
                  )}
                </div>
              )) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {view.showDirectory && !coachModeLocked ? (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Randevu al</h3><span>Koçlar</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Koçun açtığı saatlerden seç. Son talep, dersten 30 dk önce kapanır. Saatler Türkiye.</p>
        {listError ? <div className="notice" style={{ marginBottom: 12 }} role="alert">{listError}</div> : null}
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${track === 'Tümü' ? 'on' : ''}`} type="button" onClick={() => setTrack('Tümü')}>Tümü</button>
          {COACH_TRACKS.map((t) => (
            <button key={t} className={`chip ${track === t ? 'on' : ''}`} type="button" onClick={() => setTrack(t)}>{t}</button>
          ))}
        </div>
        <div className="grid two">
          {!listError && !coaches.length ? <div className="empty" style={{ gridColumn: '1 / -1' }}>Onaylı koç yok.</div> : null}
          {coaches.map((c) => (
            <div className="coach-card" key={c.id}>
              <div className="subject">
                <div className="subject-icon" style={{ overflow: 'hidden', padding: 0 }}>
                  {c.photo
                    ? <img className="coach-photo" src={c.photo} alt="" width={42} height={42} />
                    : getCoachDisplayName(c.name).charAt(0)}
                </div>
                <div>
                  <b>{getCoachDisplayName(c.name)}</b>
                  <div><span className="chip">Koç</span> <span className="chip">{c.track}</span></div>
                </div>
              </div>
              <p className="muted">{c.focus}</p>
              <div className="plan-item"><span>Süre</span><b>40 dk</b></div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => void openBook(c)}>Randevu al</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {!session && !coachModeLocked ? (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Randevularım</h3><span>Görüşme</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Geçmiş randevular listede kalır. Katılma, başlangıçtan 20 dk önce açılır ve ders bitiminden 15 dk sonra kapanır. Sayaç, iki taraf da odadayken 40 dk başlar. Kayıt yok.</p>
        {!user ? (
          <div className="empty">
            Görüşmeleri görmek için giriş yap.
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={() => go('account')}>Giriş</button>
            </div>
          </div>
        ) : myApptsMsg && !studentAppts.length ? (
          <div className="notice">{myApptsMsg}</div>
        ) : studentAppts.length ? (
          studentAppts.map((a) => apptRow(a))
        ) : (
          <div className="empty">Henüz randevun yok.</div>
        )}
      </div>
      ) : null}

      {bookCoach && view.showDirectory && !coachModeLocked ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Randevu • ${getCoachDisplayName(bookCoach.name)}`} onClick={() => setBookCoach(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">
              <h3>Randevu • {getCoachDisplayName(bookCoach.name)}</h3>
              <button className="btn secondary" type="button" onClick={() => setBookCoach(null)}>Kapat</button>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Adın</label><input value={getPersonDisplayName(profile?.name, 'Öğrenci')} readOnly /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Açık saat (Türkiye, 30 dk kuralı)</label>
                <select value={bookSlotId} onChange={(e) => setBookSlotId(e.target.value)}>
                  <option value="">Seç</option>
                  {bookSlots.map((s) => (
                    <option key={s.id} value={s.id}>{s.date} {s.time}</option>
                  ))}
                </select>
              </div>
            </div>
            {bookSlotsMsg ? <p className="muted" style={{ margin: '8px 0 0' }}>{bookSlotsMsg}</p> : (
              <p className="muted" style={{ margin: '8px 0 0' }}>Onaylanmayan talepler süre sonunda düşer.</p>
            )}
            <div className="actions">
              <button className="btn primary" type="button" disabled={!bookSlotId || bookBusy} onClick={() => void studentBook()}>{bookBusy ? 'Gönderiliyor…' : 'Talep gönder'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
