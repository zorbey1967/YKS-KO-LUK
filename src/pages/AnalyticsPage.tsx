import { useApp } from '../context/AppContext';
import { eliteReport } from '../lib/elite';
import { examCountdown, weekGoalPct, weekMinutes } from '../lib/insights';
import { setBankJump, weakBankTopics } from '../lib/practice';
import { ExamInsight } from '../components/ExamInsight';
import { examKind, examTitle } from '../lib/stage';
import { localDateKey } from '../lib/util';

export function AnalyticsPage() {
  const { data, go } = useApp();
  const total = data.sessions.reduce((a, x) => a + x.minutes, 0);
  const avgTyt = data.exams.length ? data.exams.reduce((a, x) => a + Number(x.tyt || 0), 0) / data.exams.length : 0;
  const avgAyt = data.exams.length ? data.exams.reduce((a, x) => a + Number(x.ayt || 0), 0) / data.exams.length : 0;
  const qs = data.questions.reduce((a, x) => a + x.correct + x.wrong + x.blank, 0);
  const bankSolved = Object.values(data.questionStats).reduce((a, s) => a + s.attempts, 0);
  const bankCorrect = Object.values(data.questionStats).reduce((a, s) => a + s.correct, 0);
  const acc = bankSolved ? Math.round((bankCorrect / bankSolved) * 100) : 0;
  const done = data.tasks.filter((x) => x.done).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    const date = localDateKey(dt);
    return { date, mins: data.sessions.filter((x) => x.date === date).reduce((a, x) => a + x.minutes, 0) };
  });
  const ex = data.exams.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const mx = Math.max(1, ...ex.map((x) => Math.max(Number(x.tyt || 0), Number(x.ayt || 0))));
  const weak = data.topics.slice().sort((a, b) => a.level - b.level).slice(0, 5);
  const bySub: Record<string, number> = {};
  data.sessions.forEach((s) => { bySub[s.subject] = (bySub[s.subject] || 0) + s.minutes; });
  const week = weekMinutes(data);
  const weekGoal = weekGoalPct(data);
  const weekPct = weekGoal.pct;
  const kind = examKind(data);
  const n1 = kind === 'KPSS' ? 'GY' : kind === 'YKS' ? 'TYT' : 'Deneme-1';
  const n2 = kind === 'KPSS' ? 'GK' : kind === 'YKS' ? 'AYT' : 'Deneme-2';
  const count = examCountdown(data.examDate);
  const lastCalc = data.calcs.slice(0, 4);
  const elite = eliteReport(data);
  const bankWeak = weakBankTopics(data, 5);

  return (
    <>
      <div className="grid stats">
        <div className="card stat"><div className="label">TOPLAM ÇALIŞMA</div><div className="value">{(total / 60).toFixed(1)}s</div><div className="sub">Kayıtlı oturumlar</div></div>
        <div className="card stat"><div className="label">ORT. {n1} / {n2}</div><div className="value">{avgTyt.toFixed(1)} / {avgAyt.toFixed(1)}</div><div className="sub">{data.exams.length} deneme</div></div>
        <div className="card stat"><div className="label">SORU</div><div className="value">{qs + bankSolved}</div><div className="sub">Banka doğruluk %{acc}</div></div>
        <div className="card stat"><div className="label">HAFTA</div><div className="value">{weekPct}%</div><div className="sub">{(week / 60).toFixed(1)} / {weekGoal.hoursLabel}</div></div>
      </div>
      <div className="notice" style={{ marginBottom: 16 }}>{!data.examDate ? `Sınav tarihi belirtilmedi. ${elite.headline}.` : count.past ? 'Sınav tarihi geçti — Hedefim’den yeni tarih seç.' : `${examTitle(data)}’ye ${count.label}. ${elite.headline}. Görev tamamlanma ${data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0}%.`}</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>Sınav temposu</h3><span>{elite.phase}</span></div>
        {elite.lines.map((ln) => <p key={ln.slice(0, 40)} style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0' }}>{ln}</p>)}
      </div>
      <div style={{ marginBottom: 16 }}><ExamInsight /></div>
      <div className="grid two">
        <div className="card">
          <div className="section-title"><h3>Son 7 gün çalışma</h3><span>dakika</span></div>
          <div className="chart">
            {days.map((x) => (
              <div className="bar" key={x.date} style={{ height: '100%' }}>
                <i style={{ height: `${Math.min(100, (x.mins / 180) * 100)}%` }} />
                <small>{x.mins}</small>
                <em>{new Date(`${x.date}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h3>Deneme trendi</h3><span>{n1} / {n2}</span></div>
          <div className="chart">
            {ex.length ? ex.map((x) => (
              <div className="bar" key={x.id} style={{ height: '100%' }}>
                <i style={{ height: `${(Number(x.tyt || 0) / mx) * 100}%` }} />
                <small>{x.tyt}/{x.ayt}</small>
                <em>{new Date(`${x.date}T00:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</em>
              </div>
            )) : <div className="empty" style={{ width: '100%' }}>Deneme verisi yok.</div>}
          </div>
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Zayıf konular</h3></div>
          {bankWeak.length ? bankWeak.map((x) => (
            <div className="plan-item" key={x.key}>
              <span>{x.topic}<br /><small style={{ color: 'var(--muted)' }}>{x.subject} • banka %{x.acc}</small></span>
              <button className="btn secondary" type="button" onClick={() => { setBankJump({ level: x.levelName, subject: x.subject, topic: x.topic }); go('questionbank'); }}>Çöz</button>
            </div>
          )) : weak.length ? weak.map((x) => (
            <div className="topic-row" key={x.id}>
              <div className="topic-head"><b>{x.name}</b><span>{x.level}%</span></div>
              <div className="progress"><i style={{ width: `${x.level}%` }} /></div>
            </div>
          )) : <div className="empty">Konu takibi ve banka çözümü boş.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>Ders süreleri</h3></div>
          {Object.keys(bySub).length ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([s, m]) => (
            <div className="plan-item" key={s}><span>{s}</span><b>{m} dk</b></div>
          )) : <div className="empty">Oturum yok.</div>}
          {lastCalc.length ? (
            <>
              <div className="section-title" style={{ marginTop: 16 }}><h3>Son netler</h3></div>
              {lastCalc.map((c) => (
                <div className="plan-item" key={c.id}><span>{c.type} • {c.date}</span><b>{Number(c.net).toFixed(2)}</b></div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
