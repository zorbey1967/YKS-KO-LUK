import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { STUDY_SUBJECTS, todaySchedule } from '../lib/insights';
import { curriculumForGrade } from '../lib/curriculum';
import { eliteReport } from '../lib/elite';
import { setBankJump } from '../lib/practice';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { today, uid } from '../lib/util';
import { commitSession, patchSession } from '../lib/studyLoop';
import { tombstone } from '../lib/syncMerge';
import { StudySuggestCard } from '../components/StudySuggestCard';
import { formatMinutes, getStudentProgress } from '../lib/studentProgress';
import {
  STUDY_KINDS,
  canPersist,
  cancelLive,
  changeKind,
  changePlan,
  changeSubject,
  clearLive,
  dailyTotals,
  elapsedSec,
  fmtClock,
  idleLive,
  kindLabel,
  loadLive,
  persistFailLabel,
  phaseLabel,
  pauseLive,
  remainingMs,
  remainingSec,
  startLive,
  syncFromClock,
  takeTimerIntent,
  toSession,
  writeLive,
  type LiveTimer,
  type StudyKind,
} from '../lib/studyTimer';

type SaveUi = 'idle' | 'saving' | 'saved' | 'error';

function newIdle(kind: StudyKind, subject: string, plannedSec?: number): LiveTimer {
  return idleLive({ id: uid('s_'), kind, subject, plannedSec, now: Date.now() });
}

export function TimerPage() {
  const { data, setData, toast, go } = useApp();
  const [live, setLive] = useState<LiveTimer>(() => {
    const restored = loadLive();
    const intent = takeTimerIntent();
    if (intent && !restored?.startedAt) {
      return idleLive({
        id: uid('s_'),
        kind: intent.kind || 'free',
        subject: intent.subject,
        topic: intent.topic,
        source: intent.source,
        taskId: intent.taskId,
        plannedSec: Math.max(60, (intent.minutes || 40) * 60),
      });
    }
    if (restored) return syncFromClock(restored);
    return newIdle('free', 'Odak');
  });
  const [topic, setTopic] = useState(() => loadLive()?.topic || '');
  const [asked, setAsked] = useState('');
  const [correctCount, setCorrectCount] = useState('');
  const [difficulty, setDifficulty] = useState<'' | 'kolay' | 'orta' | 'zor'>('');
  const [now, setNow] = useState(() => Date.now());
  const [saveUi, setSaveUi] = useState<SaveUi>(() => (loadLive()?.saved ? 'saved' : 'idle'));
  const [saveErr, setSaveErr] = useState('');
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [customMin, setCustomMin] = useState(40);
  const liveRef = useRef(live);
  liveRef.current = live;

  const commitLive = useCallback((next: LiveTimer) => {
    liveRef.current = next;
    setLive(next);
    writeLive(next);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const cur = liveRef.current;
      if (!cur.running) return;
      if (remainingMs(cur, t) > 0) return;
      const synced = syncFromClock(cur, t);
      if (synced.running) return;
      commitLive(synced);
      toast(synced.kind === 'pomodoro' ? 'Blok bitti. 5 dk mola önerilir.' : 'Süre doldu. Çalışılan süreyi kaydedebilirsin.');
    }, 250);
    return () => {
      window.clearInterval(id);
      writeLive(syncFromClock(liveRef.current, Date.now()));
    };
  }, [commitLive, toast]);

  useEffect(() => {
    const onVis = () => {
      const t = Date.now();
      setNow(t);
      commitLive(syncFromClock(liveRef.current, t));
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!liveRef.current.running) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onHash = () => {
      writeLive(syncFromClock(liveRef.current, Date.now()));
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      writeLive(syncFromClock(liveRef.current, Date.now()));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [commitLive]);

  const rem = remainingSec(live, now);
  const used = elapsedSec(live, now);
  const plannedMin = Math.round(live.plannedSec / 60);
  const workedMin = Math.floor(used / 60);
  const gate = canPersist(live, now);
  const todayS = data.sessions.filter((x) => x.date === today()).slice().reverse();
  const totals = dailyTotals(data.sessions, today());
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const firstBlock = todaySchedule(data)?.blocks[0];
  const curr = useMemo(() => curriculumForGrade(data.grade), [data.grade]);
  const subjectOpts = Object.keys(curr).length
    ? Array.from(new Set([live.subject, ...Object.keys(curr)].filter(Boolean)))
    : STUDY_SUBJECTS;
  const topicOpts = curr[live.subject] || [];
  const elite = eliteReport(data);
  const targetMin = elite.dailyMin;
  const alreadySaved = data.sessions.some((s) => s.id === live.id);

  function applyStart() {
    const next = startLive(live, Date.now());
    if ('error' in next) {
      toast(next.error === 'already_running' ? 'Zaten bir oturum açık.' : 'Süre bitti. Kaydet veya sıfırla.');
      return;
    }
    setSaveUi('idle');
    setSaveErr('');
    commitLive(next);
  }

  function applyPause() {
    commitLive(pauseLive(live, Date.now()));
  }

  function applyCancel() {
    const next = cancelLive(live, Date.now());
    clearLive();
    commitLive(next);
    setSaveUi('idle');
    setSaveErr('');
  }

  function applyPlan(sec: number) {
    const next = changePlan(live, sec);
    if ('error' in next) {
      toast(next.error === 'invalid' ? 'Süre 1–360 dk arasında olmalı.' : 'Oturum başladıktan sonra süre değişmez. Bitir veya sıfırla.');
      return;
    }
    commitLive(next);
  }

  function applyKind(kind: StudyKind) {
    const next = changeKind(live, kind, Date.now());
    if ('error' in next) {
      toast('Önce bu oturumu bitir veya sıfırla.');
      return;
    }
    commitLive(next);
  }

  function saveSession(snapshot?: LiveTimer): boolean {
    const cur = syncFromClock(snapshot || liveRef.current, Date.now());
    if (alreadySaved || cur.saved) {
      setSaveUi('saved');
      toast('Bu oturum zaten kaydedildi.');
      return false;
    }
    const rec = toSession(cur, Date.now());
    if (!rec) {
      const fail = canPersist(cur, Date.now());
      const msg = fail.ok ? 'Kayıt yapılamadı.' : persistFailLabel(fail.reason);
      setSaveUi('error');
      setSaveErr(msg);
      toast(msg);
      return false;
    }
    setSaveUi('saving');
    try {
      rec.topic = topic.trim() || rec.topic;
      setData((d) => commitSession(d, rec).data);
      const marked = { ...cur, saved: true, running: false, endAt: null };
      commitLive(marked);
      setSaveUi('saved');
      setSaveErr('');
      toast(`${rec.minutes} dk kaydedildi • ${rec.subject}`);
      return true;
    } catch {
      setSaveUi('error');
      setSaveErr('Kayıt yazılamadı. Tekrar dene; süre yerelde duruyor.');
      toast('Kayıt yazılamadı.');
      return false;
    }
  }

  function finishAndSave() {
    const paused = pauseLive(live, Date.now());
    commitLive(paused);
    const ok = saveSession(paused);
    if (ok && paused.kind === 'pomodoro' && paused.plannedSec >= 20 * 60) {
      commitLive(newIdle('pomodoro', paused.subject, 5 * 60));
      setSaveUi('idle');
    }
  }

  const saveDisabled = saveUi === 'saving' || !gate.ok || alreadySaved;
  const saveLabel = saveUi === 'saving' ? 'Kaydediliyor…' : saveUi === 'saved' || alreadySaved ? 'Kaydedildi' : 'Oturumu kaydet';

  return (
    <div className="timer-page grid two">
      <div className="card timer-card">
        <div className="eyebrow">Çalışma saati • {phaseLabel(elite.phase)}</div>
        <p className="muted timer-lead">
          Planlanan süre {plannedMin} dk. Sayaç, ekran kapalıyken de cihaz saatine göre işler.
        </p>
        <div className="timer-face" aria-live="polite">{fmtClock(rem)}</div>
        <div className="timer-meta">
          <div>
            <span>Planlanan</span>
            <b>{plannedMin} dk</b>
          </div>
          <div>
            <span>Çalışılan</span>
            <b>{workedMin} dk {used % 60 ? `${used % 60} sn` : ''}</b>
          </div>
        </div>
        {!online ? <p className="muted">Çevrimdışısın. Kayıt bu cihazda tutulur; bağlanınca senkronlanır.</p> : null}

        <div className="timer-kinds" role="group" aria-label="Çalışma biçimi">
          {STUDY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`chip-btn ${live.kind === k.id ? 'on' : ''}`}
              disabled={Boolean(live.running || live.startedAt)}
              onClick={() => applyKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="muted">{STUDY_KINDS.find((k) => k.id === live.kind)?.hint}</p>

        <div className="field" style={{ maxWidth: 280, margin: '0 auto', textAlign: 'left' }}>
          <label htmlFor="timer-subject">Ders</label>
          <select
            id="timer-subject"
            value={live.subject}
            onChange={(e) => commitLive(changeSubject(live, e.target.value))}
          >
            {subjectOpts.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 280, margin: '8px auto 0', textAlign: 'left' }}>
          <label htmlFor="timer-topic">Konu</label>
          {topicOpts.length ? (
            <select
              id="timer-topic"
              value={topicOpts.includes(topic) ? topic : ''}
              onChange={(e) => {
                setTopic(e.target.value);
                commitLive({ ...live, topic: e.target.value.trim() });
              }}
            >
              <option value="">Konu seç</option>
              {topicOpts.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <input
              id="timer-topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                commitLive({ ...live, topic: e.target.value.trim() });
              }}
              placeholder="Örn. Fonksiyonlar"
            />
          )}
        </div>

        {live.kind === 'custom' && !live.startedAt ? (
          <div className="field" style={{ maxWidth: 280, margin: '8px auto 0', textAlign: 'left' }}>
            <label htmlFor="timer-custom">Kendi süren (dk)</label>
            <input
              id="timer-custom"
              type="number"
              min={1}
              max={360}
              value={customMin}
              onChange={(e) => {
                const n = Number(e.target.value);
                setCustomMin(n);
                if (Number.isFinite(n)) applyPlan(Math.round(n) * 60);
              }}
            />
          </div>
        ) : null}

        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn primary" type="button" onClick={() => (live.running ? applyPause() : applyStart())}>
            {live.running ? 'Duraklat' : live.startedAt ? 'Devam et' : 'Başlat'}
          </button>
          <button
            className="btn"
            type="button"
            disabled={saveDisabled}
            aria-busy={saveUi === 'saving'}
            onClick={() => saveSession()}
          >
            {saveLabel}
          </button>
          <button className="btn" type="button" onClick={applyCancel}>Sıfırla</button>
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn secondary" type="button" disabled={!gate.ok || alreadySaved} onClick={finishAndSave}>
            Tamamla
          </button>
        </div>
        {saveUi === 'error' && saveErr ? <p className="muted">{saveErr}</p> : null}
        {saveUi === 'saved' ? (
          <div className="timer-summary" style={{ textAlign: 'left', maxWidth: 320, margin: '12px auto 0' }}>
            <p className="muted">Özet: {workedMin} dk çalışıldı (hedef {plannedMin} dk). Soru sayısı tahmin edilmez.</p>
            <div className="field">
              <label htmlFor="timer-asked">Çözülen soru (isteğe bağlı)</label>
              <input id="timer-asked" inputMode="numeric" value={asked} onChange={(e) => setAsked(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="timer-ok">Doğru sayısı (isteğe bağlı)</label>
              <input id="timer-ok" inputMode="numeric" value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="timer-diff">Zorluk (isteğe bağlı)</label>
              <select id="timer-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
                <option value="">Seçilmedi</option>
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
              </select>
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                const a = asked.trim() === '' ? undefined : Math.max(0, Number(asked));
                const c = correctCount.trim() === '' ? undefined : Math.max(0, Number(correctCount));
                if (a != null && !Number.isFinite(a)) return toast('Soru sayısı sayı olmalı.');
                if (c != null && !Number.isFinite(c)) return toast('Doğru sayısı sayı olmalı.');
                setData((d) => patchSession(d, live.id, {
                  asked: a,
                  correctCount: c,
                  difficulty: difficulty || undefined,
                  topic: topic.trim() || undefined,
                }));
                toast('Özet güncellendi');
              }}
            >
              Özeti kaydet
            </button>
          </div>
        ) : null}
        {!live.startedAt ? <p className="muted">Kaydet, yalnızca Başlat’tan sonra geçen süreyi yazar. Planlanan süre hedefidir.</p> : null}

        <div className="actions" style={{ justifyContent: 'center' }}>
          {[25, 40, 50, 90].map((m) => (
            <button key={m} className="btn secondary" type="button" onClick={() => applyPlan(m * 60)}>{m} dk</button>
          ))}
          <button className="btn secondary" type="button" onClick={() => applyPlan(targetMin * 60)}>
            Günlük tempo {targetMin} dk
          </button>
          {firstBlock ? (
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                const hit = STUDY_SUBJECTS.find((s) => firstBlock.title.toLocaleLowerCase('tr-TR').includes(s.toLocaleLowerCase('tr-TR')));
                commitLive(changeSubject(live, hit || 'Odak'));
                applyPlan(Math.max(15, firstBlock.minutes) * 60);
              }}
            >
              Programdaki blok {firstBlock.minutes} dk
            </button>
          ) : null}
        </div>
      </div>

      <div className="card timer-side">
        <div className="section-title"><h3>Çalışma Sürem</h3></div>
        <div className="grid stats">
          <div className="card stat"><div className="label">BUGÜN</div><div className="value">{formatMinutes(progress.capacity.todayTotal)}</div><div className="sub">Timer {formatMinutes(progress.capacity.todayTimer)} · Kütüphane {formatMinutes(progress.capacity.todayLibrary)}</div></div>
          <div className="card stat"><div className="label">BU HAFTA</div><div className="value">{formatMinutes(progress.capacity.weekMinutes)}</div><div className="sub">Timer {formatMinutes(progress.capacity.weekTimer)} · Kütüphane {formatMinutes(progress.capacity.weekLibrary)}</div></div>
          <div className="card stat"><div className="label">BU AY</div><div className="value">{formatMinutes(progress.capacity.monthTotal)}</div><div className="sub">Timer {formatMinutes(progress.capacity.monthTimer)} · Kütüphane {formatMinutes(progress.capacity.monthLibrary)}</div></div>
        </div>
        <p className="muted">Koçumun programı bugün {formatMinutes(progress.coachToday.reduce((a, b) => a + b.minutes, 0))} · hafta {formatMinutes(progress.coachWeekFocus.reduce((a, d) => a + d.minutes, 0))}. Timer ve kütüphane ayrı sayılır.</p>
        {progress.capacity.weekTrend.map((d) => (
          <div className="kpi" key={d.date}><div>{d.day}</div><b>{formatMinutes(d.minutes)}</b></div>
        ))}
        {progress.studyBreakdown.slice(0, 8).map((s) => (
          <div className="plan-item" key={s.name}><span>{s.name}</span><b>{formatMinutes(s.minutes)}</b></div>
        ))}
        <StudySuggestCard />
        <div className="section-title" style={{ marginTop: 16 }}><h3>Bugünkü kayıtlar</h3></div>
        <div className="kpi">
          <div>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Kaydedilen süre</span>
            <br />
            <b>{totals.minutes} dk</b>
          </div>
          <span className="chip">{totals.count} oturum</span>
        </div>
        {totals.count > 0 ? (
          <>
            <div className="progress" aria-label="Günlük tempo">
              <i style={{ width: `${Math.min(100, (totals.minutes / Math.max(1, targetMin)) * 100)}%` }} />
            </div>
            <p className="muted">Günlük tempo hedefi {targetMin} dk (haftalık plandan). Çubuk yalnızca kaydedilen süreye bakar.</p>
          </>
        ) : (
          <div className="empty timer-onboard">
            <p><b>İlk oturum</b></p>
            <ol>
              <li>Soldan çalışma biçimini ve dersi seç.</li>
              <li>Süreyi seç, Başlat’a bas.</li>
              <li>Bitince “Oturumu kaydet” ile çalışılan süreyi yaz.</li>
            </ol>
            <p className="muted">Boş grafik yok: kayıt düşünce tempo çubuğu görünür.</p>
          </div>
        )}
        {QUESTION_BANK_ENABLED ? (
        <button
          className="btn secondary"
          type="button"
          style={{ marginBottom: 12 }}
          onClick={() => {
            if (!data.grade) {
              go('questionbank');
              return;
            }
            const sub = live.subject === 'Odak' || live.subject === 'Deneme' ? 'Matematik' : live.subject;
            setBankJump({
              level: data.grade.includes('KPSS')
                ? 'KPSS Genel Yetenek'
                : (data.grade.includes('Mezun') || data.grade.startsWith('11') || data.grade.startsWith('12')
                  ? 'YKS TYT'
                  : data.grade),
              subject: sub === 'Edebiyat' ? 'Türk Dili ve Edebiyatı' : sub,
            });
            go('questionbank');
          }}
        >
          Bu dersten soru çöz
        </button>
        ) : null}
        {todayS.length ? todayS.map((s) => (
          <div className="plan-item" key={s.id}>
            <span>
              {s.subject}
              <br />
              <small style={{ color: 'var(--muted)' }}>
                {s.kind ? `${kindLabel(s.kind as StudyKind)} • ` : ''}
                {new Date(s.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                {s.plannedMinutes ? ` • hedef ${s.plannedMinutes} dk` : ''}
                {s.asked != null ? ` • ${s.asked} soru` : ' • soru kaydı yok'}
              </small>
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <b>{s.minutes} dk</b>
              <button
                className="btn secondary"
                type="button"
                aria-label="Oturumu sil"
                onClick={() => setData(tombstone(data, 'session', s.id))}
              >
                Sil
              </button>
            </span>
          </div>
        )) : null}
      </div>
    </div>
  );
}
