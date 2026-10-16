import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ExamTarget } from '../lib/types';
import { withExamTimes } from '../lib/examTargets';
import { istanbulToday } from '../lib/meeting';
import {
  academicPeriodLabel,
  autoExamTitle,
  calendarExamEntryOptions,
  getStudentEducationContext,
  writtenSubjectOptions,
  type ExamEntryOption,
} from '../lib/studentEducation';

function matchOption(options: ExamEntryOption[], kind: string, title: string): ExamEntryOption {
  const hit = options.find((o) => o.kind === kind || title.includes(o.kind) || o.label === kind);
  return hit || options[0];
}

export function ExamForm({ draft, onClose, onSave }: { draft: ExamTarget; onClose: () => void; onSave: (row: ExamTarget) => void }) {
  const { data } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data]);
  const options = useMemo(() => calendarExamEntryOptions(ctx), [ctx]);
  const subjects = useMemo(() => writtenSubjectOptions(data), [data]);
  const [row, setRow] = useState(draft);
  const [optionId, setOptionId] = useState(() => matchOption(options, draft.kind, draft.title).id);
  const option = options.find((o) => o.id === optionId) || options[0];
  const today = istanbulToday();
  const past = row.date && row.date < today;
  const period = academicPeriodLabel(row.date ? new Date(`${row.date}T12:00:00`) : new Date());

  function patch(p: Partial<ExamTarget>) {
    setRow((r) => ({ ...r, ...p }));
  }

  function selectOption(id: string) {
    const next = options.find((o) => o.id === id) || options[0];
    setOptionId(next.id);
    const subject = next.needsSubject ? (row.subject || subjects[0] || '') : '';
    patch({
      kind: next.kind,
      subject: next.needsSubject ? subject : '',
      title: autoExamTitle(ctx, next, subject),
      startTime: '',
      endTime: '',
      durationMin: 0,
    });
  }

  function selectSubject(subject: string) {
    if (!option) return;
    patch({
      subject,
      title: autoExamTitle(ctx, option, subject),
      kind: option.kind,
    });
  }

  return (
    <div className="modal" role="dialog">
      <div className="modal-box" style={{ width: 'min(560px,100%)' }}>
        <h3>{draft.id ? 'Sınavı düzenle' : 'Sınavımı kaydet'}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {ctx.gradeLabel || 'Profil'}{ctx.fieldShort ? ` · ${ctx.fieldShort}` : ''}
          {period ? ` · ${period}` : ''}
        </p>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Ne sınavın var?</label>
            <div className="actions" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`chip-btn${optionId === o.id ? ' on' : ''}`}
                  onClick={() => selectOption(o.id)}
                >{o.label}</button>
              ))}
            </div>
          </div>
          {option?.needsSubject ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Ders</label>
              <select value={row.subject || ''} onChange={(e) => selectSubject(e.target.value)}>
                <option value="">Ders seç</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : null}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Sınav</label>
            <input
              value={row.title || (option ? autoExamTitle(ctx, option, row.subject) : '')}
              readOnly
              aria-readonly
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Tarih</label>
            <input type="date" value={row.date} onChange={(e) => patch({ date: e.target.value })} />
          </div>
        </div>
        {past ? <p className="muted">Bu tarih geçmiş. Kayıt arşivde görünür.</p> : null}
        <label className="exam-check">
          <input
            type="checkbox"
            checked={row.origin === 'official' || row.isPrimary}
            onChange={(e) => patch({ origin: e.target.checked ? 'official' : 'user', isPrimary: e.target.checked })}
          />
          Ana hedef sınavım (sayaç)
        </label>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => {
            if (!option || !row.date) return;
            if (option.needsSubject && !String(row.subject || '').trim()) return;
            const title = autoExamTitle(ctx, option, row.subject);
            const note = period && !String(row.note || '').includes(period)
              ? [row.note, period].filter(Boolean).join(' · ')
              : row.note;
            onSave(withExamTimes({
              ...row,
              kind: option.kind,
              title,
              note,
              subject: option.needsSubject ? row.subject : '',
              startTime: '',
              endTime: '',
              durationMin: 0,
              notify: true,
              origin: row.origin || (row.isPrimary ? 'official' : 'user'),
            }));
          }}>Kaydet</button>
          <button className="btn" type="button" onClick={onClose}>Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
