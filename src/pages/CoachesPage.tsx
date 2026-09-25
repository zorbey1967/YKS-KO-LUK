import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  COACH_TRACKS,
  clearCoachSession,
  formatTry,
  loadCoachDesk,
  loadCoachSession,
  loginCoach,
  monthPayments,
  saveCoachDesk,
  saveCoachSession,
  type AppointmentStatus,
  type CoachAppointment,
  type CoachDesk,
  type CoachHomework,
  type CoachSession,
  type CoachTrack,
  type HumanCoach,
} from '../lib/coaches';
import { fetchActiveCoaches, fetchCoachDesk, fetchMyCoach, insertAppointment, pushCoachDesk, updateAppointmentStatus } from '../lib/cloudPlatform';
import { appointmentStartMs, isAppointmentParty, istanbulToday, joinReasonLabel, joinWindow, listMyAppointments, nextBookSlot, openMeeting, type MyAppointment } from '../lib/meeting';
import { supabase, withTimeout } from '../lib/supabase';
import { today, uid } from '../lib/util';

type PanelTab = 'ozet' | 'ogrenci' | 'odev' | 'para' | 'randevu';

function MeetingJoinButton({
  appt,
  userId,
  coachId,
}: {
  appt: Pick<CoachAppointment, 'id' | 'date' | 'time' | 'minutes' | 'status' | 'studentId' | 'coachId'>;
  userId?: string | null;
  coachId?: string | null;
}) {
  const w = joinWindow(appt);
  if (!isAppointmentParty(appt, userId, coachId)) return null;
  if (!appt.id || appt.status !== 'onay') return null;
  return (
    <button
      className="btn secondary"
      type="button"
      disabled={!w.can}
      title={joinReasonLabel(w.reason)}
      onClick={() => openMeeting(appt.id)}
    >
      Görüşmeye Katıl
    </button>
  );
}

export function CoachesPage() {
  const { toast, go, user, profile } = useApp();
  const [session, setSession] = useState<CoachSession | null>(null);
  const [desk, setDesk] = useState<CoachDesk>(() => (loadCoachSession() ? loadCoachDesk(loadCoachSession()!.coachId) : { students: [], homeworks: [], payments: [], appointments: [] }));
  const [tab, setTab] = useState<PanelTab>('ozet');
  const [track, setTrack] = useState<CoachTrack | 'Tümü'>('Tümü');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [hwStudent, setHwStudent] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDue, setHwDue] = useState(today());
  const [stName, setStName] = useState('');
  const [stGrade, setStGrade] = useState('');
  const [bookCoach, setBookCoach] = useState<HumanCoach | null>(null);
  const [bookName, setBookName] = useState('');
  const [bookDate, setBookDate] = useState(() => nextBookSlot().date);
  const [bookTime, setBookTime] = useState(() => nextBookSlot().time);

  const [list, setList] = useState<HumanCoach[]>([]);
  const [listError, setListError] = useState('');
  const [myAppts, setMyAppts] = useState<MyAppointment[]>([]);
  const [myApptsMsg, setMyApptsMsg] = useState('');
  const [cloudCoachId, setCloudCoachId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchActiveCoaches().then((res) => {
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
  }, [session]);

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
  }, [user, cloudCoachId, desk.appointments.length]);

  useEffect(() => {
    if (!user) {
      setCloudCoachId(null);
      setSession(loadCoachSession());
      return;
    }
    let alive = true;
    void fetchMyCoach(user.id).then((mine) => {
      if (!alive) return;
      if (!mine || mine.status === 'rejected' || mine.status === 'pasif') {
        clearCoachSession();
        setSession(null);
        setCloudCoachId(null);
        return;
      }
      setCloudCoachId(mine.status === 'active' ? mine.id : null);
      const sess: CoachSession = { coachId: mine.id, name: mine.name, email: mine.email, track: mine.track };
      saveCoachSession(sess);
      setSession(sess);
    });
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void fetchCoachDesk(session.coachId).then((d) => {
      if (!alive || !d) return;
      const local = loadCoachDesk(session.coachId);
      const merged = {
        ...d,
        homeworks: d.homeworks.length ? d.homeworks : local.homeworks,
        payments: d.payments.length ? d.payments : local.payments,
      };
      setDesk(merged);
      saveCoachDesk(session.coachId, merged);
    });
    return () => { alive = false; };
  }, [session]);

  const coaches = useMemo(() => (track === 'Tümü' ? list : list.filter((c) => c.track === track)), [list, track]);

  function persist(next: CoachDesk) {
    if (!session) return;
    setDesk(next);
    saveCoachDesk(session.coachId, next);
    void pushCoachDesk(session.coachId, next);
  }

  async function onLogin() {
    if (supabase && email && password) {
      try {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (!error) {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id;
          const mine = uid ? await fetchMyCoach(uid) : null;
          if (mine && (mine.status === 'rejected' || mine.status === 'pasif')) {
            setAuthMsg('Bu koç hesabı kapalı.');
            return;
          }
          if (mine) {
            const cloudDesk = await fetchCoachDesk(mine.id);
            const sess: CoachSession = { coachId: mine.id, name: mine.name, email: mine.email, track: mine.track };
            saveCoachSession(sess);
            setSession(sess);
            const local = loadCoachDesk(mine.id);
            const merged = cloudDesk
              ? { ...cloudDesk, homeworks: cloudDesk.homeworks.length ? cloudDesk.homeworks : local.homeworks, payments: cloudDesk.payments.length ? cloudDesk.payments : local.payments }
              : local;
            setDesk(merged);
            saveCoachDesk(mine.id, merged);
            setPassword('');
            setAuthMsg(mine.status === 'pending' ? 'Başvurun incelemede; panel açık.' : '');
            toast('Koç girişi yapıldı.');
            return;
          }
          setAuthMsg('Bu hesap koç değil. Koç kaydı Hesabım’dan yapılır.');
          return;
        }
      } catch {
        /* yerel giriş */
      }
    }
    const res = loginCoach(email, password);
    if (!res.ok) {
      setAuthMsg(res.error);
      return;
    }
    setSession(res.session);
    setDesk(loadCoachDesk(res.session.coachId));
    setPassword('');
    setAuthMsg('');
    toast('Koç girişi yapıldı.');
  }

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
    const item: CoachHomework = { id: uid('hw_'), studentId: hwStudent, title: hwTitle.trim(), due: hwDue, done: false };
    persist({ ...desk, homeworks: [item, ...desk.homeworks] });
    setHwTitle('');
    toast('Ödev atandı.');
  }

  function addStudent() {
    if (stName.trim().length < 2) return toast('Öğrenci adı gerekli.');
    persist({
      ...desk,
      students: [{ id: uid('st_'), name: stName.trim(), grade: stGrade.trim() || '—', note: '' }, ...desk.students],
    });
    setStName('');
    toast('Öğrenci eklendi.');
  }

  function setAppt(id: string, status: AppointmentStatus) {
    persist({
      ...desk,
      appointments: desk.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
    });
    void updateAppointmentStatus(id, status);
    toast(status === 'onay' ? 'Randevu onaylandı.' : 'Randevu iptal.');
  }

  async function studentBook() {
    if (!bookCoach) return;
    if (!user) {
      toast('Randevu için Hesabım’dan giriş yap.');
      go('account');
      return;
    }
    const studentName = (bookName.trim() || profile?.name || '').trim();
    if (studentName.length < 2) return toast('Adını yaz.');
    const start = appointmentStartMs(bookDate, bookTime);
    if (Number.isNaN(start) || start < Date.now() - 60_000) {
      return toast('Saat geçmiş. Türkiye saatiyle ileri bir saat seç.');
    }
    const appt: CoachAppointment = {
      id: uid('ap_'),
      coachId: bookCoach.id,
      studentId: user.id,
      studentName,
      date: bookDate,
      time: bookTime,
      minutes: 40,
      status: 'bekliyor',
    };
    const current = loadCoachDesk(bookCoach.id);
    saveCoachDesk(bookCoach.id, { ...current, appointments: [appt, ...current.appointments] });
    const cloudOk = await insertAppointment(appt, user.id);
    if (session?.coachId === bookCoach.id) setDesk(loadCoachDesk(bookCoach.id));
    setBookCoach(null);
    setBookName('');
    toast(cloudOk
      ? 'Randevu talebi gönderildi. Ödeme yok; koç panelinden onaylanır.'
      : 'Randevu buluta yazılamadı. Giriş ve onaylı koç gerekir.');
  }

  const monthTotal = monthPayments(desk);
  const studentName = (id: string) => desk.students.find((s) => s.id === id)?.name || 'Öğrenci';

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Koç listesi ve panel</div>
        <h2>{session ? `Koç paneli • ${session.name}` : 'Koçlar'}</h2>
        <p>
          {session
            ? 'Bu ekranı yalnızca koç oturumu görür: öğrenciler, ödev, tahsilat, randevu.'
            : 'Koç olmak Hesabım’da kayıt olurken “Koç” seçmekle olur. Burada giriş, randevu ve yayınlanan koçlar var.'}
        </p>
      </div>

      {!session ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title">
            <h3>Koç girişi</h3>
            <button className="btn secondary" type="button" onClick={() => go('account')}>Koç olmak</button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Kayıt Hesabım’dadır (branş, öğrenci sayısı, fotoğraf). Panel için aynı e-posta ile gir.</p>
          <div className="form-grid">
            <div className="field"><label>E-posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="koc@mail.com" /></div>
            <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </div>
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => void onLogin()}>Koç paneline gir</button>
          </div>
          {authMsg ? <div className="notice" style={{ marginTop: 12 }}>{authMsg}</div> : null}
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">
              <h3>Koç paneli</h3>
              <button className="btn" type="button" onClick={onLogout}>Çıkış</button>
            </div>
            <div className="chip-row" style={{ marginBottom: 12 }}>
              {([['ozet', 'Özet'], ['ogrenci', 'Öğrenciler'], ['odev', 'Ödev'], ['para', 'Tahsilat'], ['randevu', 'Randevu']] as const).map(([id, label]) => (
                <button key={id} className={`chip ${tab === id ? 'on' : ''}`} type="button" onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <div className="grid stats">
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Öğrenci</div><div className="value">{desk.students.length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Açık ödev</div><div className="value">{desk.homeworks.filter((h) => !h.done).length}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Bu ay</div><div className="value" style={{ fontSize: 20 }}>{formatTry(monthTotal)}</div></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><div className="label">Bekleyen randevu</div><div className="value">{desk.appointments.filter((a) => a.status === 'bekliyor').length}</div></div>
            </div>
          </div>

          {tab === 'ozet' || tab === 'ogrenci' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Öğrencilerin</h3></div>
              <div className="form-grid">
                <div className="field"><label>Ad</label><input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="Öğrenci adı" /></div>
                <div className="field"><label>Sınıf</label><input value={stGrade} onChange={(e) => setStGrade(e.target.value)} placeholder="belirtilmedi" /></div>
              </div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={addStudent}>Öğrenci ekle</button>
              </div>
              {desk.students.length ? desk.students.map((s) => (
                <div className="plan-item" key={s.id}>
                  <span><b>{s.name}</b><br /><small style={{ color: 'var(--muted)' }}>{s.grade} • {s.note}</small></span>
                  <span className="chip">{desk.homeworks.filter((h) => h.studentId === s.id && !h.done).length} ödev</span>
                </div>
              )) : <div className="empty">Öğrenci yok.</div>}
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
                  </select>
                </div>
                <div className="field"><label>Teslim</label><input type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Ödev</label><input value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="30 paragraf + yanlış analizi" /></div>
              </div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={addHomework}>Ödev ver</button>
              </div>
              {desk.homeworks.map((h) => (
                <div className="plan-item" key={h.id}>
                  <span>
                    {h.title}
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{studentName(h.studentId)} • {h.due}</small>
                  </span>
                  <button className="btn secondary" type="button" onClick={() => persist({ ...desk, homeworks: desk.homeworks.map((x) => x.id === h.id ? { ...x, done: !x.done } : x) })}>
                    {h.done ? 'Aç' : 'Tamam'}
                  </button>
                </div>
              ))}
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

          {tab === 'ozet' || tab === 'randevu' ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title"><h3>Randevular</h3></div>
              {desk.appointments.length ? desk.appointments.map((a) => (
                <div className="plan-item" key={a.id}>
                  <span>
                    {a.studentName} • {a.date} {a.time} ({a.minutes} dk)
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{a.status === 'bekliyor' ? 'Onay bekliyor' : a.status === 'onay' ? 'Onaylı' : a.status === 'tamamlandi' ? 'Tamamlandı' : 'İptal'}</small>
                  </span>
                  {a.status === 'bekliyor' ? (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button className="btn primary" type="button" onClick={() => setAppt(a.id, 'onay')}>Onayla</button>
                      <button className="btn secondary" type="button" onClick={() => setAppt(a.id, 'iptal')}>Reddet</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="chip">{a.status}</span>
                      <MeetingJoinButton appt={a} userId={user?.id} coachId={cloudCoachId} />
                    </span>
                  )}
                </div>
              )) : <div className="empty">Randevu yok.</div>}
            </div>
          ) : null}
        </>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Randevularım</h3><span>Görüşme</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Onaylı randevuda, saatten 10 dk önce / süre + 15 dk içinde odaya girilir. Kayıt yok. Yerel koç oturumu yetmez; Hesabım girişi gerekir.</p>
        {!user ? (
          <div className="empty">Görüşme listesi için giriş yap.</div>
        ) : myApptsMsg ? (
          <div className="notice">{myApptsMsg}</div>
        ) : myAppts.length ? myAppts.map((a) => (
          <div className="plan-item" key={a.id}>
            <span>
              {a.coachName} • {a.studentName} • {a.date} {a.time} ({a.minutes} dk)
              <br />
              <small style={{ color: 'var(--muted)' }}>{joinReasonLabel(joinWindow(a).reason)}</small>
            </span>
            <MeetingJoinButton appt={a} userId={user.id} coachId={cloudCoachId} />
          </div>
        )) : <div className="empty">Bulutta randevu yok.</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Randevu al</h3><span>Öğrenciler</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Tarih ve saat Türkiye. Varsayılan, görüşme penceresinin açık olacağı en yakın 5 dk. Koç onaylar; ücret yok.</p>
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
            <div className="card" key={c.id} style={{ boxShadow: 'none' }}>
              <div className="subject">
                <div className="subject-icon" style={{ overflow: 'hidden', padding: 0 }}>
                  {c.photo
                    ? <img src={c.photo} alt="" width={42} height={42} style={{ width: 42, height: 42, objectFit: 'cover' }} />
                    : c.name.trim().charAt(0)}
                </div>
                <div>
                  <b>{c.name}</b>
                  <div><span className="chip">{c.track}</span> <span className="chip">{c.studentCount} öğrenci</span></div>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>{c.focus}</p>
              <div className="plan-item"><span>Süre</span><b>40 dk</b></div>
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => {
                  const slot = nextBookSlot();
                  setBookDate(slot.date);
                  setBookTime(slot.time);
                  setBookCoach(c);
                }}>Randevu talep et</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {bookCoach ? (
        <div className="modal" onClick={() => setBookCoach(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">
              <h3>Randevu • {bookCoach.name}</h3>
              <button className="icon-btn" type="button" onClick={() => setBookCoach(null)}>×</button>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Adın</label><input value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder={profile?.name || 'Öğrenci adı'} /></div>
              <div className="field"><label>Tarih (Türkiye)</label><input type="date" min={istanbulToday()} value={bookDate} onChange={(e) => setBookDate(e.target.value)} /></div>
              <div className="field"><label>Saat (24s, 5 dk)</label><input type="time" step={300} value={bookTime} onChange={(e) => setBookTime(e.target.value)} /></div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0' }}>Pencere saatten 10 dk önce açılır. Geçmiş saat gönderilmez.</p>
            <div className="actions">
              <button className="btn primary" type="button" onClick={studentBook}>Talep gönder</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
