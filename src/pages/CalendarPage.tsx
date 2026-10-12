import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskRows } from '../components/TaskRows';
import { ExamForm } from '../components/ExamForm';
import { monthCells, monthTitle, WEEKDAYS } from '../lib/calendar';
import { emptyExamTarget, examDateForLegacy, upsertExam } from '../lib/examTargets';
import { remainingClock } from '../lib/countdown';
import { istanbulToday, listMyAppointments, type MyAppointment } from '../lib/meeting';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { fetchMyCoach } from '../lib/cloudPlatform';
import { weekdayNameIstanbul } from '../lib/insights';
import { fmtDate } from '../lib/util';
import type { ExamTarget } from '../lib/types';

export function CalendarPage() {
  const { data, setData, toast, go, user } = useApp();
  const today = istanbulToday();
  const [y, m0] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ y, m: (m0 || 1) - 1 });
  const [selected, setSelected] = useState(today);
  const [modal, setModal] = useState<ExamTarget | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dayAppts, setDayAppts] = useState<MyAppointment[]>([]);
  const targets = data.examTargets || [];
  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const dayExams = targets.filter((t) => t.date === selected);
  const dayTasks = data.tasks.filter((x) => x.date === selected);
  const daySessions = data.sessions.filter((x) => x.date === selected);
  const weekday = weekdayNameIstanbul(selected);
  const dayBlocks = data.schedule.days.find((d) => d.day === weekday)?.blocks || [];
  const mins = daySessions.reduce((a, x) => a + x.minutes, 0);

  useEffect(() => {
    if (!user) {
      setDayAppts([]);
      return;
    }
    let alive = true;
    void (async () => {
      const mine = await fetchMyCoach(user.id);
      const cid = mine && mine.status === 'active' ? mine.id : null;
      const res = await listMyAppointments(user.id, cid);
      if (!alive) return;
      if (!res.ok) {
        setDayAppts([]);
        return;
      }
      setDayAppts(res.rows.filter((a) => a.date === selected && a.status !== 'iptal'));
    })();
    return () => { alive = false; };
  }, [user, selected]);
  const confirmExam = confirmId ? targets.find((t) => t.id === confirmId) : null;
  const planWarn = Boolean(confirmExam && data.examPlan && (data.examPlan.examId === confirmExam.id || data.examPlan.examDate === confirmExam.date));

  function saveTargets(next: ExamTarget[]) {
    setData({ ...data, examTargets: next, examDate: examDateForLegacy(next) || '' });
  }

  function openNew() {
    const draft = emptyExamTarget();
    draft.date = selected;
    draft.isPrimary = false;
    draft.origin = 'user';
    setModal(draft);
  }

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title">
          <h3>{monthTitle(cursor.y, cursor.m)}</h3>
          <button className="btn primary" type="button" onClick={openNew}>+ Sınav Ekle</button>
        </div>
        <p className="muted">Sınavlar Sınav Merkezi ile aynı kayıttır. Tarih Türkiye takvimine göredir.</p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn" type="button" onClick={() => setCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })}>Önceki</button>
          <button className="btn secondary" type="button" onClick={() => { setCursor({ y, m: (m0 || 1) - 1 }); setSelected(today); }}>Bugün</button>
          <button className="btn" type="button" onClick={() => setCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })}>Sonraki</button>
        </div>
        <div className="calendar-head">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="calendar-grid">
          {cells.map((c) => {
            const hits = targets.filter((t) => t.date === c.iso);
            const hasTask = data.tasks.some((t) => t.date === c.iso);
            const hasStudy = data.sessions.some((s) => s.date === c.iso);
            return (
              <button key={c.iso} type="button" className={`cal-cell ${c.muted ? 'muted' : ''} ${c.iso === today ? 'today' : ''} ${c.iso === selected ? 'selected' : ''}`} onClick={() => setSelected(c.iso)}>
                <div className="cal-num">{c.day}{hasStudy ? ' •' : ''}{hasTask ? ' ·' : ''}</div>
                <div className="exam-badges">
                  {hits.slice(0, 2).map((h) => <span key={h.id} className="exam-badge">{h.kind.slice(0, 8)}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h3>{fmtDate(selected)}</h3><span>{weekday}</span></div>
        {dayExams.length ? dayExams.map((t) => {
          const clock = remainingClock(t.date, t.startTime, Date.now(), t.endTime);
          return (
            <div className="exam-row" key={t.id}>
              <div>
                <b>{t.title}</b>
                <small className="muted">{t.origin === 'official' || t.isPrimary ? 'Resmi / ana sınav' : 'Senin eklediğin'} • {t.kind}{t.subject ? ` • ${t.subject}` : ''} • {t.startTime || 'saat yok'}{t.durationMin ? ` • ${t.durationMin} dk` : ''} • {clock.headline}</small>
              </div>
              <div className="exam-row-actions">
                <button className="btn" type="button" onClick={() => setModal(t)}>Düzenle</button>
                <button className="btn danger" type="button" onClick={() => setConfirmId(t.id)}>Sil</button>
              </div>
            </div>
          );
        }) : <p className="muted">Bu günde sınav yok. <button className="btn" type="button" onClick={openNew}>Sınav ekle</button></p>}

        {dayAppts.length ? (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Randevu</h4>
            {dayAppts.map((a) => (
              <div className="plan-item" key={a.id}>
                <span>
                  {user && a.studentId === user.id ? getCoachDisplayName(a.coachName) : getPersonDisplayName(a.studentName, 'Öğrenci')}
                  <br /><small className="muted">{a.time} • {a.minutes} dk</small>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {dayBlocks.length ? (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Ders programı</h4>
            {dayBlocks.map((b, i) => (
              <div className="plan-item" key={`${b.title}-${i}`}><span>{b.icon} {b.title}</span><b>{b.minutes} dk</b></div>
            ))}
          </div>
        ) : null}

        {mins ? <p className="muted" style={{ marginTop: 12 }}>{mins} dk çalışma kaydı</p> : null}

        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Görevler</h4>
          {dayTasks.length ? <TaskRows tasks={dayTasks} /> : <p className="muted">Bu gün için görev yok.</p>}
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => go('schedule')}>Sınav Merkezi</button>
        </div>
      </div>

      {modal ? (
        <ExamForm
          draft={modal}
          onClose={() => setModal(null)}
          onSave={(row) => {
            saveTargets(upsertExam(targets, row));
            setModal(null);
            toast(row.id && targets.some((t) => t.id === row.id) ? 'Sınav güncellendi' : 'Sınav eklendi');
          }}
        />
      ) : null}

      {confirmId && confirmExam ? (
        <div className="modal" role="dialog">
          <div className="modal-box">
            <h3>Sınav silinsin mi?</h3>
            <p>{confirmExam.title} kaydı kalkacak. Countdown ve bildirim bu sınavı kullanmaz.</p>
            {planWarn ? <p className="muted">Bu sınava bağlı AI çalışma planı da silinecek. Ders programın, görevlerin ve PDF’in durur.</p> : null}
            <div className="actions">
              <button className="btn danger" type="button" onClick={() => {
                const next = targets.filter((t) => t.id !== confirmId);
                const clearPlan = planWarn;
                setData({
                  ...data,
                  examTargets: next,
                  examDate: examDateForLegacy(next) || '',
                  examPlan: clearPlan ? null : data.examPlan,
                  examPlanDraft: clearPlan ? null : data.examPlanDraft,
                });
                setConfirmId(null);
                toast('Sınav silindi');
              }}>Sil</button>
              <button className="btn" type="button" onClick={() => setConfirmId(null)}>Vazgeç</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

