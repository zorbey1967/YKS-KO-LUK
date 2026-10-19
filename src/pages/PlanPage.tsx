import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { askDailyPlan } from '../lib/coachAi';
import { publicCoachBrand } from '../lib/zoroText';
import { fmtDate, today, uid } from '../lib/util';
import { canUseFeature } from '../lib/subscription';
import { appendGeneratedTasks } from '../lib/coachPlan';
import { resetAiCoachCache } from '../lib/aiCoachAnalysis';
import {
  acceptPlanChange,
  clearStudentSmartPlan,
  getStudentProgress,
  invalidateStudentProgress,
} from '../lib/studentProgress';
import {
  createCoachProgramPdfSignedUrl,
  listMyCoachProgramPdfs,
  type CoachProgramPdf,
} from '../lib/coachProgramPdfCloud';

export function PlanPage() {
  const { data, setData, toast, profile, isAdmin, go, user } = useApp();
  const aiPlan = canUseFeature(profile, 'ai_plan', Date.now(), isAdmin);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [holdChange, setHoldChange] = useState(false);
  const [coachPdfs, setCoachPdfs] = useState<CoachProgramPdf[]>([]);
  const state = useMemo(() => getStudentProgress(data), [data]);
  const weekGoalHours = data.weekHours > 0 ? data.weekHours : null;

  useEffect(() => {
    if (!user?.id) {
      setCoachPdfs([]);
      return;
    }
    let alive = true;
    void listMyCoachProgramPdfs().then((res) => {
      if (!alive) return;
      if (res.ok) setCoachPdfs(res.rows.filter((r) => r.student_id === user.id));
    });
    return () => { alive = false; };
  }, [user?.id]);

  async function saveCloud() {
    if (!aiPlan) {
      toast('Akıllı Plan için üyelik veya deneme gerekir.');
      return;
    }
    setBusy(true);
    try {
      const res = await askDailyPlan(data, state.capacity.typicalDayMinutes, 'Eksik konular');
      // Yerel generatePlan yedeği UI’ya yazılmaz — “Sunucu ile plan” uydurma plan göstermez.
      if (res.source !== 'ai' || !res.blocks.length) {
        setNote('');
        toast(res.summary || 'Sunucu planı alınamadı. Yerel plan otomatik kaydedilmez.');
        return;
      }
      setData({ ...data, plan: res.blocks, planDate: today() });
      invalidateStudentProgress();
      setNote(`${res.summary} • ${publicCoachBrand()}`);
      toast('AI planı hazır');
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
            Akıllı Plan; deneme sonuçlarına, hedeflerine ve çalışmak istediğin süreye göre kişiselleştirilir.
            Netler, yaklaşan yazılı/sınavlar, sınıf/alan, tamamlanan konular ve tipik çalışma temposu da dikkate alınır
            {weekGoalHours != null ? ` (haftalık hedef: ${weekGoalHours} saat)` : ''}.
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
            <div className="empty">Plan yok. Sunucu ile plan üret — sayfa açılışında AI çağrılmaz. Uydurma plan yok.</div>
          )}
          <div className="actions" style={{ marginTop: 12 }}>
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
            <button className="btn danger" type="button" onClick={deletePlan}>Planı Sil</button>
          </div>
          {note ? <div className="success" style={{ marginTop: 12 }}>{note}</div> : null}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Koçun Programı</h3></div>
          <p className="muted">Koçunun yüklediği PDF. Kendi ders programı PDF’nden ayrıdır.</p>
          {coachPdfs.length ? coachPdfs.map((r) => (
            <div className="plan-item" key={r.id}>
              <span>
                {r.file_name}
                <br />
                <small className="muted">{new Date(r.created_at).toLocaleString('tr-TR')}</small>
              </span>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  void createCoachProgramPdfSignedUrl(r.storage_path).then((url) => {
                    if (!url) {
                      toast('PDF açılamadı.');
                      return;
                    }
                    window.open(url, '_blank', 'noopener,noreferrer');
                  });
                }}
              >
                PDF’yi aç
              </button>
            </div>
          )) : <div className="empty">Koç henüz program PDF’i yüklemedi.</div>}
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
