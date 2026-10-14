import { useState } from 'react';
import type { ScheduleDay } from '../lib/types';
import { WEEK_DAYS, type WeekPlan } from '../lib/weekPlan';

export function WeekPlanEditor({
  plan,
  editable,
  onSave,
  busy,
}: {
  plan: WeekPlan;
  editable: boolean;
  onSave: (next: WeekPlan) => void;
  busy?: boolean;
}) {
  const [days, setDays] = useState<ScheduleDay[]>(plan.days.length ? plan.days : WEEK_DAYS.map((day) => ({ day, blocks: [] })));
  const [weekHours, setWeekHours] = useState(String(plan.weekHours || ''));
  const [notes, setNotes] = useState(plan.notes);

  function setBlock(di: number, field: 'title' | 'minutes', value: string) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== di) return d;
      const block = d.blocks[0] || { title: '', minutes: 0, icon: '📘' };
      return { ...d, blocks: [{ ...block, [field]: field === 'minutes' ? Number(value) || 0 : value }] };
    }));
  }

  return (
    <div>
      {!editable ? <p className="notice">Bu haftalık planı koçun yönetiyor. Hedefleri değiştiremezsin; gerçekleşen süreyi görevlerden işlersin.</p> : null}
      <div className="field"><label>Bu hafta ayırabildiğin toplam saat</label><input type="number" min={0} max={80} value={weekHours} disabled={!editable} onChange={(e) => setWeekHours(e.target.value)} /></div>
      <div className="field"><label>Eksikler ve kısa not</label><textarea value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} /></div>
      {days.map((d, i) => (
        <div className="form-grid" key={d.day} style={{ marginTop: 8 }}>
          <div className="field"><label>{d.day}</label><input value={d.blocks[0]?.title || ''} disabled={!editable} onChange={(e) => setBlock(i, 'title', e.target.value)} placeholder="Ders / konu" /></div>
          <div className="field"><label>Hedef dk</label><input type="number" min={0} max={600} value={d.blocks[0]?.minutes || 0} disabled={!editable} onChange={(e) => setBlock(i, 'minutes', e.target.value)} /></div>
        </div>
      ))}
      {editable ? (
        <div className="actions">
          <button className="btn primary" type="button" disabled={busy} onClick={() => onSave({ ...plan, days, weekHours: Number(weekHours) || 0, notes, updatedAt: new Date().toISOString() })}>
            {busy ? 'Kaydediliyor…' : 'Programı kaydet'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
