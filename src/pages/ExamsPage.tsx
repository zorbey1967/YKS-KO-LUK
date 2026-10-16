import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../lib/util';
import { getStudentProgress } from '../lib/studentProgress';
import { getStudentEducationContext } from '../lib/studentEducation';
import { ExamResultModal } from '../components/ExamResultModal';
import type { ExamTarget } from '../lib/types';

export function ExamsPage() {
  const { data } = useApp();
  const ctx = useMemo(() => getStudentEducationContext(data), [data]);
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const targets = (data.examTargets || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const [resultTarget, setResultTarget] = useState<ExamTarget | null>(null);
  const recorded = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h3>Sınavlarım</h3>
          <span>{ctx.gradeLabel}{ctx.fieldShort ? ` · ${ctx.fieldShort}` : ''}</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Atanmış sınavların listesi. Sonucu girmek için sınav adına veya tarihe tıkla.
        </p>
        {targets.length ? targets.map((t) => (
          <button
            key={t.id}
            type="button"
            className="exam-row"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setResultTarget(t)}
          >
            <div>
              <b>{t.title}</b>
              <small className="muted">{t.date}</small>
            </div>
          </button>
        )        ) : (
          <div className="empty">Atanmış sınav yok.</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Kayıtlı sonuçlar</h3><span>{recorded.length}</span></div>
        <p>{progress.examFeedback.text}</p>
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
        )) : <div className="empty">Henüz sonuç yok.</div>}
      </div>

      {resultTarget ? (
        <ExamResultModal target={resultTarget} onClose={() => setResultTarget(null)} />
      ) : null}
    </>
  );
}
