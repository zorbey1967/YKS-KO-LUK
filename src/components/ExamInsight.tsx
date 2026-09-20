import { useApp } from '../context/AppContext';
import { eliteReport } from '../lib/elite';
import { examCountdown } from '../lib/insights';
import { examTitle, showsKpss, showsYks } from '../lib/stage';
import { displayAge, displayText } from '../lib/types';

export function ExamInsight() {
  const { data, go } = useApp();
  const count = examCountdown(data.examDate);
  const last = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const avgT = data.exams.length ? data.exams.reduce((a, x) => a + Number(x.tyt || 0), 0) / data.exams.length : 0;
  const avgA = data.exams.length ? data.exams.reduce((a, x) => a + Number(x.ayt || 0), 0) / data.exams.length : 0;
  const calc = data.calcs[0];
  const elite = eliteReport(data);

  if (showsYks(data)) {
    return (
      <div className="card">
        <div className="section-title"><h3>📈 YKS analizi</h3><span>{elite.phase}</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
          {elite.headline}. Sıralama tahmini yok; tempo ve net trendi.
        </p>
        <div className="status-grid">
          <div className="status"><b>YKS’ye</b><span>{count.label}</span></div>
          <div className="status"><b>Ort. TYT</b><span>{avgT.toFixed(1)}</span></div>
          <div className="status"><b>Ort. AYT</b><span>{avgA.toFixed(1)}</span></div>
        </div>
        {elite.lines.slice(0, 2).map((ln) => (
          <div className="plan-item" key={ln.slice(0, 24)}><span>{ln}</span></div>
        ))}
        {last ? <div className="plan-item"><span>Son deneme • {last.name}</span><b>{last.tyt} / {last.ayt}</b></div> : <div className="empty">Deneme ekle, analiz dolsun.</div>}
        {calc ? <div className="plan-item"><span>Son net hesabı • {calc.type}</span><b>{Number(calc.net).toFixed(2)}</b></div> : null}
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => go('calculator')}>Net hesap</button>
          <button className="btn secondary" type="button" onClick={() => go('exams')}>Denemeler</button>
          <button className="btn secondary" type="button" onClick={() => go('questionbank')}>YKS soruları</button>
        </div>
      </div>
    );
  }
  if (showsKpss(data)) {
    return (
      <div className="card">
        <div className="section-title"><h3>🏛️ KPSS analizi</h3><span>GY • GK • EB</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
          Genel yetenek ve genel kültür netlerin ÖSYM 4’te 1 kuralıyla hesaplanır. Eğitim bilimleri öğretmen adayları içindir.
        </p>
        <div className="status-grid">
          <div className="status"><b>KPSS’ye</b><span>{count.label}</span></div>
          <div className="status"><b>Ort. GY</b><span>{avgT.toFixed(1)}</span></div>
          <div className="status"><b>Ort. GK</b><span>{avgA.toFixed(1)}</span></div>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => go('calculator')}>GY / GK net</button>
          <button className="btn secondary" type="button" onClick={() => go('questionbank')}>KPSS soru bankası</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="section-title"><h3>📘 Okul takibi</h3><span>{examTitle(data)}</span></div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        {displayAge(data.age)} • {displayText(data.grade)}. Program kısa bloklar ve okul derslerine göre üretilir. YKS analizi 11 ve 12. sınıfta açılır.
      </p>
      <div className="actions">
        <button className="btn secondary" type="button" onClick={() => go('topics')}>Müfredat</button>
        <button className="btn secondary" type="button" onClick={() => go('questionbank')}>Sınıf soruları</button>
      </div>
    </div>
  );
}
