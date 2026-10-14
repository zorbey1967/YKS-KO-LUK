import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { coachAdvice } from '../lib/coach';
import { examCountdown, todaySchedule } from '../lib/insights';
import { lastBankTopic, setBankJump, weakBankTopics } from '../lib/practice';
import { ExamHomeWidget } from '../components/ExamHomeWidget';
import { NextAppointmentCard } from '../components/NextAppointmentCard';
import { examTitle } from '../lib/stage';
import { today } from '../lib/util';
import { displayRank } from '../lib/types';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { zorroHomeHint } from '../lib/zorroSuggest';
import { StudySuggestCard } from '../components/StudySuggestCard';

export function HomePage({ onNewTask }: { onNewTask: () => void }) {
  const { data, go, profile, user, isPlatformOwner } = useApp();
  const td = today();
  const todayOpen = data.tasks.filter((t) => t.date === td && !t.done);
  const day = todaySchedule(data);
  const nextBlock = day?.blocks[0];
  const lastQ = useMemo(() => lastBankTopic(data), [data]);
  const recs = useMemo(() => weakBankTopics(data, 1), [data]);
  const exams = useMemo(
    () => data.exams.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [data.exams],
  );
  const lastExam = exams[0];
  const prevExam = exams[1];
  const count = examCountdown(data.examDate);
  const coach = useMemo(() => coachAdvice(data), [data]);
  const lastCalc = data.calcs[0];
  const hint = useMemo(() => zorroHomeHint(data), [data]);

  function openBank(level: string, subject?: string | null, topic?: string | null) {
    setBankJump({ level, subject, topic });
    go('questionbank');
  }

  if (profile?.role === 'coach') {
    const display = getCoachDisplayName(profile.name);
    return (
      <>
        <div className="hero">
          <div className="eyebrow" style={{ color: '#cfe1ff' }}>Koçluk</div>
          <h2>{display}</h2>
          <p>Bugünkü dersler ve randevular Koçluk panelinde.</p>
          <div className="hero-actions">
            <button className="btn primary" type="button" onClick={() => go('coaches')}>Koçluk paneli</button>
            <button className="btn" type="button" onClick={() => go('account')}>Hesabım</button>
          </div>
        </div>
        <NextAppointmentCard />
      </>
    );
  }

  const name = getPersonDisplayName(profile?.name, user ? 'Öğrenci' : 'Misafir');
  const nextTask = todayOpen[0];
  const nextTitle = nextTask?.title || nextBlock?.title || lastQ?.topic || '';
  const nextMeta = nextTask
    ? `${nextTask.subject} • ${nextTask.minutes} dk`
    : nextBlock
      ? `${nextBlock.minutes} dk`
      : lastQ
        ? `${lastQ.subject}`
        : '';

  if (!user) {
    return (
      <>
        <div className="hero">
          <div className="eyebrow" style={{ color: '#cfe1ff' }}>Giriş / Kayıt</div>
          <h2>Hesabınla devam et.</h2>
          <p>Çalışma araçları, randevu ve görüşmeler oturum açtıktan sonra açılır.</p>
          <div className="hero-actions">
            <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
            <button className="btn" type="button" onClick={() => go('account', 'oauth=google')}>Google ile devam et</button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Koçluk</h3></div>
          <p className="muted">Koçları incele; randevu için giriş gerekir.</p>
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => go('coaches')}>Koçları incele</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Bugün</div>
        <h2>{isPlatformOwner ? 'Yönetici hesabı' : `Merhaba, ${name}`}</h2>
        <p>
          {data.examDate
            ? (count.past ? `${examTitle(data)} tarihi geçti.` : `${examTitle(data)}’ye ${count.label}.`)
            : 'Sınav tarihi Sınav Merkezi veya Hedefim’de.'}
          {data.rank > 0 ? ` Hedef sıra ${displayRank(data.rank)}.` : ''}
        </p>
      </div>

      <ExamHomeWidget />

      <div style={{ marginTop: 16 }}>
        <StudySuggestCard />
      </div>

      {hint ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>ZORRO önerisi</h3></div>
          <p style={{ marginTop: 0 }}>{hint}</p>
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => window.dispatchEvent(new Event('yks-open-zorro'))}>ZORRO’ya sor</button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Bugünkü öncelik</h3></div>
        {nextTitle ? (
          <>
            <p style={{ marginTop: 0 }}><b>{nextTitle}</b></p>
            {nextMeta ? <p className="muted">{nextMeta}</p> : null}
            <div className="actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  if (nextTask) go('timer');
                  else if (lastQ) openBank(lastQ.levelName, lastQ.subject, lastQ.topic);
                  else go('schedule');
                }}
              >
                Çalışmaya başla
              </button>
              <button className="btn secondary" type="button" onClick={onNewTask}>Görev ekle</button>
            </div>
          </>
        ) : (
          <div className="empty">
            Bugün için açık görev yok.
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={onNewTask}>Görev ekle</button>
              <button className="btn secondary" type="button" onClick={() => go('schedule')}>Ders programı</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <NextAppointmentCard />
      </div>

      {(lastExam || lastCalc || recs[0]) ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>Zayıf konu</h3></div>
          {recs[0] ? (
            <div className="plan-item">
              <span>{recs[0].topic}<br /><small className="muted">{recs[0].subject} • %{recs[0].acc} • {recs[0].wrong} yanlış</small></span>
              <button className="btn secondary" type="button" onClick={() => openBank(recs[0].levelName, recs[0].subject, recs[0].topic)}>Çalış</button>
            </div>
          ) : null}
          {lastExam ? (
            <div className="plan-item">
              <span>{lastExam.name}{prevExam ? ` • önceki ${prevExam.tyt} TYT` : ''}</span>
              <b>{lastExam.tyt} TYT{lastExam.ayt ? ` / ${lastExam.ayt} AYT` : ''}</b>
            </div>
          ) : null}
          {lastCalc ? (
            <div className="plan-item"><span>Son net • {lastCalc.type}</span><b>{Number(lastCalc.net).toFixed(2)}</b></div>
          ) : null}
        </div>
      ) : null}

      {(nextTask || recs[0]) ? (
      <div className="card">
        <div className="section-title"><h3>Sıradaki</h3></div>
        <p className="muted">{coach.msg}</p>
        <div className="actions">
          {recs[0] ? (
            <button className="btn primary" type="button" onClick={() => openBank(recs[0].levelName, recs[0].subject, recs[0].topic)}>
              Mini çalışma
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={() => go('questionbank')}>Soru bankası</button>
          )}
        </div>
      </div>
      ) : null}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Çalışma araçları</h3></div>
        <p className="muted">Menüde olmayan hızlı kısayollar.</p>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => go('plan')}>Akıllı Plan</button>
          <button className="btn secondary" type="button" onClick={() => go('exams')}>Denemeler</button>
          <button className="btn secondary" type="button" onClick={() => go('calculator')}>Net</button>
          <button className="btn secondary" type="button" onClick={() => go('timer')}>Timer</button>
          <button className="btn secondary" type="button" onClick={() => go('analytics')}>Analiz</button>
          <button className="btn secondary" type="button" onClick={() => go('settings')}>Ayarlar</button>
        </div>
      </div>
    </>
  );
}
