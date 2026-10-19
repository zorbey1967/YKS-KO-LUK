import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  COACH_TRACKS,
  clearCoachSession,
  emptyDesk,
  formatTry,
  loadCoachDesk,
  monthPayments,
  saveCoachDesk,
  saveCoachSession,
  appointmentStatusLabel,
  type CoachDesk,
  type CoachHomework,
  type CoachSession,
  type CoachTrack,
  type HumanCoach,
} from '../lib/coaches';
import { addCoachSlot, assignCoachHomework, closeCoachSlot, decideApprovedAppointmentCancel, fetchActiveCoaches, fetchCoachDesk, fetchCoachStudentBrief, fetchLinkedStudents, fetchMyCoach, listMySlots, listOpenSlots, requestAppointment, requestCancelApprovedAppointment, respondAppointment, runAppointmentJobs, setCoachHomeworkDone, type LinkedStudentRow } from '../lib/cloudPlatform';
import { CoachStudyBriefView } from '../components/CoachStudyBrief';
import type { CoachStudyBrief } from '../lib/coachBrief';
import { istanbulToday, istanbulWallIso, listMyAppointments, nextBookSlot, splitAppointmentsBySlot, type MyAppointment } from '../lib/meeting';
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

type PanelTab = 'ozet' | 'ogrenci' | 'odev' | 'para' | 'randevu' | 'musait' | 'oda';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function CoachesPage() {
  const { toast, go, user, profile, isAdmin } = useApp();
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
  const [coachScore, setCoachScore] = useState<number | null>(null);

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
  const view = coachesView(coachesAudience({ signedIn: Boolean(user), role: profile?.role, isAdmin }));

  useEffect(() => {
    const apply = () => {
      const q = location.hash.split('?')[1] || '';
      if (new URLSearchParams(q).get('eski') === '1') {
        setTab('randevu');
      }
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
    void runAppointmentJobs().then(async (res) => {
      if (!res.ok) toast(res.error);
      if (session) {
        const d = await fetchCoachDesk(session.coachId);
        if (d) {
          const local = loadCoachDesk(session.coachId);
          const merged = {
            ...d,
            homeworks: d.homeworks,
            payments: d.payments.length ? d.payments : local.payments,
          };
          setDesk(merged);
          saveCoachDesk(session.coachId, merged);
        }
      }
      setListTick((n) => n + 1);
    });
  }, [user, session, toast]);

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
      if (!coachUx || !mine || mine.status !== 'active') {
        clearCoachSession();
        setSession(null);
        setCloudCoachId(null);
        setCoachScore(null);
        return;
      }
      setCloudCoachId(mine.id);
      setCoachScore(typeof mine.score === 'number' ? mine.score : null);
      const sess: CoachSession = { coachId: mine.id, name: getCoachDisplayName(mine.name), email: mine.email, track: mine.track };
      saveCoachSession(sess);
      setSession(sess);
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
    const allowed = (linked.length ? linked : desk.students).map((s) => s.id);
    void listCoachSchedulePdfSubmissions().then((res) => {
      if (!alive || !res.ok) return;
      setSchedulePdfs(allowed.length ? filterCoachSchedulePdfsForStudents(res.rows, allowed) : res.rows);
    });
    void listCoachUploadedProgramPdfs().then((res) => {
      if (!alive || !res.ok) return;
      setCoachProgramPdfs(allowed.length ? filterCoachProgramPdfsForStudents(res.rows, allowed) : res.rows);
    });
    return () => { alive = false; };
  }, [view.showCoachPanel, session, linked, desk.students]);

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
      const local = loadCoachDesk(session.coachId);
      const merged = {
        ...d,
        homeworks: d.homeworks,
        payments: d.payments.length ? d.payments : local.payments,
      };
      setDesk(merged);
      saveCoachDesk(session.coachId, merged);
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

  const coaches = useMemo(() => (track === 'Tümü' ? list : list.filter((c) => c.track === track)), [list, track]);
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
  const slotSplit = useMemo(
    () => splitAppointmentsBySlot(mySlots.map((s) => ({ ...s, minutes: 40 }))),
    [mySlots, nowTick],
  );
  const pendingAppts = useMemo(() => allAppts.filter((a) => a.status === 'bekliyor'), [allAppts]);
  const todayLessons = useMemo(
    () => allAppts.filter((a) => a.date === istanbulToday() && a.status === 'onay'),
    [allAppts],
  );

  async function onLogout() {
    const mine = user ? await fetchMyCoach(user.id) : null;
    clearCoachSession();
    setSession(null);
    setDesk({ students: [], homeworks: [], payments: [], appointments: [] });
    if (mine && supabase) await supabase.auth.signOut();
    toast('Koç paneli kapandı.');
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
    const local = loadCoachDesk(coachId);
    const merged = {
      ...d,
      homeworks: d.homeworks,
      payments: d.payments.length ? d.payments : local.payments,
    };
    setDesk(merged);
    saveCoachDesk(coachId, merged);
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
    const res = await requestAppointment(bookSlotId);
    setBookCoach(null);
    setBookSlotId('');
    toast(res.ok
      ? 'Talep gönderildi. Koç onaylamadan randevu kesinleşmez. Aynı saat için başka koça da talep gönderebilirsin; biri kabul edince diğerleri düşer.'
      : res.error);
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

  const monthTotal = monthPayments(desk);
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
          {user && a.studentId === user.id && a.cancelReason === 'student_no_show' ? (
            <>
              <br />
              <small className="muted">Kalan puanın: {profile?.score ?? '—'}. Detay Hesabım’da.</small>
            </>
          ) : null}
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
                  if (user) void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); });
                });
              }}>İptal talebi</button>
            ) : null}
            {canDecideApprovedCancel(a, user?.id, { asCoachForThisAppt: asCoach, isAdmin: false }) ? (
              <>
                <button className="btn primary" type="button" onClick={() => {
                  void decideApprovedAppointmentCancel(a.id, true).then((res) => {
                    toast(res.ok ? res.message : res.error);
                    if (user) void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); });
                  });
                }}>İptali onayla</button>
                <button className="btn secondary" type="button" onClick={() => {
                  void decideApprovedAppointmentCancel(a.id, false).then((res) => {
                    toast(res.ok ? res.message : res.error);
                    if (user) void listMyAppointments(user.id, cloudCoachId).then((r) => { if (r.ok) setMyAppts(r.rows); });
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
            : 'Yayınlanan koçlardan randevu al. Koç olmak için Hesabım’dan kayıt ol.'}
        </p>
      </div>

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
              ? 'Koç paneli bu hesapta coaches satırı olunca açılır. Yönetici rolü koça dönüştürülmez.'
              : 'Koç kaydın henüz yok veya onay bekliyor. Panel, yönetici onayından sonra açılır.'}
          </p>
        </div>
      ) : null}

      {view.showCoachPanel && session ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">
              <h3>Koç paneli</h3>
              <button className="btn" type="button" onClick={onLogout}>Çıkış</button>
            </div>
            <CoachZorroAssist students={linked} homeworks={desk.homeworks} />
            <div className="chip-row" style={{ marginBottom: 12 }}>
              {([['ozet', 'Özet'], ['ogrenci', 'Öğrenciler'], ['odev', 'Ödev'], ['para', 'Tahsilat'], ['randevu', 'Randevu'], ['musait', 'Boşum'], ['oda', 'Çalışma odası']] as const).map(([id, label]) => (
                <button key={id} className={`chip ${tab === id ? 'on' : ''}`} type="button" onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <div className="grid stats">
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Öğrenci</div><div className="value">{desk.students.length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Açık ödev</div><div className="value">{desk.homeworks.filter((h) => !h.done).length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Bekleyen talep</div><div className="value">{pendingAppts.length}</div></div>
              {coachScore != null ? <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Puan</div><div className="value">{coachScore}</div></div> : null}
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
                  <p className="muted" style={{ marginBottom: 0 }}>{pendingAppts.length} yeni talep Randevu sekmesinde.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {tab === 'ozet' || tab === 'ogrenci' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Öğrencilerin</h3></div>
              <p className="muted">Liste randevu / eşleşmeden gelir. İsimle sahte öğrenci eklenmez.</p>
              {linkedMsg ? <p className="notice">{linkedMsg}</p> : null}
              {(linked.length ? linked : desk.students.filter((s) => s.id.length > 20)).length ? (linked.length ? linked : desk.students).map((s) => (
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
                    void fetchCoachStudentBrief(s.id, today()).then((res) => {
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
                    {(linked.length ? linked : desk.students).map((s) => (
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
                    {desk.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    {linked.filter((s) => !desk.students.some((d) => d.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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

          {tab === 'ozet' || tab === 'para' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Öğrencilerden tahsilat</h3><span>Bu ay {formatTry(monthTotal)}</span></div>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Kart çekilmez; kayıt defteri. Gerçek ödeme sonraki faz.</p>
              {desk.payments.length ? desk.payments.map((p) => (
                <div className="plan-item" key={p.id}>
                  <span>{studentName(p.studentId)} • {p.note}<br /><small style={{ color: 'var(--muted)' }}>{p.date}</small></span>
                  <b>{formatTry(p.amount)}</b>
                </div>
              )) : <div className="empty">Kayıt yok.</div>}
              <div className="plan-item"><span>Toplam</span><b>{formatTry(desk.payments.reduce((a, p) => a + p.amount, 0))}</b></div>
            </div>
          ) : null}

          {tab === 'oda' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Özel çalışma odası</h3></div>
              <p className="muted">Varsayılan sessiz. Mikrofon kapalı. Sesli modu yalnız koç açar. Kamera isteğe bağlı ve henüz LiveKit oda token’ına bağlı değil. Yalnız eşleşmiş öğrenciler.</p>
              {(linked.length ? linked : desk.students).map((s) => (
                <div className="plan-item" key={s.id}>
                  <span>{s.name}</span>
                  <button className="btn secondary" type="button" onClick={() => {
                    void (async () => {
                      if (!supabase) return;
                      const { error } = await supabase.rpc('coach_kick_student', { p_student: s.id });
                      toast(error ? 'Çıkarma işlemi yok veya yetkin yok.' : 'Öğrenci odadan çıkarıldı.');
                    })();
                  }}>Odadan çıkar</button>
                </div>
              ))}
              {!(linked.length || desk.students.length) ? <div className="empty">Atanmış öğrenci yok.</div> : null}
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
              {slotSplit.current.length ? slotSplit.current.map((s) => (
                <div className="plan-item" key={s.id}>
                  <span>{s.date} {s.time} • 40 dk<br /><small style={{ color: 'var(--muted)' }}>{s.status === 'open' ? 'Açık' : s.status === 'held' ? 'Talep var' : 'Onaylı'}</small></span>
                  {s.status === 'booked' ? <span className="chip">kilitli</span> : (
                    <button className="btn secondary" type="button" onClick={() => void closeMySlot(s.id)}>Kapat</button>
                  )}
                </div>
              )) : <div className="empty">{mySlots.length ? 'Bu saat için açık slot yok.' : 'Açık saat yok.'}</div>}
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

      {view.showDirectory ? (
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Randevularım</h3><span>Görüşme</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Geçmiş randevular listede kalır. Katılma, başlangıçtan 24 saat sonra kapanır. Sayaç, iki taraf da odadayken 40 dk başlar. Kayıt yok.</p>
        {!user ? (
          <div className="empty">
            Görüşmeleri görmek için giriş yap.
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={() => go('account')}>Giriş</button>
            </div>
          </div>
        ) : myApptsMsg && !allAppts.length ? (
          <div className="notice">{myApptsMsg}</div>
        ) : allAppts.length ? (
          allAppts.map((a) => apptRow(a))
        ) : (
          <div className="empty">Bulutta randevu yok.</div>
        )}
      </div>

      {bookCoach && view.showDirectory ? (
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
              <button className="btn primary" type="button" disabled={!bookSlotId} onClick={() => void studentBook()}>Talep gönder</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
