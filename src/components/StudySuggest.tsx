import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { nextStudySuggestion } from '../lib/studySuggest';
import { setTimerIntent } from '../lib/studyTimer';
import { setBankJump } from '../lib/practice';
import { jumpFromTracker } from '../lib/practice';
import { snoozeReview } from '../lib/spacedReview';
import { today } from '../lib/util';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { kindLabel, type StudyKind } from '../lib/studyTimer';

/**
 * "Şimdi ne çalışmalıyım?" — Ana Sayfa'daki tek "Başla" eylemi bu kancadan gelir
 * (görev listesinde ve başka kartta ikinci bir başla düğmesi yok).
 */
export function useStudySuggestion() {
  const { data, setData, go } = useApp();
  const todayKey = today();
  const rec = useMemo(() => nextStudySuggestion(data, todayKey), [data, todayKey]);

  function start() {
    if (rec.action === 'onboard') {
      go(QUESTION_BANK_ENABLED ? 'questionbank' : 'plan');
      return;
    }
    if (rec.action === 'bank') {
      if (!QUESTION_BANK_ENABLED) {
        go('plan');
        return;
      }
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

  const snooze = rec.reviewId ? () => setData(snoozeReview(data, rec.reviewId!, todayKey, 1)) : null;
  const title = rec.kind === 'onboard' ? '' : (rec.topic || rec.subject || '');
  const meta = rec.kind === 'onboard' ? '' : `${kindLabel(rec.kind as StudyKind)} · ~${rec.minutes} dk`;
  const cta = rec.action === 'onboard' ? 'Akıllı Plan’ı aç' : rec.action === 'bank' ? 'Soruyu aç' : 'Başla';
  return { rec, title, meta, cta, start, snooze };
}
