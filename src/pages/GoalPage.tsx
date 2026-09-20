import { useApp } from '../context/AppContext';
import { examCountdown } from '../lib/insights';
import { examTitle } from '../lib/stage';
import { ExamInsight } from '../components/ExamInsight';
import { GoalEditor } from '../components/GoalEditor';

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
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Hedef sıralama</span><br /><b>{Number(data.rank).toLocaleString('tr-TR')}</b></div><span className="chip">{data.grade}</span></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Yaş</span><br /><b>{data.age}</b></div><span className="chip">{data.track}</span></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>{examTitle(data)}</span><br /><b>{count.label}</b></div><span className="chip">{data.dept}</span></div>
        <div className="progress"><i style={{ width: `${bar}%` }} /></div>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Çalışma hacmine göre motivasyon çubuğu; gerçek sıralama tahmini değildir.</p>
        <div className="notice">Kaydetmeden ana sayfaya geçersen taslak silinir. Yaş, sınıftan bağımsızdır; istersen “önerilen yaş”ı kullan.</div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><ExamInsight /></div>
    </div>
  );
}
