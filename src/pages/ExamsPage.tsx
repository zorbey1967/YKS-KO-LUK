import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDate, today, uid } from '../lib/util';
import { suggestExamFromPhoto, type ExamPhotoDraft } from '../lib/examPhoto';
import { getStudentProgress } from '../lib/studentProgress';
import {
  academicPeriodLabel,
  autoExamTitle,
  examResultEntryOptions,
  getStudentEducationContext,
  writtenSubjectOptions,
  type ExamEntryOption,
} from '../lib/studentEducation';
import type { Exam, ExamSubjectNet } from '../lib/types';

const emptyDraft = (): ExamPhotoDraft => ({
  name: '', tyt: 0, ayt: 0, correct: 0, wrong: 0, blank: 0, note: '', subjects: [], raw: '',
});

export function ExamsPage() {
  const { data, setData, toast } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data]);
  const options = useMemo(() => examResultEntryOptions(ctx), [ctx]);
  const subjects = useMemo(() => writtenSubjectOptions(data), [data]);
  const [optionId, setOptionId] = useState(() => options[0]?.id || 'tyt');
  const option = options.find((o) => o.id === optionId) || options[0];
  const [subject, setSubject] = useState(subjects[0] || '');
  const [form, setForm] = useState(emptyDraft);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = Boolean(editId);
  const period = academicPeriodLabel(date ? new Date(`${date}T12:00:00`) : new Date());
  const autoName = option ? autoExamTitle(ctx, option, subject) : 'Deneme';
  const kpss = option?.scoreMode === 'kpss';
  const showTyt = option?.scoreMode === 'tyt' || option?.scoreMode === 'ayt' || option?.scoreMode === 'kpss' || option?.scoreMode === 'deneme' || option?.scoreMode === 'lgs';
  const showAyt = option?.scoreMode === 'ayt' || option?.scoreMode === 'kpss';
  const l1 = kpss ? 'GY net' : option?.scoreMode === 'lgs' ? 'LGS net' : option?.scoreMode === 'yazili' ? 'Puan / net' : 'TYT net';
  const l2 = kpss ? 'GK net' : 'AYT net';
  const ex = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));
  const progress = useMemo(() => getStudentProgress(data), [data]);

  function selectOption(o: ExamEntryOption) {
    setOptionId(o.id);
    if (o.needsSubject && !subject && subjects[0]) setSubject(subjects[0]);
  }

  function save() {
    const name = (form.name.trim() || autoName).trim() || 'Deneme';
    const noteParts = [form.note, period && option?.scoreMode === 'yazili' ? period : ''].filter(Boolean);
    const row: Exam = {
      id: editId || uid('e_'),
      name,
      date: date || today(),
      tyt: Math.max(0, Number(form.tyt) || 0),
      ayt: Math.max(0, Number(form.ayt) || 0),
      note: noteParts.join(' · '),
      correct: form.correct || undefined,
      wrong: form.wrong || undefined,
      blank: form.blank || undefined,
      subjects: form.subjects.filter((s) => s.name.trim()),
    };
    setData((prev) => ({
      ...prev,
      exams: editId ? prev.exams.map((e) => (e.id === editId ? row : e)) : [...prev.exams, row],
    }));
    setForm(emptyDraft());
    setPending(false);
    setEditId(null);
    toast(editId ? 'Deneme güncellendi' : 'Deneme kaydedildi');
  }

  function loadExam(x: Exam) {
    setEditId(x.id);
    setDate(x.date);
    setPending(true);
    setForm({
      name: x.name,
      tyt: x.tyt,
      ayt: x.ayt,
      correct: x.correct || 0,
      wrong: x.wrong || 0,
      blank: x.blank || 0,
      note: x.note,
      subjects: x.subjects || [],
      raw: '',
    });
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await suggestExamFromPhoto(file, data);
      if ('error' in res) {
        toast(res.error);
        return;
      }
      setForm({ ...res.draft, name: res.draft.name || autoName });
      setPending(true);
    } finally {
      setBusy(false);
    }
  }

  function patchSubject(i: number, next: Partial<ExamSubjectNet>) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s, n) => (n === i ? { ...s, ...next } : s)),
    }));
  }

  return (
    <>
      <div className="grid two">
        <div className="card">
          <div className="section-title"><h3>Deneme ekle</h3></div>
          <p className="muted" style={{ marginTop: 0 }}>
            {ctx.gradeLabel || 'Profil'}{ctx.fieldShort ? ` · ${ctx.fieldShort}` : ''}
            {period ? ` · ${period}` : ''}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              if (option?.needsSubject && !subject) return;
              save();
            }}
          >
            <div className="field">
              <label>Ne kaydediyorsun?</label>
              <div className="actions" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip-btn${optionId === o.id ? ' on' : ''}`}
                    onClick={() => selectOption(o)}
                  >{o.label}</button>
                ))}
              </div>
            </div>
            {option?.needsSubject ? (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Ders</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : null}
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Kayıt adı</label>
                <input value={pending && form.name ? form.name : autoName} readOnly={!pending} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field"><label>Tarih</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Fotoğraf (isteğe bağlı)</label>
                <input type="file" accept="image/*" disabled={busy} onChange={(e) => void onPhoto(e.target.files?.[0])} />
              </div>
              <div className="field"><label>Doğru</label><input type="number" value={form.correct || ''} onChange={(e) => setForm({ ...form, correct: Number(e.target.value) || 0 })} /></div>
              <div className="field"><label>Yanlış</label><input type="number" value={form.wrong || ''} onChange={(e) => setForm({ ...form, wrong: Number(e.target.value) || 0 })} /></div>
              <div className="field"><label>Boş</label><input type="number" value={form.blank || ''} onChange={(e) => setForm({ ...form, blank: Number(e.target.value) || 0 })} /></div>
              {showTyt || option?.scoreMode === 'yazili' ? (
                <div className="field"><label>{l1}</label><input type="number" step=".25" value={form.tyt || ''} onChange={(e) => setForm({ ...form, tyt: Number(e.target.value) || 0 })} /></div>
              ) : null}
              {showAyt ? (
                <div className="field"><label>{l2}</label><input type="number" step=".25" value={form.ayt || ''} onChange={(e) => setForm({ ...form, ayt: Number(e.target.value) || 0 })} /></div>
              ) : null}
            </div>
            {form.subjects.length ? form.subjects.map((s, i) => (
              <div className="form-grid" key={`${s.name}-${i}`} style={{ marginTop: 8 }}>
                <div className="field"><label>Ders</label><input value={s.name} onChange={(e) => patchSubject(i, { name: e.target.value })} /></div>
                <div className="field"><label>Net</label><input type="number" step=".25" value={s.net} onChange={(e) => patchSubject(i, { net: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>D</label><input type="number" value={s.correct ?? ''} onChange={(e) => patchSubject(i, { correct: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>Y</label><input type="number" value={s.wrong ?? ''} onChange={(e) => patchSubject(i, { wrong: Number(e.target.value) || 0 })} /></div>
                <div className="field"><label>B</label><input type="number" value={s.blank ?? ''} onChange={(e) => patchSubject(i, { blank: Number(e.target.value) || 0 })} /></div>
              </div>
            )) : null}
            {pending ? (
              <div className="notice" style={{ marginTop: 12 }}>
                <p>Şu sonuçları çıkardım, kontrol eder misin? Otomatik kaydedilmez.</p>
                <div className="actions">
                  <button className="btn primary" type="button" onClick={save}>Onayla</button>
                  <button className="btn secondary" type="button" onClick={() => setPending(false)}>Düzenle</button>
                </div>
              </div>
            ) : (
              <div className="actions">
                <button className="btn primary" type="submit" disabled={busy || (option?.needsSubject && !subject)}>
                  {busy ? 'Okunuyor…' : editing ? 'Güncelle' : '+ Kaydet'}
                </button>
                {editing ? (
                  <button className="btn secondary" type="button" onClick={() => { setEditId(null); setForm(emptyDraft()); }}>Vazgeç</button>
                ) : null}
              </div>
            )}
          </form>
        </div>
        <div className="card">
          <div className="section-title"><h3>Analiz</h3><span>{ex.length} deneme</span></div>
          <p>{progress.examFeedback.text}</p>
          {progress.insights.strengths.length ? <p className="muted">Güçlü: {progress.insights.strengths.join(', ')}</p> : null}
          {progress.insights.weaknesses.length ? <p className="muted">Zayıf: {progress.insights.weaknesses.join(', ')}</p> : null}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">
          <h3>Son denemeler</h3>
          <button className="btn danger" type="button" onClick={() => {
            if (confirm('Tüm deneme kayıtları silinsin mi?')) setData({ ...data, exams: [] });
          }}>Temizle</button>
        </div>
        {ex.length ? (
          <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>Deneme</th><th>{kpss ? 'GY' : 'Net'}</th><th>{showAyt || kpss ? (kpss ? 'GK' : 'AYT') : '—'}</th><th>D/Y/B</th><th /></tr></thead>
            <tbody>
              {ex.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.date)}</td>
                  <td>{x.name}</td>
                  <td><b>{x.tyt}</b></td>
                  <td>{x.ayt}</td>
                  <td>{x.correct != null ? `${x.correct}/${x.wrong ?? 0}/${x.blank ?? 0}` : (x.note || '-')}</td>
                  <td>
                    <button className="btn secondary" type="button" onClick={() => loadExam(x)}>Düzenle</button>
                    <button className="btn secondary" type="button" aria-label={`${x.name} kaydını sil`} onClick={() => {
                      if (!confirm('Bu deneme silinsin mi?')) return;
                      setData((prev) => ({ ...prev, exams: prev.exams.filter((e) => e.id !== x.id) }));
                    }}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : <div className="empty">Henüz deneme eklenmedi.</div>}
      </div>
    </>
  );
}
