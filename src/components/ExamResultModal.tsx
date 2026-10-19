import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ExamSubjectNet, ExamTarget } from '../lib/types';
import { getStudentEducationContext } from '../lib/studentEducation';
import {
  denemeSubjectRows,
  emptySubjectRows,
  examResultMode,
  findExamForTarget,
  isWrittenExamKind,
  subjectNetFromDyb,
  totalNetFromSubjects,
  upsertExamResult,
} from '../lib/examResultEntry';

/** Deneme kayıtlarında TYT / AYT seçimi (tür zaten TYT/AYT ise sabit). */
function initialDenemeMode(kind: string): 'tyt' | 'ayt' {
  const m = examResultMode(kind);
  if (m === 'ayt') return 'ayt';
  return 'tyt';
}

export function ExamResultModal({
  target,
  onClose,
}: {
  target: ExamTarget;
  onClose: () => void;
}) {
  const { data, setData, toast } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data]);
  const existing = findExamForTarget(data, target);
  const written = isWrittenExamKind(target.kind);
  const resultMode = examResultMode(target.kind);
  /** LGS/KPSS/sabit TYT|AYT: türü TYT’ye çevirme. */
  const kindLocked = written
    || resultMode === 'lgs'
    || resultMode === 'kpss'
    || /^(tyt|ayt)\b/i.test(String(target.kind || '').trim());
  const [denemeMode, setDenemeMode] = useState<'tyt' | 'ayt'>(() => initialDenemeMode(target.kind));
  const effectiveKind = kindLocked
    ? target.kind
    : (denemeMode === 'ayt' ? `AYT ${ctx.fieldShort || ''}`.trim() : 'TYT');

  const [score, setScore] = useState(() => (existing ? String(existing.tyt || '') : ''));
  const [subjects, setSubjects] = useState<ExamSubjectNet[]>(() => {
    if (existing?.subjects?.length) return existing.subjects.map((s) => ({ ...s }));
    return emptySubjectRows(denemeSubjectRows(ctx, kindLocked ? target.kind : 'TYT'));
  });

  const total = useMemo(() => totalNetFromSubjects(subjects), [subjects]);
  const showTytAytToggle = !kindLocked && (ctx.showsTyt || ctx.showsAyt);
  const denemeBandLabel = resultMode === 'lgs'
    ? 'LGS'
    : resultMode === 'kpss'
      ? 'KPSS'
      : (/ayt/i.test(effectiveKind) ? 'AYT' : 'TYT');

  function switchMode(mode: 'tyt' | 'ayt') {
    setDenemeMode(mode);
    const kind = mode === 'ayt' ? `AYT ${ctx.fieldShort || ''}`.trim() : 'TYT';
    setSubjects(emptySubjectRows(denemeSubjectRows(ctx, kind)));
  }

  function patchRow(i: number, next: Partial<ExamSubjectNet>) {
    setSubjects((rows) => rows.map((r, n) => {
      if (n !== i) return r;
      const merged = { ...r, ...next };
      const c = Number(merged.correct) || 0;
      const w = Number(merged.wrong) || 0;
      return { ...merged, net: subjectNetFromDyb(c, w) };
    }));
  }

  function save() {
    if (written) {
      if (!score.trim()) {
        toast('Puan gir.');
        return;
      }
      const puan = Math.max(0, Number(score) || 0);
      setData((prev) => upsertExamResult(prev, target, { tyt: puan, ayt: 0, subjects: [], note: 'Yazılı puan' }));
      toast('Yazılı sonucu kaydedildi');
      onClose();
      return;
    }
    const isAyt = /ayt/i.test(effectiveKind);
    setData((prev) => upsertExamResult(prev, { ...target, kind: effectiveKind }, {
      subjects,
      tyt: isAyt ? (existing?.tyt || 0) : total,
      ayt: isAyt ? total : (existing?.ayt || 0),
      correct: subjects.reduce((a, s) => a + (Number(s.correct) || 0), 0),
      wrong: subjects.reduce((a, s) => a + (Number(s.wrong) || 0), 0),
      blank: subjects.reduce((a, s) => a + (Number(s.blank) || 0), 0),
    }));
    toast('Sınav sonucu kaydedildi');
    onClose();
  }

  return (
    <div className="modal" role="dialog" aria-label="Sınav sonucu">
      <div className="modal-box" style={{ width: 'min(640px,100%)' }}>
        <h3>Sınav sonucu</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          <b>{target.title}</b> · {target.date}
        </p>
        {written ? (
          <div className="field">
            <label>Puan</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.25"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Örn. 85"
              autoFocus
            />
          </div>
        ) : (
          <>
            {showTytAytToggle ? (
              <div className="actions" style={{ marginBottom: 8 }}>
                <button type="button" className={`chip-btn${denemeMode === 'tyt' ? ' on' : ''}`} onClick={() => switchMode('tyt')}>TYT</button>
                {ctx.showsAyt ? (
                  <button type="button" className={`chip-btn${denemeMode === 'ayt' ? ' on' : ''}`} onClick={() => switchMode('ayt')}>
                    AYT{ctx.fieldShort ? ` ${ctx.fieldShort}` : ''}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>{denemeBandLabel} ders netleri</p>
            )}
            <p className="muted">Her ders için doğru / yanlış / boş gir; netler otomatik hesaplanır.</p>
            {subjects.map((s, i) => (
              <div className="form-grid" key={s.name} style={{ marginTop: 8 }}>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>{s.name}</label></div>
                <div className="field"><label>Doğru</label><input type="number" min={0} value={s.correct ?? ''} onChange={(e) => patchRow(i, { correct: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>Yanlış</label><input type="number" min={0} value={s.wrong ?? ''} onChange={(e) => patchRow(i, { wrong: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>Boş</label><input type="number" min={0} value={s.blank ?? ''} onChange={(e) => patchRow(i, { blank: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>Net</label><input readOnly value={s.net} aria-readonly /></div>
              </div>
            ))}
            <p style={{ marginTop: 12 }}><b>Toplam net:</b> {total}</p>
          </>
        )}
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn primary" type="button" onClick={save}>Kaydet</button>
          <button className="btn secondary" type="button" onClick={onClose}>Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
