import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskRows } from '../components/TaskRows';
import { ExamResultModal } from '../components/ExamResultModal';
import { monthCells, monthTitle, WEEKDAYS } from '../lib/calendar';
import { istanbulToday, listMyAppointments, type MyAppointment } from '../lib/meeting';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { fetchMyCoach } from '../lib/cloudPlatform';
import { weekdayNameIstanbul } from '../lib/insights';
import { fmtDate } from '../lib/util';
import type { ExamTarget } from '../lib/types';
import { getStudentProgress } from '../lib/studentProgress';

export function CalendarPage() {
  const { data, go, user } = useApp();
  const today = istanbulToday();
  const [y, m0] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ y, m: (m0 || 1) - 1 });
  const [selected, setSelected] = useState(today);
  const [resultTarget, setResultTarget] = useState<ExamTarget | null>(null);
  const [dayAppts, setDayAppts] = useState<MyAppointment[]>([]);
  const targets = data.examTargets || [];
  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const dayExams = targets.filter((t) => t.date === selected);
  const dayTasks = data.tasks.filter((x) => x.date === selected);
  const daySessions = data.sessions.filter((x) => x.date === selected);
  const weekday = weekdayNameIstanbul(selected);
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const coachDayBlocks = (data.coachSchedule?.days || []).find((d) => d.day === weekday)?.blocks || [];
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

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title">
          <h3>{monthTitle(cursor.y, cursor.m)}</h3>
        </div>
        <p className="muted">Sınavlar Sınav Merkezi ile aynı kayıttır. Sonucu girmek için tarihe tıkla.</p>
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
                  {hits.slice(0, 2).map((h) => <span key={h.id} className="exam-badge">{h.title.slice(0, 8)}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h3>{fmtDate(selected)}</h3><span>{weekday}</span></div>
        {dayExams.length ? dayExams.map((t) => (
          <button
            key={t.id}
            type="button"
            className="exam-row"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setResultTarget(t)}
          >
            <div>
              <b>{t.title}</b>
              <small className="muted">{t.date}</small>
            </div>
          </button>
        )) : <p className="muted">Bu günde sınav yok.</p>}

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

        {coachDayBlocks.length ? (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Koçun Programı</h4>
            {coachDayBlocks.map((b, i) => (
              <div className="plan-item" key={`c-${b.title}-${i}`}><span>{b.icon} {[b.start, b.title, b.topic].filter(Boolean).join(' ')}</span><b>{b.minutes} dk</b></div>
            ))}
          </div>
        ) : null}

        {progress.upcomingExams.length ? (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 8px' }}>Yaklaşan sınav hazırlığı</h4>
            {progress.upcomingExams.map((e) => (
              <div key={e.examId} className="plan-item">
                <span>
                  {e.title} · {e.daysLeft} gün
                  <br />
                  <small className="muted">Eksik: {e.missing.slice(0, 3).join(', ') || '—'} · {e.days[0]?.title}</small>
                </span>
              </div>
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

      {resultTarget ? (
        <ExamResultModal target={resultTarget} onClose={() => setResultTarget(null)} />
      ) : null}
    </div>
  );
}
