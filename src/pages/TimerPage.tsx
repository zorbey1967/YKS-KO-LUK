import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { STUDY_SUBJECTS, todaySchedule } from '../lib/insights';
import { eliteReport } from '../lib/elite';
import { setBankJump } from '../lib/practice';
import { today, uid } from '../lib/util';

export function TimerPage() {
  const { data, setData, toast, go } = useApp();
  const [total, setTotal] = useState(40 * 60);
  const [left, setLeft] = useState(40 * 60);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState('Odak');
  const [pomodoro, setPomodoro] = useState(false);
  const endAt = useRef<number | null>(null);
  const totalRef = useRef(total);
  const finishing = useRef(false);
  totalRef.current = total;

  const persist = useCallback((seconds: number, sub: string) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    if (mins < 1) {
      toast('En az 1 dakika çalışmalısın.');
      return;
    }
    setData((d) => ({
      ...d,
      sessions: [...d.sessions, {
        id: uid('s_'),
        date: today(),
        minutes: mins,
        seconds,
        subject: sub,
        createdAt: new Date().toISOString(),
      }],
    }));
    toast(`${mins} dk • ${sub}`);
  }, [setData, toast]);

  useEffect(() => {
    if (!running || !endAt.current) return;
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.round((endAt.current! - Date.now()) / 1000));
      setLeft(next);
      if (next <= 0 && !finishing.current) {
        finishing.current = true;
        setRunning(false);
        endAt.current = null;
        persist(totalRef.current, subject);
        if (pomodoro && totalRef.current >= 20 * 60) {
          toast('Blok bitti. 5 dk mola önerilir.');
          setTotal(5 * 60);
          setLeft(5 * 60);
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, persist, subject, pomodoro, toast]);

  function setMode(min: number) {
    setRunning(false);
    endAt.current = null;
    setTotal(min * 60);
    setLeft(min * 60);
  }

  const todayS = data.sessions.filter((x) => x.date === today()).slice().reverse();
  const mins = todayS.reduce((a, x) => a + x.minutes, 0);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const firstBlock = todaySchedule(data)?.blocks[0];
  const elite = eliteReport(data);

  return (
    <div className="grid two">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="eyebrow">Sınav bloğu • {elite.phase}</div>
        <div className="timer-face">{mm}:{ss}</div>
        <div className="field" style={{ maxWidth: 260, margin: '0 auto', textAlign: 'left' }}>
          <label>Ders</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {STUDY_SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn primary" type="button" onClick={() => {
            if (running) {
              setRunning(false);
              const remain = Math.max(0, Math.round((endAt.current! - Date.now()) / 1000));
              setLeft(remain);
              endAt.current = null;
            } else {
              finishing.current = false;
              endAt.current = Date.now() + left * 1000;
              setRunning(true);
            }
          }}>{running ? '⏸ Duraklat' : '▶ Başlat'}</button>
          <button className="btn" type="button" onClick={() => persist(total - left, subject)}>💾 Kaydet</button>
          <button className="btn" type="button" onClick={() => { setRunning(false); endAt.current = null; setLeft(total); }}>↺ Sıfırla</button>
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          {[25, 40, 50, 90].map((m) => (
            <button key={m} className="btn secondary" type="button" onClick={() => setMode(m)}>{m} dk</button>
          ))}
          <button className="btn secondary" type="button" onClick={() => setMode(elite.dailyMin)}>Tempo {elite.dailyMin} dk</button>
          {firstBlock ? (
            <button className="btn secondary" type="button" onClick={() => {
              const hit = STUDY_SUBJECTS.find((s) => firstBlock.title.toLocaleLowerCase('tr-TR').includes(s.toLocaleLowerCase('tr-TR')));
              setSubject(hit || 'Odak');
              setMode(Math.max(15, firstBlock.minutes));
            }}>Program: {firstBlock.minutes} dk</button>
          ) : null}
        </div>
        <div className="switch" style={{ maxWidth: 320, margin: '8px auto 0', textAlign: 'left' }}>
          <span>Pomodoro (bitince 5 dk)</span>
          <button className={`toggle ${pomodoro ? 'on' : ''}`} type="button" onClick={() => setPomodoro((v) => !v)}><i /></button>
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h3>⏱ Bugünkü çalışma</h3></div>
        <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Toplam</span><br /><b>{mins} dk</b></div><span className="chip">{todayS.length} oturum</span></div>
        <div className="progress"><i style={{ width: `${Math.min(100, (mins / Math.max(40, elite.dailyMin)) * 100)}%` }} /></div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Günlük tempo ~{elite.dailyMin} dk. Süre duvar saatine göre işler.</p>
        <button className="btn secondary" type="button" style={{ marginBottom: 12 }} onClick={() => {
          const sub = subject === 'Odak' || subject === 'Deneme' ? 'Matematik' : subject;
          setBankJump({
            level: data.grade.includes('KPSS')
              ? 'KPSS Genel Yetenek'
              : (data.grade.includes('Mezun') || data.grade.startsWith('11') || data.grade.startsWith('12') || !data.grade
                ? 'YKS TYT'
                : data.grade),
            subject: sub === 'Edebiyat' ? 'Türk Dili ve Edebiyatı' : sub,
          });
          go('questionbank');
        }}>Bu dersten soru çöz</button>
        {todayS.length ? todayS.map((s) => (
          <div className="plan-item" key={s.id}>
            <span>{s.subject}<br /><small style={{ color: 'var(--muted)' }}>{new Date(s.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</small></span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <b>{s.minutes} dk</b>
              <button className="icon-btn" type="button" onClick={() => setData({ ...data, sessions: data.sessions.filter((x) => x.id !== s.id) })}>×</button>
            </span>
          </div>
        )) : <div className="empty">Bugün oturum yok.</div>}
      </div>
    </div>
  );
}
