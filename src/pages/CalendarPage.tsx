import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskRows } from '../components/TaskRows';
import { ExamListRow } from '../components/ExamListRow';
import { useExamDialogs } from '../components/ExamDialogs';
import { monthCells, monthTitle, WEEKDAYS } from '../lib/calendar';
import { istanbulToday, myAppointmentsCached, type MyAppointment } from '../lib/meeting';
import { getCoachDisplayName } from '../lib/displayName';
import { weekdayNameIstanbul } from '../lib/insights';
import { examKindIcon, examKindTone, fmtExamDateLong, upcomingExams } from '../lib/examTargets';
import { coachOwnedSchedule, studentOwnedSchedule } from '../lib/studentProgress';
import type { ScheduleBlock } from '../lib/types';

type CalFilter = 'exam' | 'lesson' | 'task' | 'appt';
const FILTERS: { id: CalFilter; label: string }[] = [
  { id: 'exam', label: 'Sınavlar' },
  { id: 'lesson', label: 'Dersler' },
  { id: 'task', label: 'Görevler' },
  { id: 'appt', label: 'Randevular' },
];
const FILTER_KEY = 'yks_cal_filters_v1';

function loadFilters(): Record<CalFilter, boolean> {
  const all = { exam: true, lesson: true, task: true, appt: true };
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...all, ...raw };
  } catch { /* tarayıcı depolaması kapalı */ }
  return all;
}

function blocksFor(days: { day: string; blocks: ScheduleBlock[] }[], weekday: string) {
  return days.find((d) => d.day === weekday)?.blocks || [];
}

/**
 * Takvim: sınav, ders programı, koç programı, görev, randevu ve çalışma kaydının tek merkezi.
 * Sınav ekleme buradan başlar (seçili gün tarihiyle).
 */
export function CalendarPage() {
  const { data, go, user } = useApp();
  const today = istanbulToday();
  const [y, m0] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ y, m: (m0 || 1) - 1 });
  const [selected, setSelected] = useState(today);
  const [appts, setAppts] = useState<MyAppointment[]>([]);
  const [show, setShow] = useState<Record<CalFilter, boolean>>(loadFilters);
  function toggle(id: CalFilter) {
    setShow((cur) => {
      const next = { ...cur, [id]: !cur[id] };
      try { localStorage.setItem(FILTER_KEY, JSON.stringify(next)); } catch { /* yok */ }
      return next;
    });
  }
  const dialogs = useExamDialogs();
  const targets = data.examTargets || [];
  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const own = useMemo(() => studentOwnedSchedule(data).days || [], [data.schedule]);
  const coach = useMemo(() => coachOwnedSchedule(data).days || [], [data.schedule, data.coachSchedule]);

  // Randevular bir kez yüklenir; gün değiştirmek yeni istek atmaz.
  useEffect(() => {
    if (!user) {
      setAppts([]);
      return;
    }
    let alive = true;
    void myAppointmentsCached(user.id).then((res) => {
      if (alive) setAppts(res.ok ? res.rows.filter((a) => a.status !== 'iptal') : []);
    });
    return () => { alive = false; };
  }, [user]);

  const byDay = useMemo(() => {
    const map = new Map<string, { exams: typeof targets; tasks: number; study: number; appt: number }>();
    const slot = (iso: string) => {
      let v = map.get(iso);
      if (!v) { v = { exams: [], tasks: 0, study: 0, appt: 0 }; map.set(iso, v); }
      return v;
    };
    for (const t of targets) slot(t.date).exams.push(t);
    for (const t of data.tasks) if (t.date) slot(t.date).tasks += 1;
    for (const s of data.sessions) slot(s.date).study += s.minutes || 0;
    for (const a of appts) slot(a.date).appt += 1;
    return map;
  }, [targets, data.tasks, data.sessions, appts]);

  const weekday = weekdayNameIstanbul(selected);
  const day = byDay.get(selected);
  const dayExams = show.exam ? (day?.exams || []).slice().sort((a, b) => a.title.localeCompare(b.title, 'tr')) : [];
  const dayTasks = show.task ? data.tasks.filter((x) => x.date === selected) : [];
  const dayAppts = show.appt ? appts.filter((a) => a.date === selected).sort((a, b) => a.time.localeCompare(b.time)) : [];
  const ownBlocks = show.lesson ? blocksFor(own, weekday) : [];
  const coachBlocks = show.lesson ? blocksFor(coach, weekday) : [];
  const studyMin = day?.study || 0;
  // Seçili günün sınavları zaten üstte; yaklaşan listesinde tekrar gösterilmez.
  const upcoming = show.exam ? upcomingExams(targets, today).filter((t) => t.date !== selected).slice(0, 5) : [];
  const empty = !dayExams.length && !dayTasks.length && !dayAppts.length && !ownBlocks.length && !coachBlocks.length && !studyMin;

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.m + delta;
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div className="cal-layout">
      <section className="card cal-month" aria-label="Aylık takvim">
        <div className="cal-toolbar">
          <h3>{monthTitle(cursor.y, cursor.m)}</h3>
          <div className="cal-nav">
            <button className="icon-btn" type="button" aria-label="Önceki ay" onClick={() => shiftMonth(-1)}>‹</button>
            <button className="btn secondary" type="button" onClick={() => { setCursor({ y, m: (m0 || 1) - 1 }); setSelected(today); }}>Bugün</button>
            <button className="icon-btn" type="button" aria-label="Sonraki ay" onClick={() => shiftMonth(1)}>›</button>
          </div>
          <button className="btn primary cal-add" type="button" onClick={() => dialogs.openNew(selected)}>+ Sınav ekle</button>
        </div>
        <div className="cal-filters" role="group" aria-label="Takvimde göster">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`chip-btn cal-filter f-${f.id}${show[f.id] ? ' on' : ''}`} aria-pressed={show[f.id]} onClick={() => toggle(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="calendar-head" aria-hidden="true">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="calendar-grid" role="grid">
          {cells.map((c) => {
            const raw = byDay.get(c.iso);
            const v = raw ? { exams: show.exam ? raw.exams : [], tasks: show.task ? raw.tasks : 0, appt: show.appt ? raw.appt : 0, study: raw.study } : undefined;
            const exams = v?.exams || [];
            const label = [
              fmtExamDateLong(c.iso),
              exams.length ? `${exams.length} sınav` : '',
              v?.tasks ? `${v.tasks} görev` : '',
              v?.appt ? `${v.appt} randevu` : '',
              v?.study ? `${v.study} dk çalışma` : '',
            ].filter(Boolean).join(', ');
            return (
              <button
                key={c.iso}
                type="button"
                role="gridcell"
                aria-selected={c.iso === selected}
                aria-label={label}
                className={`cal-cell${c.muted ? ' muted' : ''}${c.iso === today ? ' today' : ''}${c.iso === selected ? ' selected' : ''}${exams.length ? ' has-exam' : ''}`}
                onClick={() => {
                  setSelected(c.iso);
                  if (c.muted) setCursor({ y: Number(c.iso.slice(0, 4)), m: Number(c.iso.slice(5, 7)) - 1 });
                }}
              >
                <span className="cal-num">{c.day}</span>
                {exams.length ? (
                  <span className="cal-exams">
                    {exams.slice(0, 2).map((e) => <span key={e.id} className={`cal-exam tone-${examKindTone(e.kind)}`}><span aria-hidden="true">{examKindIcon(e.kind)} </span>{e.title}</span>)}
                    {exams.length > 2 ? <span className="cal-more">+{exams.length - 2}</span> : null}
                  </span>
                ) : null}
                <span className="cal-dots" aria-hidden="true">
                  {v?.appt ? <i className="dot dot-appt" /> : null}
                  {v?.tasks ? <i className="dot dot-task" /> : null}
                  {v?.study ? <i className="dot dot-study" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="cal-legend" aria-label="Renkler">
          <span><i className="dot tone-bg-tyt" />TYT</span>
          <span><i className="dot tone-bg-ayt" />AYT</span>
          <span><i className="dot tone-bg-school" />Yazılı / Vize / Final</span>
          <span><i className="dot tone-bg-deneme" />Deneme / Diğer</span>
          <span><i className="dot dot-appt" />Randevu</span>
          <span><i className="dot dot-task" />Görev</span>
          <span><i className="dot dot-study" />Çalışma</span>
        </div>
      </section>

      <section className="card cal-day" aria-label="Seçili gün">
        <div className="cal-day-head">
          <div>
            <h3>{fmtExamDateLong(selected)}</h3>
            {selected === today ? <span className="chip">Bugün</span> : null}
          </div>
        </div>

        {dayExams.length ? (
          <div className="cal-group">
            <h4>Sınavlar</h4>
            {dayExams.map((t) => <ExamListRow key={t.id} exam={t} onOpen={dialogs.openDetail} />)}
          </div>
        ) : null}

        {dayAppts.length ? (
          <div className="cal-group">
            <h4>Randevular</h4>
            {dayAppts.map((a) => (
              <div className="cal-line" key={a.id}>
                <span className="cal-time">{a.time}</span>
                <span>{getCoachDisplayName(a.coachName)} · {a.minutes} dk{a.status === 'bekliyor' ? ' · onay bekliyor' : ''}</span>
              </div>
            ))}
          </div>
        ) : null}

        {ownBlocks.length ? (
          <div className="cal-group">
            <h4>Ders Programım · {weekday}</h4>
            {ownBlocks.map((b, i) => (
              <div className="cal-line" key={`o-${i}`}>
                <span className="cal-time">{b.start || '—'}</span>
                <span>{[b.title, b.topic].filter(Boolean).join(' · ')}</span>
                <b>{b.minutes} dk</b>
              </div>
            ))}
          </div>
        ) : null}

        {coachBlocks.length ? (
          <div className="cal-group">
            <h4>Koçun Programı · {weekday}</h4>
            {coachBlocks.map((b, i) => (
              <div className="cal-line" key={`c-${i}`}>
                <span className="cal-time">{b.start || '—'}</span>
                <span>{[b.title, b.topic].filter(Boolean).join(' · ')}</span>
                <b>{b.minutes} dk</b>
              </div>
            ))}
          </div>
        ) : null}

        {dayTasks.length ? (
          <div className="cal-group">
            <h4>Görevler</h4>
            <TaskRows tasks={dayTasks} />
          </div>
        ) : null}

        {studyMin ? <p className="muted cal-study">Bu gün {studyMin} dk çalışma kaydı var.</p> : null}

        {empty ? (
          <div className="empty cal-empty">
            Bu gün için kayıt yok.
            {!own.length ? (
              <div className="actions" style={{ justifyContent: 'center' }}>
                <button className="btn secondary" type="button" onClick={() => go('schedule')}>Ders programı oluştur</button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="cal-group cal-upcoming">
          <h4>Yaklaşan sınavlar</h4>
          {upcoming.length
            ? upcoming.map((t) => <ExamListRow key={t.id} exam={t} onOpen={(e) => { setSelected(e.date); dialogs.openDetail(e); }} compact />)
            : <p className="muted">Yaklaşan sınav yok. “Sınav ekle” ile ilk sınavını kaydet.</p>}
        </div>
      </section>
      {dialogs.element}
    </div>
  );
}
