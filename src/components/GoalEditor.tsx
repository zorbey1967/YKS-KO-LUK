import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { GRADES } from '../lib/curriculum';
import type { AppData } from '../lib/types';
import { applyGoal, clampAge, DEPT_PRESETS, TRACKS, type GoalDraft } from '../lib/goal';
import { typicalAge } from '../lib/stage';

function fromState(name: string, data: AppData): GoalDraft {
  return {
    name,
    grade: data.grade,
    age: clampAge(data.age || typicalAge(data.grade)),
    track: data.track,
    dept: data.dept,
    rank: data.rank,
    weekHours: data.weekHours,
    examDate: data.examDate,
  };
}

export function GoalEditor({ compact }: { compact?: boolean }) {
  const { data, setData, profile, saveProfile, toast } = useApp();
  const [draft, setDraft] = useState<GoalDraft>(() => fromState(profile?.name || '', data));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setDraft(fromState(profile?.name || '', data));
  }, [data.grade, data.age, data.track, data.dept, data.rank, data.weekHours, data.examDate, profile?.name, dirty]);

  function patch(p: Partial<GoalDraft>) {
    setDirty(true);
    setDraft((d) => ({ ...d, ...p }));
  }

  function save() {
    setData((d) => applyGoal(d, draft));
    void saveProfile(draft.name.trim());
    setDirty(false);
    toast('Hedef ve yaş kaydedildi');
  }

  const suggested = typicalAge(draft.grade);

  return (
    <div className="card">
      <div className="section-title">
        <h3>🎯 Hedefi ve yaşı değiştir</h3>
        {dirty ? <span className="chip">Kaydedilmedi</span> : <span>Kayıtlı</span>}
      </div>
      <div className="form-grid">
        <div className="field"><label>Ad Soyad</label><input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Adın" /></div>
        <div className="field">
          <label>Sınıf / statü</label>
          <select value={draft.grade} onChange={(e) => {
            const grade = e.target.value;
            patch({ grade, track: grade === 'KPSS Adayı' ? 'KPSS' : draft.track });
          }}>
            {GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Yaş</label>
          <div className="stepper" style={{ width: '100%' }}>
            <button type="button" onClick={() => patch({ age: clampAge(draft.age - 1) })} aria-label="Yaşı azalt">−</button>
            <input type="number" min={6} max={65} value={draft.age} onChange={(e) => patch({ age: clampAge(Number(e.target.value) || draft.age) })} />
            <button type="button" onClick={() => patch({ age: clampAge(draft.age + 1) })} aria-label="Yaşı artır">+</button>
          </div>
          <button className="btn secondary" type="button" style={{ marginTop: 8 }} onClick={() => patch({ age: suggested })}>
            Sınıfa göre önerilen yaş: {suggested}
          </button>
        </div>
        <div className="field">
          <label>Alan</label>
          <select value={draft.track} onChange={(e) => patch({ track: e.target.value })}>
            {TRACKS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: compact ? undefined : '1 / -1' }}>
          <label>Hedef bölüm / kadro</label>
          <input value={draft.dept} onChange={(e) => patch({ dept: e.target.value })} placeholder="ör. Hukuk, Tıp, KPSS / Kamu" />
          <div className="chip-row" style={{ marginTop: 8 }}>
            {DEPT_PRESETS.map((d) => (
              <button key={d} className={`chip ${draft.dept === d ? 'on' : ''}`} type="button" onClick={() => patch({ dept: d })}>{d}</button>
            ))}
          </div>
        </div>
        <div className="field"><label>Hedef sıralama / puan sırası</label><input type="number" min={0} value={draft.rank} onChange={(e) => patch({ rank: Number(e.target.value) || 0 })} /></div>
        <div className="field"><label>Haftalık hedef (saat)</label><input type="number" min={1} value={draft.weekHours} onChange={(e) => patch({ weekHours: Number(e.target.value) || 1 })} /></div>
        <div className="field"><label>Sınav tarihi</label><input type="date" value={draft.examDate} onChange={(e) => patch({ examDate: e.target.value })} /></div>
      </div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={save}>💾 Kaydet</button>
        <button className="btn" type="button" disabled={!dirty} onClick={() => { setDraft(fromState(profile?.name || '', data)); setDirty(false); }}>Vazgeç</button>
      </div>
    </div>
  );
}
