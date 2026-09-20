import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { curriculumForGrade, GRADES } from '../lib/curriculum';
import { applyGradeKeepAge } from '../lib/goal';
import { jumpFromTracker, setBankJump } from '../lib/practice';
import { uid } from '../lib/util';

export function TopicsPage() {
  const { data, setData, toast, go } = useApp();
  const [subject, setSubject] = useState('');
  const curr = useMemo(() => curriculumForGrade(data.grade), [data.grade]);
  const subjects = Object.keys(curr);
  const activeSubject = subject && curr[subject] ? subject : subjects[0] || '';
  const weak = data.topics.slice().sort((a, b) => a.level - b.level).slice(0, 6);
  const mine = data.topics.filter((t) => !t.grade || t.grade === data.grade);

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title">
          <h3>📚 Müfredat</h3>
          <select value={data.grade} onChange={(e) => setData(applyGradeKeepAge(data, e.target.value))}>
            {GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          {subjects.length} ders • {subjects.reduce((n, s) => n + (curr[s] || []).length, 0)} konu.
          {data.grade === 'Mezun / YKS' || data.grade.startsWith('11') || data.grade.startsWith('12')
            ? ' TYT ve AYT başlıkları tam listelenir; pratik için Soru Bankası’nda YKS TYT / YKS AYT’yi aç.'
            : ' Takibe aldığın konular programda öne çıkar.'}
        </p>
        <div className="actions" style={{ marginBottom: 12 }}>
          <button className="btn primary" type="button" onClick={() => go('questionbank')}>🧠 Soru çöz</button>
        </div>
        <div className="chip-row">
          {subjects.map((s) => (
            <button key={s} className={`chip ${s === activeSubject ? 'on' : ''}`} type="button" onClick={() => setSubject(s)}>{s}</button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          {(curr[activeSubject] || []).map((name) => {
            const existing = data.topics.find((t) => t.name === name && t.subject === activeSubject);
            return (
              <div className="topic-row" key={name}>
                <div className="topic-head">
                  <span><b>{name}</b></span>
                  {existing ? (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="chip">{existing.level}%</span>
                      <button className="btn secondary" type="button" onClick={() => {
                        setBankJump(jumpFromTracker(data.grade, activeSubject, name));
                        go('questionbank');
                      }}>Çöz</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button className="btn secondary" type="button" onClick={() => {
                        setData({ ...data, topics: [{ id: uid('tp_'), name, subject: activeSubject, level: 10, grade: data.grade }, ...data.topics] });
                        toast('Konu eklendi');
                      }}>Takibe al</button>
                      <button className="btn secondary" type="button" onClick={() => {
                        setBankJump(jumpFromTracker(data.grade, activeSubject, name));
                        go('questionbank');
                      }}>Çöz</button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="section-title"><h3>Takibindeki konular</h3><span>{mine.length}</span></div>
          {mine.length ? mine.map((x) => (
            <div className="topic-row" key={x.id}>
              <div className="topic-head">
                <span><b>{x.name}</b> <small style={{ color: 'var(--muted)' }}>• {x.subject}</small></span>
                <b>{x.level}%</b>
              </div>
              <div className="progress"><i style={{ width: `${x.level}%` }} /></div>
              <div className="actions">
                <button className="btn secondary" type="button" onClick={() => setData({ ...data, topics: data.topics.map((t) => t.id === x.id ? { ...t, level: Math.max(0, t.level - 10) } : t) })}>−</button>
                <button className="btn secondary" type="button" onClick={() => setData({ ...data, topics: data.topics.map((t) => t.id === x.id ? { ...t, level: Math.min(100, t.level + 10) } : t) })}>＋</button>
                <button className="btn secondary" type="button" onClick={() => {
                  setBankJump(jumpFromTracker(data.grade, x.subject, x.name));
                  go('questionbank');
                }}>Çöz</button>
              </div>
            </div>
          )) : <div className="empty">Soldan konu ekle.</div>}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>🎯 Öncelik</h3></div>
          {weak.length ? weak.map((x) => (
            <div className="topic-row" key={x.id}>
              <div className="topic-head"><b>{x.name}</b><span className="chip">{x.level}%</span></div>
              <small style={{ color: 'var(--muted)' }}>{x.subject} — programda öne alınır.</small>
            </div>
          )) : <div className="empty">Veri yok.</div>}
        </div>
      </div>
    </div>
  );
}
