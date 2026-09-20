import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CALC_CONFIG, type CalcType } from '../lib/curriculum';
import { examKind } from '../lib/stage';
import type { CalcSubject } from '../lib/types';
import { calcNet, fmtDate, today, uid } from '../lib/util';

function emptyRow(subject: string, max: number): CalcSubject {
  return { subject, max, correct: 0, wrong: 0, blank: max, net: 0 };
}

function Step({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Azalt">−</button>
      <input type="number" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Artır">+</button>
    </div>
  );
}

function isCalcType(s: string): s is CalcType {
  return s in CALC_CONFIG;
}

export function CalculatorPage() {
  const { data, setData, toast } = useApp();
  const kpss = examKind(data) === 'KPSS';
  const [type, setType] = useState<CalcType>(kpss ? 'GY' : 'TYT');
  const [rows, setRows] = useState<CalcSubject[]>(() => CALC_CONFIG[kpss ? 'GY' : 'TYT'].map((s) => emptyRow(s.key, s.max)));
  const [autoBlank, setAutoBlank] = useState(true);

  const weakRow = useMemo(() => {
    const scored = rows.filter((r) => r.correct + r.wrong > 0);
    if (!scored.length) return null;
    return scored.slice().sort((a, b) => a.net - b.net)[0];
  }, [rows]);

  const totals = useMemo(() => {
    const correct = rows.reduce((a, r) => a + r.correct, 0);
    const wrong = rows.reduce((a, r) => a + r.wrong, 0);
    const blank = rows.reduce((a, r) => a + r.blank, 0);
    return { correct, wrong, blank, net: calcNet(correct, wrong), asked: correct + wrong + blank };
  }, [rows]);

  function switchType(next: CalcType) {
    setType(next);
    setRows(CALC_CONFIG[next].map((s) => emptyRow(s.key, s.max)));
  }

  function patch(i: number, field: 'correct' | 'wrong' | 'blank', raw: number) {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      let v = Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
      if (field === 'blank' && autoBlank) return r;
      if (field === 'correct' || field === 'wrong') {
        const other = field === 'correct' ? r.wrong : r.correct;
        v = Math.min(v, r.max - other);
        const next = { ...r, [field]: v };
        next.blank = autoBlank ? Math.max(0, r.max - next.correct - next.wrong) : Math.min(r.blank, r.max - next.correct - next.wrong);
        next.net = calcNet(next.correct, next.wrong);
        return next;
      }
      v = Math.min(v, r.max - r.correct - r.wrong);
      const next = { ...r, blank: v, net: calcNet(r.correct, r.wrong) };
      return next;
    }));
  }

  function persist(alsoExam: boolean) {
    if (totals.correct + totals.wrong <= 0 && totals.blank === rows.reduce((a, r) => a + r.max, 0)) {
      return toast('Doğru veya yanlış gir.');
    }
    const rec = {
      id: Date.now(),
      date: today(),
      type,
      correct: totals.correct,
      wrong: totals.wrong,
      blank: totals.blank,
      net: totals.net,
      subjects: rows,
    };
    setData({
      ...data,
      calcs: [rec, ...data.calcs].slice(0, 30),
      exams: alsoExam ? [...data.exams, {
        id: uid('e_'),
        name: `${type} net hesabı`,
        date: today(),
        tyt: type === 'TYT' || type === 'GY' ? totals.net : 0,
        ayt: type === 'AYT' || type === 'GK' ? totals.net : 0,
        note: rows.map((r) => `${r.subject} ${r.net.toFixed(1)}`).join(', '),
      }] : data.exams,
    });
    toast(alsoExam ? `${type} kaydedildi ve denemeye yazıldı` : `${type} neti kaydedildi`);
  }

  const h = data.calcs || [];
  const sorted = h.slice().sort((a, z) => String(z.date).localeCompare(String(a.date)) || z.id - a.id);
  const a = sorted.find((x) => x.type === (kpss ? 'GY' : 'TYT'));
  const b = sorted.find((x) => x.type === (kpss ? 'GK' : 'AYT'));

  return (
    <>
      <div className="calc-live">
        <div>
          <div className="eyebrow">Canlı net • 4 yanlış = 1 doğru</div>
          <div className="calc-big">{totals.net.toFixed(2)}</div>
          <small>{totals.correct}D • {totals.wrong}Y • {totals.blank}B</small>
          {weakRow ? <div style={{ marginTop: 8, fontSize: 13 }}>En düşük ders <b>{weakRow.subject}</b> ({weakRow.net.toFixed(2)} net) — zamanlı 20 soru.</div> : null}
        </div>
        <div className="chip-row">
          {(kpss ? (['GY', 'GK'] as const) : (['TYT', 'AYT'] as const)).map((t) => (
            <button key={t} className={`chip ${type === t ? 'on' : ''}`} type="button" onClick={() => switchType(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title">
            <h3>Ders ders</h3>
            <label className="switch" style={{ padding: 0, border: 0, gap: 8 }}>
              <span style={{ fontSize: 12 }}>Boş otomatik</span>
              <button className={`toggle ${autoBlank ? 'on' : ''}`} type="button" onClick={() => {
                setAutoBlank((v) => !v);
                setRows((prev) => prev.map((r) => {
                  const blank = !autoBlank ? Math.max(0, r.max - r.correct - r.wrong) : r.blank;
                  return { ...r, blank };
                }));
              }}><i /></button>
            </label>
          </div>
          {rows.map((r, i) => (
            <div className="calc-row" key={r.subject}>
              <div>
                <b>{r.subject}</b>
                <small style={{ color: 'var(--muted)' }}>{r.max} soru • net {r.net.toFixed(2)}</small>
              </div>
              <div className="calc-inputs">
                <div><span>D</span><Step value={r.correct} max={r.max} onChange={(n) => patch(i, 'correct', n)} /></div>
                <div><span>Y</span><Step value={r.wrong} max={r.max} onChange={(n) => patch(i, 'wrong', n)} /></div>
                {!autoBlank ? <div><span>B</span><Step value={r.blank} max={r.max} onChange={(n) => patch(i, 'blank', n)} /></div> : <div className="calc-blank">B {r.blank}</div>}
              </div>
            </div>
          ))}
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => persist(false)}>Kaydet</button>
            <button className="btn secondary" type="button" onClick={() => persist(true)}>Denemeye yaz</button>
            <button className="btn" type="button" onClick={() => setRows(CALC_CONFIG[type].map((s) => emptyRow(s.key, s.max)))}>Sıfırla</button>
            {h[0] ? (
              <button className="btn" type="button" onClick={() => {
                const last = h.find((x) => x.type === type && x.subjects?.length) || h.find((x) => x.subjects?.length);
                if (!last?.subjects) return toast('Yüklenecek ders detayı yok.');
                if (last.type && isCalcType(last.type)) setType(last.type);
                setRows(last.subjects.map((s) => ({ ...s, net: calcNet(s.correct, s.wrong) })));
                toast('Son kayıt yüklendi');
              }}>Son kaydı yükle</button>
            ) : null}
          </div>
        </div>
        <div className="card">
          <div className="section-title">
            <h3>📌 Kayıtlar</h3>
            <button className="btn danger" type="button" onClick={() => setData({ ...data, calcs: [] })}>Temizle</button>
          </div>
          <div className="grid two" style={{ marginBottom: 12 }}>
            <div className="status"><b>{kpss ? 'GY' : 'TYT'}</b><span>{a ? Number(a.net).toFixed(2) : '—'}</span></div>
            <div className="status"><b>{kpss ? 'GK' : 'AYT'}</b><span>{b ? Number(b.net).toFixed(2) : '—'}</span></div>
          </div>
          {h.length ? h.slice(0, 8).map((x) => (
            <button className="plan-item calc-hist" type="button" key={x.id} onClick={() => {
              if (isCalcType(x.type)) setType(x.type);
              if (x.subjects?.length) setRows(x.subjects.map((s) => ({ ...s, net: calcNet(s.correct, s.wrong) })));
            }}>
              <span><b>{x.type}</b> • {fmtDate(x.date)}<br /><small style={{ color: 'var(--muted)' }}>{x.correct}D {x.wrong}Y {x.blank}B</small></span>
              <b>{Number(x.net).toFixed(2)}</b>
            </button>
          )) : <div className="empty">Henüz net hesabı yok.</div>}
        </div>
      </div>
    </>
  );
}
