import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { askDailyPlan } from '../lib/coachAi';
import { publicCoachBrand } from '../lib/zoroText';
import { today, uid } from '../lib/util';
import { canUseFeature } from '../lib/subscription';
import { appendGeneratedTasks } from '../lib/coachPlan';
import { resetAiCoachCache } from '../lib/aiCoachAnalysis';
import {
  acceptPlanChange,
  clearStudentSmartPlan,
  generateLivingPlan,
  getStudentProgress,
  invalidateStudentProgress,
} from '../lib/studentProgress';

export function PlanPage() {
  const { data, setData, toast, profile, isAdmin, go } = useApp();
  const aiPlan = canUseFeature(profile, 'ai_plan', Date.now(), isAdmin);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [holdChange, setHoldChange] = useState(false);
  const state = useMemo(() => getStudentProgress(data), [data]);
  const weekGoalHours = data.weekHours > 0 ? data.weekHours : null;

  function saveLocal() {
    const blocks = generateLivingPlan(data, state.capacity.typicalDayMinutes);
    if (!blocks.length && !state.gaps.length && !state.lastExam && !state.upcomingExams.length) {
      setNote('Yeterli deneme/konu/sınav verisi yok; uydurma plan üretilmedi.');
      toast('Veri yok — plan uydurulmadı');
      return;
    }
    setData({ ...data, plan: blocks, planDate: today() });
    invalidateStudentProgress();
    setNote('Deneme netleri, yaklaşan sınavlar, çalışma hedefi, sınıf/alan ve koç programı dikkate alındı. Koç programı değiştirilmedi.');
    toast('Plan güncellendi');
  }

  async function saveCloud() {
    setBusy(true);
    try {
      const res = await askDailyPlan(data, state.capacity.typicalDayMinutes, 'Eksik konular');
      setData({ ...data, plan: res.blocks, planDate: today() });
      invalidateStudentProgress();
      setNote(res.summary + (res.source === 'ai' ? ` • ${publicCoachBrand()}` : ' • Yerel yedek'));
      toast(res.source === 'ai' ? 'AI planı hazır' : 'Yerel koç planı hazır');
    } finally {
      setBusy(false);
    }
  }

  function deletePlan() {
    const hasPlanTasks = data.tasks.some((t) => t.origin === 'zorro' || t.subject === 'Plan');
    if (!data.plan.length && !data.planDate && !hasPlanTasks) return toast('Silinecek plan yok.');
    if (!confirm('Akıllı Plan tamamen silinsin mi? Plan görevleri de kalkar. Koçun Programı silinmez.')) return;
    setData((prev) => clearStudentSmartPlan(prev));
    resetAiCoachCache();
    setNote('');
    setHoldChange(false);
    toast('Plan silindi');
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
            Akıllı Plan; deneme sonuçlarına ve netlerine, yaklaşan yazılı/sınavlarına, çalışma hedefine
            {weekGoalHours != null ? ` (haftada ${weekGoalHours} saat)` : ''}, sınıf/yaş/alan bilgine ve tamamlanan konulara göre oluşturulur.
            Koçun Programı varsa çelişki uyarılır; koç programı değiştirilmez veya kopyalanmaz.
          </p>
          <p className="muted">
            Veri yoksa uydurma sonuç üretilmez. Kapasite tipik tempo: {state.capacity.typicalDayMinutes} dk/gün.
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            Bugün {state.capacity.todayTotal} dk (program {state.capacity.todaySchedule} · çalışma saati {state.capacity.todayTimer} · kütüphane {state.capacity.todayLibrary}).
          </p>
          {data.plan.length ? data.plan.map((x, i) => (
            <div className="subject" key={`${x.text}-${i}`} style={{ marginBottom: 8 }}>
              <div className="subject-icon">{x.icon}</div>
              <div><strong>{x.text}</strong><small className="muted"> {x.minutes} dk</small></div>
            </div>
          )) : (
            <div className="empty">Henüz plan yok. “Plan oluştur” ile kayıtlarına göre bugünün planını hazırla.</div>
          )}
          <div className="actions" style={{ marginTop: 12 }}>
            {/* Tek "plan oluştur": ZORRO açıksa sunucuda, değilse kayıtlarından yerel plan. */}
            <button className="btn primary" type="button" disabled={busy} onClick={() => (aiPlan ? void saveCloud() : saveLocal())}>{busy ? 'Hazırlanıyor…' : data.plan.length ? 'Planı yenile' : 'Plan oluştur'}</button>
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
            <button className="btn danger" type="button" onClick={deletePlan}>Planı Sil</button>
          </div>
          {note ? <div className="success" style={{ marginTop: 12 }}>{note}</div> : null}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Koçun Programı</h3></div>
          <p className="muted" style={{ marginTop: 0 }}>Koçunun programı Ders Programı sayfasında; Akıllı Plan onu değiştirmez veya kopyalamaz.</p>
          <div className="actions"><button className="btn secondary" type="button" onClick={() => go('schedule')}>Ders Programı’nı aç</button></div>
        </div>
      </div>

      <div>

        <div className="card">
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
              <small className="muted">{e.kind === 'yazili' ? 'Yazılı' : e.kind === 'yks' ? 'TYT / AYT' : e.kind.toLocaleUpperCase('tr-TR')} · Eksik: {e.missing.slice(0, 3).join(', ') || '—'} · Devam: {e.ongoing.slice(0, 2).join(', ') || '—'}</small>
              {e.days.map((d) => <p key={d.title} className="muted" style={{ margin: '4px 0' }}>{d.title} — {d.body}</p>)}
            </div>
          )) : <div className="empty">Takvim’de yakın sınav yok.</div>}
        </div>

      </div>
    </div>
  );
}
