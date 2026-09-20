import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { examKind } from '../lib/stage';
import { fmtDate, today, uid } from '../lib/util';

export function ExamsPage() {
  const { data, setData, toast } = useApp();
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [tyt, setTyt] = useState('');
  const [ayt, setAyt] = useState('');
  const [note, setNote] = useState('');
  const kpss = examKind(data) === 'KPSS';
  const l1 = kpss ? 'GY net' : 'TYT net';
  const l2 = kpss ? 'GK net' : 'AYT net';
  const ex = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));
  const avg = ex.length ? ex.reduce((a, x) => a + Number(x.tyt || 0), 0) / ex.length : 0;
  const vals = data.exams.slice().sort((a, b) => a.date.localeCompare(b.date)).map((x) => Number(x.tyt || 0));
  const best = vals.length ? Math.max(...vals) : 0;
  const delta = vals.length ? vals[vals.length - 1] - vals[0] : 0;

  return (
    <>
      <div className="grid two">
        <div className="card">
          <div className="section-title"><h3>📝 Deneme ekle</h3></div>
          <div className="form-grid">
            <div className="field"><label>Deneme</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="TYT Genel Deneme" /></div>
            <div className="field"><label>Tarih</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>{l1}</label><input type="number" step=".25" value={tyt} onChange={(e) => setTyt(e.target.value)} /></div>
            <div className="field"><label>{l2}</label><input type="number" step=".25" value={ayt} onChange={(e) => setAyt(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Not</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => {
              setData({
                ...data,
                exams: [...data.exams, { id: uid('e_'), name: name.trim() || 'Deneme', date: date || today(), tyt: Math.max(0, Number(tyt) || 0), ayt: Math.max(0, Number(ayt) || 0), note: note.trim() }],
              });
              setName(''); setTyt(''); setAyt(''); setNote('');
              toast('Deneme kaydedildi');
            }}>＋ Denemeyi kaydet</button>
            {data.calcs[0] ? (
              <button className="btn secondary" type="button" onClick={() => {
                const c = data.calcs[0];
                setName(`${c.type} net hesabı`);
                setDate(c.date);
                setTyt(c.type === 'TYT' || c.type === 'GY' ? String(c.net) : tyt);
                setAyt(c.type === 'AYT' || c.type === 'GK' ? String(c.net) : ayt);
                toast('Son net forma alındı');
              }}>Son neti doldur</button>
            ) : null}
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h3>📈 Özet</h3></div>
          <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Ortalama {kpss ? 'GY' : 'TYT'}</span><br /><b>{avg.toFixed(2)}</b></div><span className="chip">{ex.length} deneme</span></div>
          <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Son {kpss ? 'GK' : 'AYT'}</span><br /><b>{ex[0]?.ayt || 0}</b></div></div>
          <div className="actions"><span className="chip">🏆 En yüksek {kpss ? 'GY' : 'TYT'}: {best}</span><span className="chip">İlk→son: {delta > 0 ? '+' : ''}{delta.toFixed(2)}</span></div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Zayıf net gördüğün dersi Soru Bankası’nda Zor filtresiyle tarat.</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">
          <h3>Son denemeler</h3>
          <button className="btn danger" type="button" onClick={() => {
            if (confirm('Tüm deneme kayıtları silinsin mi?')) setData({ ...data, exams: [] });
          }}>Temizle</button>
        </div>
        {ex.length ? (
          <table className="table">
            <thead><tr><th>Tarih</th><th>Deneme</th><th>{kpss ? 'GY' : 'TYT'}</th><th>{kpss ? 'GK' : 'AYT'}</th><th>Not</th><th /></tr></thead>
            <tbody>
              {ex.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.date)}</td>
                  <td>{x.name}</td>
                  <td><b>{x.tyt}</b></td>
                  <td>{x.ayt}</td>
                  <td>{x.note || '-'}</td>
                  <td><button className="icon-btn" type="button" onClick={() => setData({ ...data, exams: data.exams.filter((e) => e.id !== x.id) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">Henüz deneme eklenmedi.</div>}
      </div>
    </>
  );
}
