import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generatePlan } from '../lib/coach';
import { askDailyPlan } from '../lib/coachAi';
import { publicCoachBrand } from '../lib/zoroText';
import { examKind } from '../lib/stage';
import { todaySchedule } from '../lib/insights';
import { fmtDate, today, uid } from '../lib/util';
import { canUseFeature } from '../lib/subscription';
import { appendGeneratedTasks } from '../lib/coachPlan';

export function PlanPage() {
  const { data, setData, toast, profile, isAdmin } = useApp();
  const aiPlan = canUseFeature(profile, 'ai_plan', Date.now(), isAdmin);
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
    const mins = Math.max(20, Math.min(720, minutes || 0));
    if (mins !== minutes) setMinutes(mins);
    if (focus === 'Programdan bugün' && !todaySchedule(data)?.blocks.length) {
      return toast('Önce Ders Programım’dan haftalık program üret.');
    }
    if (!useCloud) {
      setData({ ...data, plan: generatePlan(data, mins, focus), planDate: today() });
      setNote('Yerel koç (kural + verin).');
      toast('Plan oluşturuldu');
      return;
    }
    setBusy(true);
    try {
      const res = await askDailyPlan(data, mins, focus);
      setData({ ...data, plan: res.blocks, planDate: today() });
      setNote(res.summary + (res.source === 'ai' ? ` • ${publicCoachBrand()}` : ' • Yerel yedek'));
      toast(res.source === 'ai' ? 'AI planı hazır' : 'Yerel koç planı hazır');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title"><h3>Günlük plan</h3></div>
        <p className="muted">
          {aiPlan
            ? 'Zor konu temposu, zamanlı set ve yanlış etiketleme. Giriş varsa plan sunucuda; yoksa yerel koç.'
            : 'Sunucu planı Pro veya deneme süresinde. Yerel üretim açık.'}
        </p>
        <div className="form-grid">
          <div className="field"><label>Günlük süre (dk)</label><input type="number" min={20} max={720} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} /></div>
          <div className="field">
            <label>Öncelik</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {foci.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" disabled={busy || !aiPlan} onClick={() => void make(true)}>{busy ? 'Hazırlanıyor…' : 'Sunucu ile plan'}</button>
          <button className="btn" type="button" disabled={busy} onClick={() => void make(false)}>Yerel üret</button>
          <button className="btn" type="button" onClick={() => {
            if (!data.plan.length) return toast('Önce plan oluştur.');
            setData(appendGeneratedTasks(data, data.plan.map((x) => ({
              id: uid('p_'),
              title: x.text,
              subject: 'Plan',
              minutes: x.minutes,
              priority: 'Normal',
              done: false,
              date: today(),
              origin: 'zorro' as const,
            }))));
            toast('Plan görevlerine aktarıldı');
          }}>Görevlere aktar</button>
        </div>
        {note ? <div className="success" style={{ marginTop: 12 }}>{note}</div> : null}
      </div>
      <div className="card">
        <div className="section-title"><h3>Bugünün planı</h3><span>{fmtDate(today())}</span></div>
        {data.plan.length ? data.plan.map((x, i) => (
          <div className="card" key={`${x.text}-${i}`} style={{ boxShadow: 'none', marginBottom: 10 }}>
            <h4>{i + 1}. Blok • {x.minutes} dk</h4>
            <div className="subject"><div className="subject-icon">{x.icon}</div><div><strong>{x.text}</strong><small className="muted"> Odaklan • süreyi tamamla</small></div></div>
          </div>
        )) : <div className="empty">Soldan plan üret.</div>}
      </div>
    </div>
  );
}
