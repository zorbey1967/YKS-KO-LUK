import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { remainingClock } from '../lib/countdown';
import { primaryExam } from '../lib/examTargets';

export function ExamHomeWidget() {
  const { data, go, profile } = useApp();
  const exam = useMemo(() => primaryExam(data.examTargets || []), [data.examTargets]);
  if (profile?.role === 'coach') return null;
  if (!exam) return null;
  const c = remainingClock(exam.date, exam.startTime, Date.now(), exam.endTime);
  return (
    <div className="card exam-home-widget" style={{ marginTop: 16 }}>
      <div className="section-title">
      <h3>{`${exam.title}’ye ${c.phase === 'past' ? 'sınav tamamlandı' : c.label}`}</h3>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{c.headline}</p>
      <button className="btn primary" type="button" onClick={() => go('schedule')}>Sınav Merkezine Git</button>
    </div>
  );
}
