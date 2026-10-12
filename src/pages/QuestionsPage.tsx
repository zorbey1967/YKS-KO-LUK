import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { STUDY_SUBJECTS } from '../lib/insights';
import { calcNet, today } from '../lib/util';
import { coachAdvice } from '../lib/coach';

export function QuestionsPage() {
  const { data, setData, toast, go } = useApp();
  const [subject, setSubject] = useState('Matematik');
  const [c, setC] = useState(0);
  const [w, setW] = useState(0);
  const [b, setB] = useState(0);
  const map: Record<string, { q: number; net: number; correct: number }> = {};
  data.questions.forEach((x) => {
    map[x.subject] ??= { q: 0, net: 0, correct: 0 };
    map[x.subject].q += x.correct + x.wrong + x.blank;
    map[x.subject].net += x.net;
    map[x.subject].correct += x.correct;
  });
  const t = data.questions.filter((x) => x.date === today());
  const todayQ = t.reduce((a, x) => a + x.correct + x.wrong + x.blank, 0);
  const todayC = t.reduce((a, x) => a + x.correct, 0);
  const coach = coachAdvice(data);

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>Soru merkezi</h3><span>Hızlı kayıt</span></div>
        <p className="muted">Kendi setini buraya yaz. Hazır maddeler için Soru Bankası’nı kullan.</p>
        <div className="actions" style={{ marginBottom: 12 }}>
          <button className="btn primary" type="button" onClick={() => go('questionbank')}>Soru Bankası</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (c + w + b <= 0) return toast('En az bir soru gir.');
            setData({ ...data, questions: [...data.questions, { date: today(), subject, correct: Math.max(0, c), wrong: Math.max(0, w), blank: Math.max(0, b), net: calcNet(c, w) }] });
            setC(0); setW(0); setB(0);
            toast('Soru seti kaydedildi');
          }}
        >
        <div className="form-grid">
          <div className="field">
            <label>Ders</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {STUDY_SUBJECTS.filter((s) => s !== 'Odak').map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Doğru</label><input type="number" min={0} value={c} onChange={(e) => setC(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div className="field"><label>Yanlış</label><input type="number" min={0} value={w} onChange={(e) => setW(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div className="field"><label>Boş</label><input type="number" min={0} value={b} onChange={(e) => setB(Math.max(0, Number(e.target.value) || 0))} /></div>
        </div>
        <div className="actions">
          <button className="btn primary" type="submit">Seti kaydet</button>
          <button className="btn" type="button" onClick={() => {
            if (!data.questions.length) return toast('Silinecek set yok.');
            if (!confirm('Son soru seti silinsin mi?')) return;
            setData({ ...data, questions: data.questions.slice(0, -1) });
            toast('Son set silindi');
          }}>Son seti sil</button>
        </div>
        </form>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Koç önerisi</h3></div>
        <p className="muted">{coach.msg}</p>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Ders bazlı toplam</h3></div>
          {Object.keys(map).length ? Object.entries(map).map(([s, v]) => (
            <div className="topic-row" key={s}>
              <div className="topic-head"><b>{s}</b><span>{v.q} soru • %{v.q ? Math.round((v.correct / v.q) * 100) : 0}</span></div>
              <span className="chip">{v.net.toFixed(2)} net</span>
            </div>
          )) : <div className="empty">Henüz soru kaydı yok.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>Bugünün özeti</h3></div>
          <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Toplam soru</span><br /><b>{todayQ}</b></div><span className="chip">{todayQ ? `%${Math.round((todayC / todayQ) * 100)}` : t.length + ' set'}</span></div>
        </div>
      </div>
    </>
  );
}
