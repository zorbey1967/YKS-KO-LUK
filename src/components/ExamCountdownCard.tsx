import { memo, useEffect, useState } from 'react';
import type { ExamTarget } from '../lib/types';
import { countdownKindLabel, remainingClock } from '../lib/countdown';

function useClock(exam: ExamTarget | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!exam) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [exam?.id, exam?.date, exam?.startTime]);
  return exam ? remainingClock(exam.date, exam.startTime, now, exam.endTime) : remainingClock('');
}

export const ExamCountdownCard = memo(function ExamCountdownCard({ exam }: { exam: ExamTarget }) {
  const c = useClock(exam);
  const kind = countdownKindLabel(exam.kind, exam.title);
  return (
    <div className={`exam-count exam-count--${c.phase}`}>
      <div className="exam-count-kicker">{exam.title}</div>
      <p className="exam-count-kind">{kind}</p>
      {c.phase === 'past' || c.phase === 'unset' ? (
        <div className="exam-count-done">{c.headline}</div>
      ) : c.phase === 'today' && c.hours === 0 && c.minutes === 0 && c.headline !== 'Kalan süre: BUGÜN' ? (
        <div className="exam-count-done">{c.headline}</div>
      ) : (
        <>
          <p className="exam-count-lead">SINAVA</p>
          <div className="exam-count-row">
            <div><strong>{c.days}</strong><span>GÜN</span></div>
            <div><strong>{c.hours}</strong><span>SAAT</span></div>
            <div><strong>{c.minutes}</strong><span>DAKİKA</span></div>
          </div>
          <p className="exam-count-foot">{c.headline === 'Yarın' ? 'YARIN' : 'KALDI'}</p>
        </>
      )}
      <div className="exam-count-bar" aria-hidden="true"><span style={{ width: `${urgencyPct(c.days, c.phase)}%` }} /></div>
    </div>
  );
});

function urgencyPct(days: number, phase: string) {
  if (phase === 'past' || phase === 'unset') return 100;
  if (phase === 'today') return 100;
  const span = 240;
  return Math.min(100, Math.round(((span - Math.min(span, days)) / span) * 100));
}
