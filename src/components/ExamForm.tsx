import { useState } from 'react';
import type { ExamTarget } from '../lib/types';
import { EXAM_KIND_OPTIONS, addMinutesToTime, withExamTimes } from '../lib/examTargets';
import { istanbulToday } from '../lib/meeting';

export function ExamForm({ draft, onClose, onSave }: { draft: ExamTarget; onClose: () => void; onSave: (row: ExamTarget) => void }) {
  const [row, setRow] = useState(draft);
  const [customKind, setCustomKind] = useState(() => EXAM_KIND_OPTIONS.includes(draft.kind as typeof EXAM_KIND_OPTIONS[number]) ? '' : draft.kind);
  const today = istanbulToday();
  const past = row.date && row.date < today;
  function patch(p: Partial<ExamTarget>) { setRow((r) => ({ ...r, ...p })); }
  return (
    <div className="modal" role="dialog">
      <div className="modal-box" style={{ width: 'min(640px,100%)' }}>
        <h3>{draft.id ? 'Sınavı düzenle' : 'Sınav ekle'}</h3>
        <div className="form-grid">
          <div className="field"><label>Sınav adı</label><input value={row.title} onChange={(e) => patch({ title: e.target.value })} placeholder="AYT Matematik Denemesi" /></div>
          <div className="field">
            <label>Sınav türü</label>
            <select value={customKind ? 'Diğer' : row.kind} onChange={(e) => {
              if (e.target.value === 'Diğer') { setCustomKind(row.kind === 'Diğer' ? '' : row.kind); patch({ kind: 'Diğer' }); }
              else { setCustomKind(''); patch({ kind: e.target.value, title: row.title || e.target.value }); }
            }}>
              {EXAM_KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {customKind || row.kind === 'Diğer' ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Özel tür</label><input value={customKind} onChange={(e) => { setCustomKind(e.target.value); patch({ kind: e.target.value || 'Diğer' }); }} /></div>
          ) : null}
          <div className="field"><label>Tarih</label><input type="date" value={row.date} onChange={(e) => patch({ date: e.target.value })} /></div>
          <div className="field"><label>Saat (opsiyonel)</label><input type="time" value={row.startTime} onChange={(e) => patch({ startTime: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Ders / alan (opsiyonel)</label><input value={row.subject || ''} onChange={(e) => patch({ subject: e.target.value })} placeholder="Matematik" /></div>
          <div className="field"><label>Süre (dakika)</label><input type="number" min={0} max={600} value={row.durationMin || ''} placeholder="ör. 165" onChange={(e) => {
            const durationMin = Math.max(0, Math.min(600, Number(e.target.value) || 0));
            const endTime = durationMin && row.startTime ? addMinutesToTime(row.startTime, durationMin) : row.endTime;
            patch({ durationMin, endTime });
          }} /></div>
          <div className="field"><label>Bitiş saati</label><input type="time" value={row.endTime} onChange={(e) => patch({ endTime: e.target.value })} /></div>
          <div className="field">
            <label>Öncelik</label>
            <select value={row.priority} onChange={(e) => patch({ priority: e.target.value as ExamTarget['priority'] })}>
              <option value="dusuk">Düşük</option>
              <option value="normal">Normal</option>
              <option value="yuksek">Yüksek</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Açıklama</label><textarea rows={2} value={row.note} onChange={(e) => patch({ note: e.target.value })} /></div>
        </div>
        {past ? <p className="muted">Bu tarih geçmiş. Kayıt arşivde görünür.</p> : null}
        <label className="exam-check"><input type="checkbox" checked={row.origin === 'official' || row.isPrimary} onChange={(e) => patch({ origin: e.target.checked ? 'official' : 'user', isPrimary: e.target.checked })} /> Resmi / ana sınav (YKS, LGS, KPSS — denemelerden ayrı)</label>
        <label className="exam-check"><input type="checkbox" checked={row.notify} onChange={(e) => patch({ notify: e.target.checked })} /> Bildirimler (7 / 3 / 1 gün ve sınav günü)</label>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => {
            const kind = (customKind || row.kind).trim() || 'Diğer';
            const title = row.title.trim() || kind;
            if (!row.date) return;
            onSave(withExamTimes({ ...row, kind, title, origin: row.origin || (row.isPrimary ? 'official' : 'user') }));
          }}>Kaydet</button>
          <button className="btn" type="button" onClick={onClose}>Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
