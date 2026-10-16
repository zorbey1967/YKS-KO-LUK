import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { GRADES } from '../lib/curriculum';
import { applyGradeKeepAge } from '../lib/goal';
import { jumpFromTracker, setBankJump } from '../lib/practice';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { buildSubjectCards, setTopicProgress, type TopicStatus } from '../lib/studentProgress';

export function TopicsPage() {
  const { data, setData, toast, go } = useApp();
  const [open, setOpen] = useState<string>('');
  const cards = useMemo(() => buildSubjectCards(data), [data]);
  const gaps = cards.flatMap((c) => c.topics.filter((t) => t.status !== 'done')).sort((a, b) => a.level - b.level).slice(0, 6);

  function setStatus(subject: string, name: string, status: TopicStatus, percent?: number) {
    setData((prev) => setTopicProgress(prev, subject, name, status, percent));
    toast(status === 'done' ? 'Tamamlandı' : status === 'in_progress' ? 'Devam ediyor' : 'Başlanmadı');
  }

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title">
          <h3>Müfredat</h3>
          {data.grade ? <span className="chip">{data.grade}{data.track ? ` · ${data.track}` : ''}</span> : null}
        </div>
        {data.grade ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Sınıf Hesabım’dan gelir. Dersleri açıp konu durumunu işaretle; çalışma ve denemeler de ilerlemeyi destekler.
          </p>
        ) : (
          <div className="notice">
            <p>Konular için önce Hesabım’dan sınıfını seç.</p>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => go('account')}>Hesabım</button>
              <select aria-label="Sınıf" value="" onChange={(e) => setData((prev) => applyGradeKeepAge(prev, e.target.value))}>
                <option value="">Sınıf seç</option>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        )}
        {QUESTION_BANK_ENABLED ? (
          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="btn primary" type="button" onClick={() => go('questionbank')}>Soru çöz</button>
          </div>
        ) : null}
        {cards.map((card) => {
          const shown = open === card.subject;
          return (
            <div className="topic-row" key={card.subject}>
              <button
                className="topic-head"
                type="button"
                aria-expanded={shown}
                onClick={() => setOpen(shown ? '' : card.subject)}
                style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left' }}
              >
                <span><b>{card.subject}</b> <small className="muted">%{card.progress} · {card.done} bitti · {card.inProgress} devam · {card.notStarted} başlamadı</small></span>
                <span>{shown ? '▼' : '▶'}</span>
              </button>
              {shown ? card.topics.map((t) => (
                <div key={t.name} style={{ marginTop: 10 }}>
                  <div className="topic-head">
                    <span>
                      {t.status === 'done' ? '🟢' : t.status === 'in_progress' ? '🟡' : '⚪'} <b>{t.name}</b>
                      <small className="muted"> %{t.level}{t.source === 'inferred' ? ' · tahmini' : ''}</small>
                    </span>
                  </div>
                  <div className="progress"><i style={{ width: `${t.level}%` }} /></div>
                  <div className="actions" style={{ marginTop: 6 }}>
                    <button className="btn secondary" type="button" onClick={() => setStatus(card.subject, t.name, 'done')}>🟢 BİTTİ</button>
                    <button className="btn secondary" type="button" onClick={() => setStatus(card.subject, t.name, 'in_progress', Math.max(40, t.level || 50))}>🟡 DEVAM EDİYOR</button>
                    <button className="btn secondary" type="button" onClick={() => setStatus(card.subject, t.name, 'not_started')}>⚪ BAŞLAMADIM</button>
                    {QUESTION_BANK_ENABLED ? <button className="btn secondary" type="button" onClick={() => {
                      setBankJump(jumpFromTracker(data.grade, card.subject, t.name));
                      go('questionbank');
                    }}>Çöz</button> : null}
                  </div>
                </div>
              )) : null}
            </div>
          );
        })}
      </div>
      <div>
        <div className="card">
          <div className="section-title"><h3>Öncelik</h3></div>
          {gaps.length ? gaps.map((x) => (
            <div className="topic-row" key={`${x.subject}-${x.name}`}>
              <div className="topic-head"><b>{x.name}</b><span className="chip">{x.level}%</span></div>
              <small className="muted">{x.subject} — Akıllı Plan’da öne alınır.</small>
            </div>
          )) : <div className="empty">{data.grade ? 'Eksik konu görünmüyor.' : 'Sınıf seçilmedi.'}</div>}
        </div>
      </div>
    </div>
  );
}
