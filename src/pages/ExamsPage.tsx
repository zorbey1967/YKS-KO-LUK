import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../lib/util';
import { getStudentProgress } from '../lib/studentProgress';
import { getStudentEducationContext } from '../lib/studentEducation';
import { examStatus } from '../lib/examTargets';
import { ExamListRow } from '../components/ExamListRow';
import { useExamDialogs } from '../components/ExamDialogs';

/** Denemeler: takvimdeki sınavlar (aynı kayıt) ve girilen sonuçlar. Sınav ekleme Takvim akışıyla aynıdır. */
export function ExamsPage() {
  const { data, go } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data.grade, data.age, data.track]);
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const dialogs = useExamDialogs();
  const targets = data.examTargets || [];
  const waiting = targets.filter((t) => examStatus(data, t) === 'awaiting_result').sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = targets.filter((t) => ['upcoming', 'today'].includes(examStatus(data, t))).sort((a, b) => a.date.localeCompare(b.date));
  const recorded = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h3>Sınavlarım</h3>
          <span>{[ctx.gradeLabel, ctx.fieldShort].filter(Boolean).join(' · ')}</span>
        </div>
        {waiting.length ? (
          <div className="cal-group">
            <h4>Sonuç bekleyenler</h4>
            {waiting.map((t) => <ExamListRow key={t.id} exam={t} onOpen={dialogs.openDetail} />)}
          </div>
        ) : null}
        <div className="cal-group">
          <h4>Yaklaşan</h4>
          {upcoming.length
            ? upcoming.map((t) => <ExamListRow key={t.id} exam={t} onOpen={dialogs.openDetail} />)
            : <p className="muted">Yaklaşan sınav yok.</p>}
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => dialogs.openNew()}>+ Sınav ekle</button>
          <button className="btn secondary" type="button" onClick={() => go('calendar')}>Takvimde gör</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Kayıtlı sonuçlar</h3><span>{recorded.length}</span></div>
        <p className="muted" style={{ marginTop: 0 }}>{progress.examFeedback.text}</p>
        {progress.insights.strengths.length ? <p className="muted">Güçlü: {progress.insights.strengths.join(', ')}</p> : null}
        {recorded.length ? recorded.map((x) => (
          <div className="plan-item" key={x.id}>
            <span>
              {x.name}
              <br />
              <small className="muted">{fmtDate(x.date)}{x.kind ? ` · ${x.kind}` : ''}{x.subjects?.length ? ` · ${x.subjects.map((s) => `${s.name} ${s.net}`).join(', ')}` : ''}</small>
            </span>
            <b>{x.tyt}{x.ayt ? ` / ${x.ayt}` : ''}</b>
          </div>
        )) : <div className="empty">Henüz sonuç yok. Sınava tıklayıp “Sonuç ekle” ile gir.</div>}
      </div>
      {dialogs.element}
    </>
  );
}
