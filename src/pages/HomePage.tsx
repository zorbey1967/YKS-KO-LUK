import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { coachAdvice } from '../lib/coach';
import { eliteReport } from '../lib/elite';
import { blocksToTasks, examCountdown, studyStreak, todaySchedule, weekGoalPct } from '../lib/insights';
import { lastBankTopic, setBankJump, weakBankTopics } from '../lib/practice';
import { ExamInsight } from '../components/ExamInsight';
import { TaskRows } from '../components/TaskRows';
import { examTitle } from '../lib/stage';
import { today } from '../lib/util';
import { displayAge, displayRank, displayText } from '../lib/types';

export function HomePage({ onNewTask }: { onNewTask: () => void }) {
  const { data, setData, go, profile, toast, user } = useApp();
  const name = profile?.name || (user ? 'Öğrenci' : 'Misafir');
  const profileIncomplete = !data.grade || data.age <= 0 || !data.track || !data.dept;
  const td = today();
  const todayTasks = data.tasks.filter((t) => t.date === td);
  const done = todayTasks.filter((t) => t.done).length;
  const sessions = data.sessions.filter((x) => x.date === td);
  const mins = sessions.reduce((a, x) => a + x.minutes, 0);
  const streak = studyStreak(data);
  const weekGoal = weekGoalPct(data);
  const pct = weekGoal.pct;
  const exams = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const lastCalc = data.calcs[0];
  const day = todaySchedule(data);
  const count = examCountdown(data.examDate);
  const coach = useMemo(() => coachAdvice(data), [data]);
  const elite = useMemo(() => eliteReport(data), [data]);
  const recs = useMemo(() => weakBankTopics(data, 3), [data]);
  const lastQ = useMemo(() => lastBankTopic(data), [data]);

  function openBank(level: string, subject?: string | null, topic?: string | null) {
    setBankJump({ level, subject, topic });
    go('questionbank');
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>{user ? `Sınav temposu • ${elite.phase}` : 'Öğrenci E-Koçluk'}</div>
        <h2>{user ? `Hoş geldin, ${name}` : 'Sınav temposunu tek panelde tut.'}</h2>
        <p>{user ? 'Bu panel yalnızca senin verin.' : 'Hedef, program, deneme ve soru bankası. Ücretsiz hesap; kart çekilmez.'}</p>
        {user ? (
          <>
            <p>{displayText(data.grade)} • {displayAge(data.age)} • {displayText(data.dept)} • {displayText(data.track)} • hedef sıralama {displayRank(data.rank)}</p>
            <div className="countdown-pill">{data.examDate ? (count.past ? 'Sınav tarihi geçti' : `${examTitle(data)}’ye ${count.label}`) : 'Sınav tarihi belirtilmedi'}{data.examDate ? ` • ${data.examDate}` : ''}</div>
          </>
        ) : (
          <div className="countdown-pill">Ücretsiz kayıt • koç başvurusu aynı sitede</div>
        )}
        <div className="hero-actions">
          {!user ? <button className="btn" type="button" onClick={() => go('account')}>Giriş / kayıt</button> : null}
          <button className="btn" type="button" onClick={() => go('goal')}>Hedef / yaş</button>
          <button className="btn" type="button" onClick={() => go('questionbank')}>Soru Bankası</button>
          {user ? (
            <>
              <button className="btn" type="button" onClick={() => go('plan')}>Akıllı Plan</button>
              <button className="btn" type="button" onClick={() => go('schedule')}>Ders Programım</button>
              <button className="btn" type="button" onClick={onNewTask}>Görev Ekle</button>
              <button className="btn" type="button" onClick={() => go('timer')}>Çalışmaya başla</button>
              <button className="btn" type="button" onClick={() => go('topics')}>Konular</button>
            </>
          ) : (
            <button className="btn" type="button" onClick={() => go('coaches')}>Koçlar</button>
          )}
        </div>
      </div>
      {!user ? (
        <div className="success" style={{ marginTop: 16 }}>
          Panel misafirken yerel kalır. Kayıt olunca aynı veriler hesabına bağlanır.
          <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('account')}>Giriş yap</button>
        </div>
      ) : (
        <div className="success" style={{ marginTop: 16 }}>
          Giriş açık. E-Koç sohbeti hesabınla sunucuya gider.
        </div>
      )}
      {profileIncomplete ? (
        <div className="notice" style={{ marginTop: 12 }}>
          Yaş, sınıf, alan ve hedef henüz belirtilmedi. Bu alanlar otomatik doldurulmaz.
          <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('goal')}>Profili doldur</button>
        </div>
      ) : null}
      <div className="grid stats">
        <div className="card stat"><div className="label">🎯 HEDEF SIRALAMA</div><div className="value">{displayRank(data.rank)}</div><div className="sub">{displayText(data.track)} • {displayText(data.dept)}</div></div>
        <div className="card stat"><div className="label">📚 BUGÜN</div><div className="value">{mins} dk</div><div className="sub">{sessions.length} oturum</div></div>
        <div className="card stat"><div className="label">✅ GÖREV</div><div className="value">{todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0}%</div><div className="sub">{done} / {todayTasks.length} bugün</div></div>
        <div className="card stat"><div className="label">🔥 SERİ</div><div className="value">{streak} gün</div><div className="sub">Çalışma serin</div></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>Bugünün temposu</h3><span>{elite.headline}</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55, marginTop: 0 }}>{coach.msg}</p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => lastQ ? openBank(lastQ.levelName, lastQ.subject, lastQ.topic) : go('questionbank')}>
            {lastQ ? `Devam: ${lastQ.topic}` : '🧠 Soru Bankası'}
          </button>
          <button className="btn secondary" type="button" onClick={() => go('plan')}>Çalışma planı</button>
          <button className="btn secondary" type="button" onClick={() => go('timer')}>{elite.dailyMin} dk blok</button>
        </div>
        {recs.length ? (
          <div style={{ marginTop: 12 }}>
            {recs.map((r) => (
              <div className="plan-item" key={r.key}>
                <span>{r.topic}<br /><small style={{ color: 'var(--muted)' }}>{r.subject} • %{r.acc} • {r.wrong} yanlış</small></span>
                <button className="btn secondary" type="button" onClick={() => openBank(r.levelName, r.subject, r.topic)}>Çöz</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid cols">
        <div className="card">
          <div className="section-title"><h3>Bugünün görevleri</h3><button className="btn secondary" type="button" onClick={onNewTask}>＋ Ekle</button></div>
          <TaskRows tasks={todayTasks.slice(0, 8)} />
        </div>
        <div className="card">
          <div className="section-title"><h3>Hedef durumu</h3><span>Bu hafta</span></div>
          <div className="kpi"><div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Haftalık hedef</span><br /><b>{weekGoal.hoursLabel}</b></div><span className="chip">{pct}%</span></div>
          <div className="progress"><i style={{ width: `${pct}%` }} /></div>
          <div className="chip" style={{ marginTop: 12 }}>{elite.dailyQ} soru / {elite.dailyMin} dk hedef</div>
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title">
            <h3>🗓️ Bugünün programı</h3>
            {day?.blocks.length ? (
              <button className="btn secondary" type="button" onClick={() => {
                const exist = new Set(todayTasks.map((t) => t.title));
                const extra = blocksToTasks(day).filter((t) => !exist.has(t.title));
                if (!extra.length) return toast('Bugünün blokları zaten görevlerde.');
                setData({ ...data, tasks: [...extra, ...data.tasks] });
                toast(`${extra.length} blok göreve alındı`);
              }}>Görevlere aktar</button>
            ) : <button className="btn secondary" type="button" onClick={() => go('schedule')}>Üret</button>}
          </div>
          {day?.blocks.length ? day.blocks.map((b, i) => (
            <div className="plan-item" key={`${b.title}-${i}`}><span>{b.icon} {b.title}</span><b>{b.minutes} dk</b></div>
          )) : <div className="empty">Haftalık program yok. Ders Programım’dan üret.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>📈 Son performans</h3></div>
          {lastCalc ? <div className="plan-item"><span>Son net • {lastCalc.type}</span><b>{Number(lastCalc.net).toFixed(2)}</b></div> : null}
          {exams.length ? exams.map((x) => (
            <div className="plan-item" key={x.id}><span>{x.name}</span><b>{x.tyt} TYT</b></div>
          )) : !lastCalc ? <div className="empty">Henüz deneme kaydı yok.</div> : null}
        </div>
      </div>
      <div style={{ marginTop: 16 }}><ExamInsight /></div>
    </>
  );
}
