import { useApp } from '../context/AppContext';
import { weekGoalPct } from '../lib/insights';
import { GoalEditor } from '../components/GoalEditor';
import { displayRank, displayText } from '../lib/types';

export function GoalPage() {
  const { data } = useApp();
  const bar = weekGoalPct(data);
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
          <div><span className="muted" style={{ fontSize: 12 }}>Alan / sınıf</span><br /><b>{displayText(data.grade)}</b></div>
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
        {last ? <div className="plan-item"><span>Son deneme • {last.name}</span><b>{last.tyt} net</b></div> : null}
        <p className="muted">Sınav tarihleri Takvim’den eklenir; hedef sınavın Ana Sayfa’da geri sayılır.</p>
      </div>
    </div>
  );
}
