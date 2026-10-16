import { useApp } from '../context/AppContext';
import { examCountdown, weekGoalPct } from '../lib/insights';
import { examTitle } from '../lib/stage';
import { ExamInsight } from '../components/ExamInsight';
import { GoalEditor } from '../components/GoalEditor';
import { displayRank, displayText } from '../lib/types';
import { setBankJump, weakBankTopics } from '../lib/practice';
import { QUESTION_BANK_ENABLED } from '../lib/features';

export function GoalPage() {
  const { data, go } = useApp();
  const bar = weekGoalPct(data);
  const count = examCountdown(data.examDate);
  const weak = weakBankTopics(data, 3);
  const last = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="grid two">
      <GoalEditor />
      <div className="card">
        <div className="section-title"><h3>Durum</h3></div>
        {data.rank > 0 ? (
          <div className="kpi"><div><span className="muted" style={{ fontSize: 12 }}>Hedef sıralama</span><br /><b>{displayRank(data.rank)}</b></div><span className="chip">{displayText(data.dept)}</span></div>
        ) : (
          <p className="muted">Hedef sıra kaydı yok.</p>
        )}
        <div className="kpi">
          <div><span className="muted" style={{ fontSize: 12 }}>{examTitle(data)}</span><br /><b>{data.examDate ? count.label : 'tarih yok'}</b></div>
          <span className="chip">{displayText(data.track)}</span>
        </div>
        {bar.hoursLabel !== 'belirtilmedi' ? (
          <>
            <div className="progress"><i style={{ width: `${bar.pct}%` }} /></div>
            <p className="muted">Bu hafta çalışma hacmi (hedef {bar.hoursLabel}). Sıralama tahmini değildir.</p>
          </>
        ) : (
          <p className="muted">Haftalık saat hedefi yok.</p>
        )}
        {last ? <div className="plan-item"><span>Son deneme • {last.name}</span><b>{last.tyt} TYT</b></div> : null}
        {weak.length ? weak.map((w) => (
          <div className="plan-item" key={w.key}>
            <span>{w.topic}<br /><small className="muted">{w.subject} • %{w.acc}</small></span>
            {QUESTION_BANK_ENABLED ? <button className="btn secondary" type="button" onClick={() => {
              setBankJump({ level: w.levelName, subject: w.subject, topic: w.topic });
              go('questionbank');
            }}>Çalış</button> : null}
          </div>
        )) : null}
      </div>
      <div style={{ gridColumn: '1 / -1' }}><ExamInsight /></div>
    </div>
  );
}
