import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { nextStudySuggestion } from '../lib/studySuggest';
import { setTimerIntent } from '../lib/studyTimer';
import { setBankJump } from '../lib/practice';
import { jumpFromTracker } from '../lib/practice';
import { snoozeReview } from '../lib/spacedReview';
import { today } from '../lib/util';
import { kindLabel, type StudyKind } from '../lib/studyTimer';

export function StudySuggestCard() {
  const { data, setData, go } = useApp();
  const todayKey = today();
  const rec = useMemo(() => nextStudySuggestion(data, todayKey), [data, todayKey]);

  function start() {
    if (rec.action === 'onboard') {
      go('questionbank');
      return;
    }
    if (rec.action === 'bank') {
      const jump = rec.level
        ? { level: rec.level, subject: rec.subject || null, topic: rec.topic || null, mode: rec.questionId ? 'wrong' as const : 'normal' as const }
        : jumpFromTracker(data.grade, rec.subject, rec.topic);
      setBankJump({ ...jump, mode: rec.questionId ? 'wrong' : jump.mode });
      go('questionbank');
      return;
    }
    setTimerIntent({
      kind: rec.kind === 'onboard' ? 'free' : rec.kind as StudyKind,
      subject: rec.subject || 'Odak',
      topic: rec.topic,
      minutes: rec.minutes,
      taskId: rec.taskId,
      source: 'suggest',
    });
    go('timer');
  }

  return (
    <div className="card suggest-card">
      <div className="section-title"><h3>Şimdi ne çalışmalıyım?</h3></div>
      {rec.kind === 'onboard' ? (
        <p className="muted" style={{ marginTop: 0 }}>{rec.reason}</p>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            <b>{rec.topic || rec.subject}</b>
            {rec.topic && rec.subject ? <span className="muted"> • {rec.subject}</span> : null}
          </p>
          <p className="muted">
            {kindLabel(rec.kind as StudyKind)} • ~{rec.minutes} dk
          </p>
          <p>{rec.reason}</p>
          {rec.evidence.length ? (
            <ul className="suggest-evidence">
              {rec.evidence.map((e) => (
                <li key={`${e.kind}:${e.id}`}>{e.label}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <div className="actions">
        <button className="btn primary" type="button" onClick={start}>
          {rec.action === 'onboard' ? 'Konu seç / kısa test' : rec.action === 'bank' ? 'Soruyu aç' : 'Görevi başlat'}
        </button>
        {rec.reviewId ? (
          <button
            className="btn secondary"
            type="button"
            onClick={() => setData(snoozeReview(data, rec.reviewId!, todayKey, 1))}
          >
            Yarına ertele
          </button>
        ) : null}
      </div>
    </div>
  );
}
