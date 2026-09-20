import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDate, localDateKey, today } from '../lib/util';
import { TaskRows } from '../components/TaskRows';

export function CalendarPage() {
  const { data } = useApp();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(today());
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = i - start + 1;
    let dt: Date;
    let muted = false;
    if (day < 1) {
      dt = new Date(y, m - 1, prevDays + day);
      muted = true;
    } else if (day > days) {
      dt = new Date(y, m + 1, day - days);
      muted = true;
    } else dt = new Date(y, m, day);
    const iso = localDateKey(dt);
    const mins = data.sessions.filter((x) => x.date === iso).reduce((a, x) => a + x.minutes, 0);
    const tasks = data.tasks.filter((x) => x.date === iso);
    cells.push({ iso, date: dt.getDate(), muted, mins, tasks: tasks.length, done: tasks.filter((t) => t.done).length });
  }
  const dayTasks = data.tasks.filter((x) => x.date === selected);
  const daySessions = data.sessions.filter((x) => x.date === selected);
  const dayExams = data.exams.filter((x) => x.date === selected);
  const mins = daySessions.reduce((a, x) => a + x.minutes, 0);

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title">
          <h3>📅 Çalışma Takvimi</h3>
          <span>{cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn" type="button" onClick={() => setCursor(new Date(y, m - 1, 1))}>← Önceki</button>
          <button className="btn secondary" type="button" onClick={() => { const n = new Date(); setCursor(n); setSelected(today()); }}>Bugün</button>
          <button className="btn" type="button" onClick={() => setCursor(new Date(y, m + 1, 1))}>Sonraki →</button>
        </div>
        <div className="calendar-head">{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => <div key={d}>{d}</div>)}</div>
        <div className="calendar-grid">
          {cells.map((c) => (
            <button key={c.iso + c.date} type="button" className={`cal-cell ${c.muted ? 'muted' : ''} ${c.iso === today() ? 'today' : ''} ${c.iso === selected ? 'selected' : ''}`} onClick={() => setSelected(c.iso)}>
              <div className="cal-num">{c.date}{c.mins ? ' •' : ''}</div>
              <div className="cal-min">{c.mins ? `${c.mins} dk` : ''}{c.tasks ? ` • ${c.done}/${c.tasks}` : ''}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h3>🎯 Gün özeti</h3><span>{fmtDate(selected)}</span></div>
        <div className="grid three">
          <div className="card" style={{ boxShadow: 'none' }}><span style={{ color: 'var(--muted)', fontSize: 11 }}>Çalışma</span><h3>{mins} dk</h3></div>
          <div className="card" style={{ boxShadow: 'none' }}><span style={{ color: 'var(--muted)', fontSize: 11 }}>Görev</span><h3>{dayTasks.filter((x) => x.done).length}/{dayTasks.length}</h3></div>
          <div className="card" style={{ boxShadow: 'none' }}><span style={{ color: 'var(--muted)', fontSize: 11 }}>Deneme</span><h3>{dayExams.length}</h3></div>
        </div>
        <div style={{ marginTop: 12 }}>{dayTasks.length ? <TaskRows tasks={dayTasks} /> : <div className="empty">Bu gün için görev yok.</div>}</div>
      </div>
    </div>
  );
}
