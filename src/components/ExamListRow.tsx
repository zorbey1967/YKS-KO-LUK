import { useApp } from '../context/AppContext';
import type { ExamTarget } from '../lib/types';
import {
  examDaysLeft,
  examKindIcon,
  examKindTone,
  examStatus,
  examStatusLabel,
  fmtExamDateShort,
} from '../lib/examTargets';

/** Sınav kartı satırı: ad, tür, tarih, konular ve durum. Takvim, Ana Sayfa ve Denemeler aynı satırı kullanır. */
export function ExamListRow({ exam, onOpen, compact = false }: { exam: ExamTarget; onOpen: (exam: ExamTarget) => void; compact?: boolean }) {
  const { data } = useApp();
  const status = examStatus(data, exam);
  const days = examDaysLeft(exam);
  const tone = examKindTone(exam.kind);
  const topics = exam.topics || [];
  return (
    <button type="button" className={`exam-item tone-${tone} status-${status}`} onClick={() => onOpen(exam)}>
      <span className="exam-item-date" aria-hidden="true">
        <b>{exam.date.slice(8, 10)}</b>
        <small>{fmtExamDateShort(exam.date).replace(/^\d+\s*/, '')}</small>
      </span>
      <span className="exam-item-main">
        <strong>{exam.title}</strong>
        <small>
          <span className={`exam-kind tone-${tone}`}><span aria-hidden="true">{examKindIcon(exam.kind)} </span>{exam.kind}</span>
          {exam.isPrimary ? <span className="exam-flag">Hedef</span> : null}
          {!compact && topics.length ? <span className="exam-topics-line">{topics.slice(0, 3).join(', ')}{topics.length > 3 ? ` +${topics.length - 3}` : ''}</span> : null}
        </small>
      </span>
      <span className={`exam-status status-${status}`}>{examStatusLabel(status, days)}</span>
    </button>
  );
}
