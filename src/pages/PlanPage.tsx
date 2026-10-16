import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { askDailyPlan } from '../lib/coachAi';
import { publicCoachBrand } from '../lib/zoroText';
import { fmtDate, today, uid } from '../lib/util';
import { canUseFeature } from '../lib/subscription';
import { appendGeneratedTasks } from '../lib/coachPlan';
import {
  acceptPlanChange,
  generateLivingPlan,
  getStudentProgress,
  type SubjectCard,
} from '../lib/studentProgress';

export function PlanPage() {
  const { data, setData, toast, profile, isAdmin, go } = useApp();
  const aiPlan = canUseFeature(profile, 'ai_plan', Date.now(), isAdmin);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [openSubject, setOpenSubject] = useState('');
  const [holdChange, setHoldChange] = useState(false);
  const state = useMemo(() => getStudentProgress(data), [data]);

  function saveLocal() {
    const blocks = generateLivingPlan(data, state.capacity.typicalDayMinutes);
    setData({ ...data, plan: blocks, planDate: today() });
    setNote('Yerel koç — kayıtlı çalışma kapasitesi ve konu durumuna göre.');
    toast('Plan güncellendi');
  }

  async function saveCloud() {
    setBusy(true);
    try {
      const res = await askDailyPlan(data, state.capacity.typicalDayMinutes, 'Eksik konular');
      setData({ ...data, plan: res.blocks, planDate: today() });
      setNote(res.summary + (res.source === 'ai' ? ` • ${publicCoachBrand()}` : ' • Yerel yedek'));
      toast(res.source === 'ai' ? 'AI planı hazır' : 'Yerel koç planı hazır');
    } finally {
      setBusy(false);
    }
  }

  function SubjectBlock({ card }: { card: SubjectCard }) {
    const open = openSubject === card.subject;
    return (
      <div className="topic-row">
        <button className="topic-head" type="button" style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setOpenSubject(open ? '' : card.subject)}>
          <span><b>{card.subject}</b><small className="muted"> %{card.progress} · {card.done} tamam · {card.inProgress} devam · {card.notStarted} başlamadı</small></span>
          <span>Tüm konuları gör</span>
        </button>
        <div className="progress"><i style={{ width: `${card.progress}%` }} /></div>
        {open ? card.topics.map((t) => (
          <div key={t.name} className="kpi" style={{ marginTop: 8 }}>
            <div>
              {t.status === 'done' ? '🟢' : t.status === 'in_progress' ? '🟡' : '⚪'} {t.name}
              <br />
              <small className="muted">
                %{t.level}
                {t.studyMinutes ? ` · ${t.studyMinutes} dk çalışma` : ''}
                {t.lastStudy ? ` · son ${fmtDate(t.lastStudy)}` : ''}
                {t.source === 'inferred' ? ' · çalışma/denemeden' : ''}
              </small>
            </div>
          </div>
        )) : null}
      </div>
    );
  }

  if (!data.grade) {
    return (
      <div className="card notice">
        <h3>Akıllı Plan</h3>
        <p>Sınıf ve hedef Hesabım’dan gelir. Yaş veya sınıfı burada tekrar sormuyoruz.</p>
        <button className="btn primary" type="button" onClick={() => go('account')}>Hesabım’a git</button>
      </div>
    );
  }

  return (
    <div className="grid two">
      <div>
        <div className="card">
          <div className="section-title">
            <h3>Akıllı Plan</h3>
            <span>{data.grade}{data.track ? ` · ${data.track}` : ''}{data.dept ? ` · ${data.dept}` : ''}</span>
          </div>
          <p style={{ marginTop: 0 }}>
            Bu plan deneme sonuçların, günlük/haftalık ne kadar çalışmak istediğin ve hedefin doğrultusunda hazırlanır.
          </p>
          <p className="muted">
            Ayrıca sınıfın, alanın, konu ilerlemen, koç programı ve yaklaşan sınavların dikkate alınır. Koç programı varsa kendi planın onunla çakışmayacak şekilde üretilir; onayın olmadan değişmez.
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            Bugün {state.capacity.todayTotal} dk (program {state.capacity.todaySchedule} · çalışma saati {state.capacity.todayTimer} · kütüphane {state.capacity.todayLibrary}).
            Tipik tempo {state.capacity.typicalDayMinutes} dk.
          </p>
          {state.todayFocus.length ? state.todayFocus.map((x) => (
            <div className="subject" key={`f-${x.order}`} style={{ marginBottom: 8 }}>
              <div className="subject-icon">{x.order}</div>
              <div>
                <strong>{x.clock ? `${x.clock} ` : ''}{x.subject}{x.topic ? ` / ${x.topic}` : ''} — {x.minutes} dk</strong>
                <small className="muted"> {x.reason}</small>
              </div>
            </div>
          )) : null}
          {data.plan.length ? data.plan.map((x, i) => (
            <div className="subject" key={`${x.text}-${i}`} style={{ marginBottom: 8 }}>
              <div className="subject-icon">{x.icon}</div>
              <div><strong>{x.text}</strong><small className="muted"> {x.minutes} dk</small></div>
            </div>
          )) : (!state.todayFocus.length ? (
            <div className="empty">Henüz günlük blok yok. Aşağıdan üret — sayfa açılışında AI çağrılmaz.</div>
          ) : null)}
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn" type="button" disabled={busy} onClick={saveLocal}>Yerel üret</button>
            <button className="btn primary" type="button" disabled={busy || !aiPlan} onClick={() => void saveCloud()}>{busy ? 'Hazırlanıyor…' : 'Sunucu ile plan'}</button>
            <button className="btn" type="button" onClick={() => {
              if (!data.plan.length) return toast('Önce plan oluştur.');
              setData(appendGeneratedTasks(data, data.plan.map((x) => ({
                id: uid('p_'),
                title: x.text,
                subject: 'Plan',
                minutes: x.minutes,
                priority: 'Normal',
                done: false,
                date: today(),
                origin: 'zorro' as const,
              }))));
              toast('Plan görevlerine aktarıldı');
            }}>Görevlere aktar</button>
          </div>
          {note ? <div className="success" style={{ marginTop: 12 }}>{note}</div> : null}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>İlerlemem</h3><span>{state.subjects.length} ders</span></div>
          {state.subjects.slice(0, 12).map((card) => <SubjectBlock key={card.subject} card={card} />)}
        </div>
      </div>

      <div>
        <div className="card">
          <div className="section-title"><h3>Son deneme</h3></div>
          {state.lastExam ? (
            <>
              <p><b>{state.lastExam.name}</b> · {fmtDate(state.lastExam.date)}</p>
              <p>TYT {state.lastExam.tyt} · AYT {state.lastExam.ayt}{state.lastExam.delta != null ? ` · Δ ${state.lastExam.delta > 0 ? '+' : ''}${state.lastExam.delta}` : ''}</p>
              {state.insights.narrative ? <p className="muted">{state.insights.narrative}</p> : null}
              <div className="actions"><button className="btn secondary" type="button" onClick={() => go('exams')}>Denemeler</button></div>
            </>
          ) : <div className="empty">Kayıtlı deneme yok.</div>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Eksiklerim</h3></div>
          {state.gaps.length ? state.gaps.map((g) => (
            <div className="kpi" key={`${g.subject}-${g.name}`}><div>{g.subject} / {g.name}</div><span className="chip">%{g.level}</span></div>
          )) : <p className="muted">Öncelikli eksik konu yok.</p>}
          {state.coachTasks.length ? <p className="muted">Koç: {state.coachTasks.join(' · ')}</p> : null}
          <p className="muted">Görevler: {state.tasks.open} açık · {state.tasks.overdue} gecikmiş · {state.tasks.done} bitti</p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Program değişikliği</h3></div>
          {state.planChange.needed && !holdChange ? (
            <>
              <p><span className="chip">Öneriliyor</span> Programınızda değişiklik yapılmasını öneriyoruz.</p>
              <p className="muted">{state.planChange.reason}</p>
              {state.planChange.conflictsCoach ? <p className="notice">Koçun Programı otomatik değişmez.</p> : null}
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => {
                  setData(acceptPlanChange(data, state.capacity.typicalDayMinutes));
                  setHoldChange(false);
                  toast('Uygulandı');
                }}>Programı Güncelle</button>
                <button className="btn secondary" type="button" onClick={() => setHoldChange(true)}>Şimdilik Değiştirme</button>
              </div>
            </>
          ) : <p className="muted">{holdChange && state.planChange.needed ? 'Öneri duruyor; Ders Programım değişmedi.' : state.planChange.reason}</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Yazılı Hazırlık Planı</h3></div>
          <p className="muted">Akıllı Plan ve Ders Programım’ın yerine geçmez.</p>
          {state.upcomingExams.length ? state.upcomingExams.map((e) => (
            <div key={e.examId} className="topic-row">
              <div className="topic-head"><b>{e.title}</b><span className="chip">{e.daysLeft} gün · {e.period}</span></div>
              <small className="muted">{e.kind === 'yazili' ? 'Yazılı' : e.kind} · Eksik: {e.missing.slice(0, 3).join(', ') || '—'} · Devam: {e.ongoing.slice(0, 2).join(', ') || '—'}</small>
              {e.days.map((d) => <p key={d.title} className="muted" style={{ margin: '4px 0' }}>{d.title} — {d.body}</p>)}
            </div>
          )) : <div className="empty">Takvim’de yakın sınav yok.</div>}
        </div>

        {state.weekFocus.some((d) => d.minutes) ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Ders Programım</h3></div>
            {state.weekFocus.map((d) => (
              <div className="kpi" key={d.day}><div>{d.day}<br /><small className="muted">{d.titles.join(', ') || 'boş'}</small></div><b>{d.minutes} dk</b></div>
            ))}
          </div>
        ) : null}

        {state.coachWeekFocus.some((d) => d.minutes) ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Koçun Programı</h3></div>
            {state.coachToday.length ? <p className="muted">Bugün: {state.coachToday.map((b) => `${b.title} ${b.minutes} dk`).join(' · ')}</p> : null}
            {state.coachWeekFocus.map((d) => (
              <div className="kpi" key={`c-${d.day}`}><div>{d.day}<br /><small className="muted">{d.titles.join(', ') || 'boş'}</small></div><b>{d.minutes} dk</b></div>
            ))}
          </div>
        ) : <div className="card" style={{ marginTop: 16 }}><div className="section-title"><h3>Koçun Programı</h3></div><p className="muted">Koç henüz program yazmadı. Uydurma program yok.</p></div>}

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Haftalık tempo</h3></div>
          {state.capacity.weekTrend.map((d) => (
            <div className="kpi" key={d.date}><div>{d.day}</div><b>{d.minutes} dk</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}
