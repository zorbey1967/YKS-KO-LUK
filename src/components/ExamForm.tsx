import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ExamTarget } from '../lib/types';
import { examKindIcon, examKindTone, splitTopicInput } from '../lib/examTargets';
import { istanbulToday } from '../lib/meeting';
import { curriculumForStudent } from '../lib/curriculum';
import {
  AYT_FIELDS,
  autoExamTitle,
  calendarExamEntryOptions,
  getStudentEducationContext,
  matchExamEntryOption,
  writtenSubjectOptions,
} from '../lib/studentEducation';

/**
 * Tek sınav formu (Takvim, Ana Sayfa, Denemeler ve ZORRO aynı kaydı kullanır).
 * Akış: tür → ad → tarih → (isteğe bağlı konular) → kaydet. Saat, süre, bitiş saati yok.
 * Türler sınıf/yaşa göre gelir (studentEducation.calendarExamEntryOptions).
 */
export function ExamForm({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: ExamTarget;
  onClose: () => void;
  onSave: (row: ExamTarget) => void;
  onDelete?: () => void;
}) {
  const { data } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data.grade, data.age, data.track]);
  const options = useMemo(() => calendarExamEntryOptions(ctx), [ctx]);
  const subjects = useMemo(() => writtenSubjectOptions(data), [data.grade, data.track]);
  const editing = Boolean(draft.id);
  const [optionId, setOptionId] = useState(() => (draft.kind && editing ? matchExamEntryOption(options, draft.kind).id : options[0].id));
  const baseOption = options.find((o) => o.id === optionId) || options[0];
  // AYT seçilip öğrencinin alanı kayıtlı değilse alan sorulur (AYT SAY / EA / SÖZ / DİL).
  const [aytField, setAytField] = useState(() => (/^AYT\s+(\S+)/.exec(draft.kind || '')?.[1] || ''));
  const needsAytField = baseOption.id === 'ayt' && baseOption.kind === 'AYT';
  const option = needsAytField && aytField
    ? { ...baseOption, kind: `AYT ${aytField}`, label: `AYT ${aytField}` }
    : baseOption;
  const [subject, setSubject] = useState(draft.subject || '');
  const [title, setTitle] = useState(() => draft.title || autoExamTitle(ctx, option, draft.subject || ''));
  const [titleTouched, setTitleTouched] = useState(() => editing && draft.title !== autoExamTitle(ctx, option, draft.subject || ''));
  const [date, setDate] = useState(draft.date || istanbulToday());
  const [topics, setTopics] = useState<string[]>(draft.topics || []);
  const [topicText, setTopicText] = useState('');
  const [primary, setPrimary] = useState(Boolean(draft.isPrimary));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = istanbulToday();

  const suggestions = useMemo(() => {
    if (!subject) return [];
    const curr = curriculumForStudent(data.grade, data.track);
    const exact = curr[subject] || [];
    return exact.filter((t) => !topics.some((x) => x.toLocaleLowerCase('tr-TR') === t.toLocaleLowerCase('tr-TR'))).slice(0, 8);
  }, [subject, topics, data.grade, data.track]);

  function pickOption(id: string) {
    const next = options.find((o) => o.id === id) || options[0];
    setOptionId(next.id);
    const nextSubject = next.needsSubject ? subject : '';
    if (!next.needsSubject) setSubject('');
    if (!titleTouched) setTitle(autoExamTitle(ctx, next, nextSubject));
    setError('');
  }

  function pickSubject(value: string) {
    setSubject(value);
    if (!titleTouched) setTitle(autoExamTitle(ctx, option, value));
  }

  function addTopics(raw: string) {
    const extra = splitTopicInput(raw);
    if (!extra.length) return;
    setTopics((cur) => splitTopicInput([...cur, ...extra].join(',')));
    setTopicText('');
  }

  function save() {
    const name = title.trim() || autoExamTitle(ctx, option, subject).trim();
    if (!name) return setError(option.freeTitle ? 'Sınavın adını yaz.' : 'Sınav adı gerekli.');
    if (needsAytField && !aytField) return setError('AYT alanını seç.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Tarih seç.');
    const pending = topicText.trim() ? splitTopicInput([...topics, topicText].join(',')) : topics;
    onSave({
      ...draft,
      kind: option.kind,
      title: name.slice(0, 80),
      subject: option.needsSubject ? subject.trim().slice(0, 80) : '',
      date,
      topics: pending,
      startTime: '',
      endTime: '',
      durationMin: 0,
      isPrimary: primary,
      origin: primary ? 'official' : (draft.origin === 'official' && draft.isPrimary ? 'user' : draft.origin || 'user'),
      notify: true,
    });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={editing ? 'Sınavı düzenle' : 'Sınav ekle'} onClick={onClose}>
      <div className="modal-box exam-form" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <h3>{editing ? 'Sınavı düzenle' : 'Sınav ekle'}</h3>
          <span>{[ctx.gradeLabel, ctx.isUniversity ? '' : ctx.fieldShort, ctx.periodLabel].filter(Boolean).join(' · ') || 'Hesabım’dan sınıfını seç'}</span>
        </div>

        <fieldset className="exam-form-step">
          <legend>Tür</legend>
          <div className="chip-row" role="radiogroup" aria-label="Sınav türü">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={optionId === o.id}
                className={`chip-btn exam-kind-chip tone-${examKindTone(o.kind)}${optionId === o.id ? ' on' : ''}`}
                onClick={() => pickOption(o.id)}
              ><span aria-hidden="true">{examKindIcon(o.kind)} </span>{o.label}</button>
            ))}
          </div>
        </fieldset>

        {needsAytField ? (
          <fieldset className="exam-form-step">
            <legend>AYT alanı</legend>
            <div className="chip-row" role="radiogroup" aria-label="AYT alanı">
              {AYT_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={aytField === f}
                  className={`chip-btn exam-kind-chip tone-ayt${aytField === f ? ' on' : ''}`}
                  onClick={() => {
                    setAytField(f);
                    if (!titleTouched) setTitle(`AYT ${f} Denemesi`);
                  }}
                >{f}</button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {option.needsSubject ? (
          <div className="field">
            <label htmlFor="exam-subject">Ders <span className="muted">(isteğe bağlı)</span></label>
            {option.subjectInput === 'select' && subjects.length ? (
              <select id="exam-subject" value={subject} onChange={(e) => pickSubject(e.target.value)}>
                <option value="">Ders seç</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input id="exam-subject" value={subject} maxLength={80} placeholder="Örn. Analiz I" onChange={(e) => pickSubject(e.target.value)} />
            )}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="exam-title">Ad</label>
          <input
            id="exam-title"
            value={title}
            maxLength={80}
            placeholder={option.freeTitle ? 'Örn. Bursluluk sınavı' : ''}
            autoFocus={option.freeTitle}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); setError(''); }}
          />
        </div>

        <div className="field">
          <label htmlFor="exam-date">Tarih</label>
          <input id="exam-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(''); }} />
          {date && date < today ? <small className="muted">Geçmiş tarih: sınav “sonuç bekliyor” olarak görünür.</small> : null}
        </div>

        <div className="field">
          <label htmlFor="exam-topics">Konular <span className="muted">(isteğe bağlı)</span></label>
          {topics.length ? (
            <div className="chip-row exam-topic-tags">
              {topics.map((t) => (
                <button key={t} type="button" className="chip" aria-label={`${t} konusunu çıkar`} onClick={() => setTopics((cur) => cur.filter((x) => x !== t))}>
                  {t} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            id="exam-topics"
            value={topicText}
            placeholder="Virgülle ayır: Türev, İntegral"
            onChange={(e) => setTopicText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTopics(topicText);
              }
            }}
            onBlur={() => addTopics(topicText)}
          />
          {suggestions.length ? (
            <div className="chip-row exam-topic-suggest" aria-label="Önerilen konular">
              {suggestions.map((t) => (
                <button key={t} type="button" className="chip-btn" onClick={() => addTopics(t)}>+ {t}</button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="exam-check">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
          Hedef sınavım (ana sayfada geri sayım)
        </label>

        {error ? <p className="notice" role="alert">{error}</p> : null}

        <div className="actions">
          <button className="btn primary" type="button" onClick={save}>Kaydet</button>
          <button className="btn" type="button" onClick={onClose}>Vazgeç</button>
          {editing && onDelete ? (
            confirmDelete ? (
              <button className="btn danger" type="button" onClick={onDelete}>Evet, sil</button>
            ) : (
              <button className="btn danger exam-form-delete" type="button" onClick={() => setConfirmDelete(true)}>Sil</button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
