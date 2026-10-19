import { useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import type { ExamTarget } from '../lib/types';
import {
  emptyExamTarget,
  examDaysLeft,
  examKindIcon,
  examKindTone,
  examStatus,
  examStatusLabel,
  fmtExamDateLong,
  removeExamTarget,
  saveExamTarget,
  withPrimary,
} from '../lib/examTargets';
import { findExamForTarget } from '../lib/examResultEntry';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { jumpFromTracker, setBankJump } from '../lib/practice';
import { openZorro } from '../lib/zorroBus';
import { ExamForm } from './ExamForm';
import { ExamResultModal } from './ExamResultModal';

/** Sınava tıklanınca: düzenle, sil, hedef yap, sonuç ekle. */
export function ExamDetailModal({
  exam,
  onClose,
  onEdit,
  onDelete,
  onPrimary,
  onResult,
}: {
  exam: ExamTarget;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrimary: () => void;
  onResult: () => void;
}) {
  const { data, go } = useApp();
  const [confirm, setConfirm] = useState(false);
  const status = examStatus(data, exam);
  const days = examDaysLeft(exam);
  const result = findExamForTarget(data, exam);
  const tone = examKindTone(exam.kind);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={exam.title} onClick={onClose}>
      <div className={`modal-box exam-detail tone-${tone}`} onClick={(e) => e.stopPropagation()}>
        <div className="exam-detail-head">
          <span className={`exam-kind tone-${tone}`}><span aria-hidden="true">{examKindIcon(exam.kind)} </span>{exam.kind}</span>
          {exam.isPrimary ? <span className="exam-flag">Hedef sınav</span> : null}
          <span className={`exam-status status-${status}`}>{examStatusLabel(status, days)}</span>
        </div>
        <h3 className="exam-detail-title">{exam.title}</h3>
        <p className="exam-detail-date">{fmtExamDateLong(exam.date)}</p>
        {exam.subject ? <p className="muted" style={{ margin: '4px 0 0' }}>Ders: {exam.subject}</p> : null}
        {exam.topics?.length ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: '0 0 6px' }}>Konular — çalışmak için dokun</p>
            <div className="chip-row" aria-label="Konular">
              {exam.topics.map((t) => (
                <button key={t} type="button" className="chip exam-topic-go" onClick={() => {
                  // Konu → soru: aynı konu adı soru bankası ve ZORRO tarafından kullanılır (tek veri: müfredat konusu).
                  if (QUESTION_BANK_ENABLED) {
                    setBankJump(jumpFromTracker(data.grade, exam.subject || exam.kind, t));
                    onClose();
                    go('questionbank');
                    return;
                  }
                  onClose();
                  openZorro(`${exam.title} için "${t}" konusundan bana düzeyime uygun 3 kısa soru sor; cevapları ben yazınca kontrol et.`);
                }}>{t}</button>
              ))}
            </div>
          </div>
        ) : null}
        {result ? (
          <p className="success" style={{ marginTop: 12 }}>
            Sonuç: <b>{result.subjects?.length ? `${result.tyt || result.ayt} net` : `${result.tyt} puan`}</b>
          </p>
        ) : null}
        {confirm ? (
          <div className="notice banner" role="alert">
            Bu sınav takvimden ve tüm cihazlardan silinsin mi? Girdiğin sonuçlar silinmez.
            <div className="actions" style={{ marginTop: 0 }}>
              <button className="btn danger" type="button" onClick={onDelete}>Evet, sil</button>
              <button className="btn" type="button" onClick={() => setConfirm(false)}>Vazgeç</button>
            </div>
          </div>
        ) : null}
        <div className="actions exam-detail-actions">
          <button className="btn primary" type="button" onClick={onResult}>{result ? 'Sonucu düzenle' : 'Sonuç ekle'}</button>
          <button className="btn secondary" type="button" onClick={onEdit}>Düzenle</button>
          {!exam.isPrimary ? <button className="btn secondary" type="button" onClick={onPrimary}>Hedef yap</button> : null}
          <button className="btn danger" type="button" onClick={() => setConfirm(true)}>Sil</button>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

type View =
  | { kind: 'none' }
  | { kind: 'form'; draft: ExamTarget }
  | { kind: 'detail'; id: string }
  | { kind: 'result'; id: string };

/**
 * Sınav akışının tek giriş noktası. Takvim, Ana Sayfa ve Denemeler bu kancayı kullanır;
 * kaydetme / silme / hedef yapma her yerde aynı fonksiyonlardan geçer.
 */
export function useExamDialogs() {
  const { data, setData, toast } = useApp();
  const [view, setView] = useState<View>({ kind: 'none' });
  const close = () => setView({ kind: 'none' });
  const find = (id: string) => (data.examTargets || []).find((t) => t.id === id) || null;

  function openNew(date?: string) {
    const draft = emptyExamTarget();
    if (date) draft.date = date;
    setView({ kind: 'form', draft });
  }

  const openDetail = (exam: ExamTarget) => setView({ kind: 'detail', id: exam.id });

  let element: ReactNode = null;
  if (view.kind === 'form') {
    element = (
      <ExamForm
        draft={view.draft}
        onClose={close}
        onSave={(row) => {
          setData((d) => saveExamTarget(d, row));
          toast(view.draft.id ? 'Sınav güncellendi' : 'Sınav takvime eklendi');
          close();
        }}
        onDelete={view.draft.id ? () => {
          setData((d) => removeExamTarget(d, view.draft.id));
          toast('Sınav silindi');
          close();
        } : undefined}
      />
    );
  } else if (view.kind === 'detail') {
    const exam = find(view.id);
    element = exam ? (
      <ExamDetailModal
        exam={exam}
        onClose={close}
        onEdit={() => setView({ kind: 'form', draft: exam })}
        onResult={() => setView({ kind: 'result', id: exam.id })}
        onPrimary={() => {
          setData((d) => ({ ...d, examTargets: withPrimary(d.examTargets || [], exam.id), examDate: exam.date }));
          toast('Hedef sınav güncellendi');
        }}
        onDelete={() => {
          setData((d) => removeExamTarget(d, exam.id));
          toast('Sınav silindi');
          close();
        }}
      />
    ) : null;
  } else if (view.kind === 'result') {
    const exam = find(view.id);
    element = exam ? <ExamResultModal target={exam} onClose={close} /> : null;
  }

  return { openNew, openDetail, element };
}
