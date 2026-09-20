import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generatePlan } from '../lib/coach';
import { askDailyPlan } from '../lib/coachAi';
import { examKind } from '../lib/stage';
import { todaySchedule } from '../lib/insights';
import { fmtDate, today, uid } from '../lib/util';

export function PlanPage() {
  const { data, setData, toast } = useApp();
  const kind = examKind(data);
  const [minutes, setMinutes] = useState(kind === 'Okul' ? (data.age > 0 && data.age <= 9 ? 60 : 120) : 240);
  const [focus, setFocus] = useState('Eksik konular');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const foci = useMemo(() => {
    const base = ['Eksik konular', 'Programdan bugün', 'Deneme + analiz'];
    if (kind === 'YKS') return [...base, 'AYT ağırlıklı', 'TYT ağırlıklı', 'Zor konu temposu', 'Zamanlı set'];
    if (kind === 'KPSS') return [...base, 'KPSS GY-GK'];
    return [...base, 'Okul tekrarı'];
  }, [kind]);

  async function make(useCloud: boolean) {
    if (focus === 'Programdan bugün' && !todaySchedule(data)?.blocks.length) {
      return toast('Önce Ders Programım’dan haftalık program üret.');
    }
    if (!useCloud) {
      setData({ ...data, plan: generatePlan(data, minutes, focus), planDate: today() });
      setNote('Yerel koç (kural + verin).');
      toast('Plan oluşturuldu');
      return;
    }
    setBusy(true);
    try {
      const res = await askDailyPlan(data, minutes, focus);
      setData({ ...data, plan: res.blocks, planDate: today() });
      setNote(res.summary + (res.source === 'ai' ? ` • ${res.model || 'Gerçek model'}` : ' • Yerel koç'));
      toast(res.source === 'ai' ? 'AI planı hazır' : 'Yerel koç planı hazır');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title"><h3>🤖 Akıllı Plan</h3></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
          Zor konu temposu: zamanlı Zor set, yanlış etiketleme, TYT hız. Giriş varsa model sunucuda; yoksa yerel koç.
        </p>
        <div className="form-grid">
          <div className="field"><label>Günlük süre (dk)</label><input type="number" min={20} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} /></div>
          <div className="field">
            <label>Öncelik</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {foci.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" disabled={busy} onClick={() => void make(true)}>✨ AI ile plan</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void make(false)}>Yerel üret</button>
          <button className="btn" type="button" onClick={() => {
            if (!data.plan.length) return toast('Önce plan oluştur.');
            setData({
              ...data,
              tasks: [
                ...data.plan.map((x) => ({
                  id: uid('p_'),
                  title: x.text,
                  subject: 'Plan',
                  minutes: x.minutes,
                  priority: 'Normal',
                  done: false,
                  date: today(),
                })),
                ...data.tasks,
              ],
            });
            toast('Plan görevlerine aktarıldı');
          }}>📋 Görevlerime aktar</button>
        </div>
        {note ? <div className="success" style={{ marginTop: 12 }}>{note}</div> : null}
      </div>
      <div className="card">
        <div className="section-title"><h3>Bugünün planı</h3><span>{fmtDate(today())}</span></div>
        {data.plan.length ? data.plan.map((x, i) => (
          <div className="card" key={`${x.text}-${i}`} style={{ boxShadow: 'none', marginBottom: 10 }}>
            <h4>{i + 1}. Blok • {x.minutes} dk</h4>
            <div className="subject"><div className="subject-icon">{x.icon}</div><div><strong>{x.text}</strong><small style={{ color: 'var(--muted)' }}> Odaklan • süreyi tamamla</small></div></div>
          </div>
        )) : <div className="empty">Soldan “AI ile plan” veya “Yerel üret”e bas.</div>}
      </div>
    </div>
  );
}
