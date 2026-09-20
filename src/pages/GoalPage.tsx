import { useApp } from '../context/AppContext';
import { examCountdown } from '../lib/insights';
import { examTitle } from '../lib/stage';
import { ExamInsight } from '../components/ExamInsight';
import { GoalEditor } from '../components/GoalEditor';
import { displayAge, displayRank, displayText } from '../lib/types';

export function GoalPage() {
  const { data } = useApp();
  const weekMins = data.sessions.reduce((a, x) => a + x.minutes, 0);
  const bar = Math.min(100, Math.round((weekMins / Math.max(1, data.weekHours * 60 * 4)) * 100) || 8);
  const count = examCountdown(data.examDate);

  return (
    <div className="grid two">
      <GoalEditor />
      <div className="card">
        <div className="section-title"><h3>🏁 Kayıtlı hedef</h3></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Hedef sıralama</span><br /><b>{displayRank(data.rank)}</b></div><span className="chip">{displayText(data.grade)}</span></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Yaş</span><br /><b>{displayAge(data.age)}</b></div><span className="chip">{displayText(data.track)}</span></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>{examTitle(data)}</span><br /><b>{data.examDate ? count.label : 'belirtilmedi'}</b></div><span className="chip">{displayText(data.dept)}</span></div>
        <div className="progress"><i style={{ width: `${bar}%` }} /></div>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Çalışma hacmine göre motivasyon çubuğu; gerçek sıralama tahmini değildir.</p>
        <div className="notice">Kaydetmeden ana sayfaya geçersen taslak silinir. Yaş, sınıftan bağımsızdır; istersen “önerilen yaş”ı kullan.</div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><ExamInsight /></div>
    </div>
  );
}
