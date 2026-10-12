import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ExamPlanRecord, ExamTarget } from '../lib/types';
import { ExamCountdownCard } from './ExamCountdownCard';
import { ExamForm } from './ExamForm';
import { monthCells, monthTitle, WEEKDAYS } from '../lib/calendar';
import { countdownKindLabel, remainingClock } from '../lib/countdown';
import { emptyExamTarget, examDateForLegacy, primaryExam, splitExams, upsertExam, withPrimary, clearAiExamPlan } from '../lib/examTargets';
import { istanbulToday } from '../lib/meeting';
import { askExamPlan } from '../lib/coachAi';
import { examPlanInstruction, localExamPlanDraft } from '../lib/studyPlanner';
import { canUseBrowserNotify, requestBrowserNotify } from '../lib/examNotify';
import { buildScheduleWithAi } from '../lib/aiSchedule';
import { generateWeeklySchedule } from '../lib/schedule';

type Tab = 'sinavlar' | 'takvim' | 'ai';
type ListTab = 'upcoming' | 'past';

export function ExamCenter() {
  const { data, setData, toast } = useApp();
  const today = istanbulToday();
  const [tab, setTab] = useState<Tab>('sinavlar');
  const [listTab, setListTab] = useState<ListTab>('upcoming');
  const [modal, setModal] = useState<ExamTarget | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y, m: (m || 1) - 1 };
  });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<ExamTarget | null>(null);
  const [confirmPlanDel, setConfirmPlanDel] = useState(false);
  const [editPlan, setEditPlan] = useState<ExamPlanRecord | null>(null);
  const [showPlanBody, setShowPlanBody] = useState(true);

  const targets = data.examTargets || [];
  const primary = primaryExam(targets);
  const { upcoming, past } = useMemo(() => splitExams(targets, today), [targets, today]);
  const stalePlan = Boolean(data.examPlan && primary && data.examPlan.examDate && data.examPlan.examDate !== primary.date);

  function saveTargets(next: ExamTarget[], extra?: Partial<typeof data>) {
    setData({ ...data, ...extra, examTargets: next, examDate: examDateForLegacy(next) || data.examDate });
  }

  function openNew() {
    const draft = emptyExamTarget();
    draft.isPrimary = !targets.length;
    setModal(draft);
  }

  return (
    <section className="exam-hub">
      <div className="hero exam-hub-hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Sınav Merkezim</div>
        <h2>Sınavlarını, hedeflerini ve çalışma planını tek yerden yönet.</h2>
        <p>Tarihler Türkiye saatine göre. Ana sınav countdown’u gerçek zamanlıdır. AI mevcut programı onaysız değiştirmez.</p>
        <div className="hero-actions">
          <button className="btn primary" type="button" onClick={openNew}>+ Sınav Ekle</button>
          <button className="btn" type="button" onClick={() => setTab('takvim')}>Takvim</button>
          <button className="btn" type="button" onClick={() => setTab('ai')}>AI Planım</button>
        </div>
      </div>

      <div className="exam-tabs" role="tablist">
        {([['sinavlar', 'Sınavlarım'], ['takvim', 'Takvim'], ['ai', 'AI Planım']] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'sinavlar' && (
        <>
          {primary ? <ExamCountdownCard exam={primary} /> : (
            <div className="card exam-empty">
              <h3>İlk sınavını ekle</h3>
              <p className="muted">YKS, LGS, KPSS veya kendi sınavını seç. Tarih sende; şablon tarih dayatılmaz.</p>
              <button className="btn primary" type="button" onClick={openNew}>Sınav Ekle</button>
            </div>
          )}
          {upcoming.length > 1 ? (
            <div className="exam-mini-grid">
              <h3 className="exam-subh">Yaklaşan sınavların</h3>
              {upcoming.map((t) => {
                const c = remainingClock(t.date, t.startTime, Date.now(), t.endTime);
                return (
                  <button key={t.id} type="button" className={`exam-mini ${t.isPrimary ? 'is-primary' : ''} exam-mini--${c.phase}`} onClick={() => setDetail(t)}>
                    <strong>{t.title}</strong>
                    <span>{c.headline}</span>
                    {t.isPrimary ? <em>Ana sınav</em> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">
              <h3>Sınav listesi</h3>
              <div className="exam-seg">
                <button type="button" className={listTab === 'upcoming' ? 'active' : ''} onClick={() => setListTab('upcoming')}>Yaklaşan</button>
                <button type="button" className={listTab === 'past' ? 'active' : ''} onClick={() => setListTab('past')}>Geçmiş</button>
              </div>
            </div>
            {(listTab === 'upcoming' ? upcoming : past).length === 0 ? (
              <div className="empty">{listTab === 'upcoming' ? 'Yaklaşan sınav yok.' : 'Geçmiş sınav yok. Silinmez; arşiv burada.'}</div>
            ) : (listTab === 'upcoming' ? upcoming : past).map((t) => {
              const c = remainingClock(t.date, t.startTime, Date.now(), t.endTime);
              return (
                <div className="exam-row" key={t.id}>
                  <div>
                    <b>{t.title}</b>
                    <small className="muted">{t.kind} • {t.date}{t.startTime ? ` ${t.startTime}` : ''} • {c.headline}</small>
                  </div>
                  <div className="exam-row-actions">
                    <button className="btn secondary" type="button" onClick={() => setDetail(t)}>Detay</button>
                    <button className="btn" type="button" onClick={() => setModal(t)}>Düzenle</button>
                    <button className="btn danger" type="button" onClick={() => setConfirmId(t.id)}>Sil</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Bildirimler</h3></div>
            <p className="muted">Web Push sunucusu yok. Açık sekmede uygulama içi uyarı (7 / 3 / 1 gün ve sınav günü) çalışır. Tarayıcı izni varsa aynı metin gösterilir; gizli VAPID kurulumu yok.</p>
            <label className="exam-check"><input type="checkbox" checked={data.examNotifyPrefs.exams} onChange={(e) => setData({ ...data, examNotifyPrefs: { ...data.examNotifyPrefs, exams: e.target.checked } })} /> Sınav bildirimleri</label>
            <label className="exam-check"><input type="checkbox" checked={data.examNotifyPrefs.ai} onChange={(e) => setData({ ...data, examNotifyPrefs: { ...data.examNotifyPrefs, ai: e.target.checked } })} /> AI plan bildirimleri (uygulama içi)</label>
            <label className="exam-check"><input type="checkbox" checked={data.examNotifyPrefs.tasks} onChange={(e) => setData({ ...data, examNotifyPrefs: { ...data.examNotifyPrefs, tasks: e.target.checked } })} /> Görev hatırlatmaları (kayıt; ayrı push yok)</label>
            {canUseBrowserNotify() ? (
              <button className="btn" type="button" onClick={() => void requestBrowserNotify().then((r) => toast(r === 'granted' ? 'Tarayıcı bildirimi açık' : r === 'unsupported' ? 'Bu tarayıcı bildirim desteklemiyor' : 'İzin verilmedi'))}>Tarayıcı izni iste</button>
            ) : null}
          </div>
        </>
      )}

      {tab === 'takvim' && (
        <ExamMonth
          year={cursor.y}
          month0={cursor.m}
          selected={selectedDay}
          targets={targets}
          onSelect={setSelectedDay}
          onPrev={() => setCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })}
          onNext={() => setCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })}
          onToday={() => {
            const [y, m] = today.split('-').map(Number);
            setCursor({ y, m: (m || 1) - 1 });
            setSelectedDay(today);
          }}
          onAdd={openNew}
          onOpen={(t) => setDetail(t)}
        />
      )}

      {tab === 'ai' && (
        <div className="card">
          <div className="section-title">
            <h3>AI Sınav Planım</h3>
            <span>{busy ? 'oluşturuluyor' : data.examPlanDraft ? 'güncelleme önerisi var' : err && !data.examPlan ? 'hata' : data.examPlan ? 'hazır' : 'yok'}</span>
          </div>
          {stalePlan ? (
            <div className="notice banner">Sınav tarihi değişti. Yeni tarihe göre plan önerisi üretelim mi?
              <div className="actions">
                <button className="btn primary" type="button" disabled={!!busy} onClick={() => void runPlan(true)}>Yeni öneri hazırla</button>
                <button className="btn" type="button" onClick={() => setData({ ...data, examPlan: data.examPlan ? { ...data.examPlan, examDate: primary?.date || data.examPlan.examDate } : data.examPlan })}>Mevcut planı koru</button>
              </div>
            </div>
          ) : null}
          {err ? <div className="notice">{err}</div> : null}
          {busy ? <div className="notice">{busy}</div> : null}
          {data.examPlanDraft ? (
            <div className="notice banner">
              Mevcut verilerine göre yeni bir çalışma planı önerildi. Onaylamadan mevcut plan ezilmez.
              <p><b>{data.examPlanDraft.summary}</b></p>
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => {
                  setData({ ...data, examPlan: { ...data.examPlanDraft!, pendingSchedule: data.examPlan?.pendingSchedule || null }, examPlanDraft: null });
                  toast('Yeni plan uygulandı');
                }}>Yeni Planı Uygula</button>
                <button className="btn" type="button" onClick={() => setData({ ...data, examPlanDraft: null })}>Mevcut Planı Koru</button>
              </div>
            </div>
          ) : null}
          {data.examPlan ? (
            <>
              <p className="muted">AI çalışma planın hazır{data.examPlan.source === 'local' ? ' (yerel taslak; model bağlanamadı)' : ''}.</p>
              {showPlanBody ? (
                <>
                  <p><b>{data.examPlan.summary}</b></p>
                  {data.examPlan.weekHint ? <p className="muted">{data.examPlan.weekHint}</p> : null}
                  {data.examPlan.advice ? <p>{data.examPlan.advice}</p> : null}
                  {data.examPlan.stages.map((s, i) => (
                    <div className="plan-item" key={i}><span><b>{s.title}</b><br /><small>{s.body}</small></span></div>
                  ))}
                  {data.examPlan.lastWeek ? <p><b>Son Hafta Modu</b><br />{data.examPlan.lastWeek}</p> : null}
                </>
              ) : null}
              {data.examPlan.pendingSchedule ? (
                <div className="notice banner">Programında değişiklik öneriyorum. Onaylamadan mevcut program duruyor.
                  <div className="actions">
                    <button className="btn primary" type="button" onClick={() => {
                      const sch = data.examPlan?.pendingSchedule;
                      if (!sch) return;
                      setData({ ...data, schedule: sch, examPlan: { ...data.examPlan!, pendingSchedule: null } });
                      toast('Program uygulandı');
                    }}>Programı uygula</button>
                    <button className="btn" type="button">Sadece öneriyi gör</button>
                    <button className="btn danger" type="button" onClick={() => setData({ ...data, examPlan: { ...data.examPlan!, pendingSchedule: null } })}>Vazgeç</button>
                  </div>
                </div>
              ) : null}
              <div className="actions">
                <button className="btn primary" type="button" onClick={() => setShowPlanBody((v) => !v)}>{showPlanBody ? 'Planı gizle' : 'AI Planını Gör'}</button>
                <button className="btn" type="button" onClick={() => setEditPlan({ ...data.examPlan! })}>Düzenle</button>
                <button className="btn" type="button" disabled={!!busy || !primary} onClick={() => void runPlan(true)}>Yeniden Oluştur</button>
                <button className="btn" type="button" disabled={!!busy || !primary} onClick={() => void proposeSchedule()}>Program öner</button>
                <button className="btn danger" type="button" onClick={() => setConfirmPlanDel(true)}>Planı Sil</button>
              </div>
            </>
          ) : (
            <div className="empty">
              Henüz AI çalışma planın oluşturulmadı.
              <div className="actions" style={{ marginTop: 10 }}>
                <button className="btn primary" type="button" disabled={!!busy || !primary} onClick={() => void runPlan(true)}>AI ile Yeni Plan Oluştur</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal ? (
        <ExamForm
          draft={modal}
          onClose={() => setModal(null)}
          onSave={(row) => {
            saveTargets(upsertExam(targets, row));
            setModal(null);
            toast(row.id && targets.some((t) => t.id === row.id) ? 'Sınav güncellendi' : 'Sınavın oluşturuldu.');
            setTab('sinavlar');
          }}
        />
      ) : null}

      {detail ? (
        <ExamDetail exam={detail} plan={data.examPlan} onClose={() => setDetail(null)} onEdit={() => { setModal(detail); setDetail(null); }} onPrimary={() => { saveTargets(withPrimary(targets, detail.id)); setDetail(null); }} />
      ) : null}

      {confirmId ? (
        <div className="modal" role="dialog">
          <div className="modal-box">
            <h3>Sınav silinsin mi?</h3>
            <p>Bu işlem geri alınamaz. Countdown ve bildirim bu kaydı kullanmaz.</p>
            {data.examPlan && (data.examPlan.examId === confirmId || data.examPlan.examDate === targets.find((t) => t.id === confirmId)?.date) ? (
              <p className="muted">Bu sınava bağlı AI çalışma planı da silinecek. Program, görev ve PDF durur.</p>
            ) : null}
            <div className="actions">
              <button className="btn danger" type="button" onClick={() => {
                const gone = targets.find((t) => t.id === confirmId);
                const next = targets.filter((t) => t.id !== confirmId);
                const clearPlan = Boolean(data.examPlan && gone && (data.examPlan.examId === gone.id || data.examPlan.examDate === gone.date));
                setData({
                  ...data,
                  examTargets: next,
                  examDate: examDateForLegacy(next) || '',
                  examPlan: clearPlan ? null : data.examPlan,
                  examPlanDraft: clearPlan ? null : data.examPlanDraft,
                });
                setConfirmId(null);
                toast('Sınav silindi');
              }}>Sil</button>
              <button className="btn" type="button" onClick={() => setConfirmId(null)}>Vazgeç</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmPlanDel ? (
        <div className="modal" role="dialog">
          <div className="modal-box">
            <h3>AI çalışma planını silmek istediğine emin misin?</h3>
            <p>Bu işlem mevcut AI planını kaldıracak. Derslerin, sınavların, PDF programın, görevlerin ve randevuların silinmez.</p>
            <div className="actions">
              <button className="btn" type="button" onClick={() => setConfirmPlanDel(false)}>Vazgeç</button>
              <button className="btn danger" type="button" onClick={() => {
                setData(clearAiExamPlan(data));
                setConfirmPlanDel(false);
                setEditPlan(null);
                setShowPlanBody(false);
                setErr('');
                toast('AI çalışma planın silindi.');
              }}>Planı Sil</button>
            </div>
          </div>
        </div>
      ) : null}

      {editPlan ? (
        <div className="modal" role="dialog">
          <div className="modal-box" style={{ width: 'min(640px,100%)' }}>
            <h3>AI planını düzenle</h3>
            <div className="field"><label>Özet</label><textarea rows={3} value={editPlan.summary} onChange={(e) => setEditPlan({ ...editPlan, summary: e.target.value })} /></div>
            <div className="field"><label>Bu hafta</label><textarea rows={2} value={editPlan.weekHint} onChange={(e) => setEditPlan({ ...editPlan, weekHint: e.target.value })} /></div>
            <div className="field"><label>Öneri</label><textarea rows={2} value={editPlan.advice} onChange={(e) => setEditPlan({ ...editPlan, advice: e.target.value })} /></div>
            {editPlan.stages.map((s, i) => (
              <div className="field" key={i}>
                <label>{s.title || `Aşama ${i + 1}`}</label>
                <textarea rows={2} value={s.body} onChange={(e) => {
                  const stages = editPlan.stages.map((row, j) => j === i ? { ...row, body: e.target.value } : row);
                  setEditPlan({ ...editPlan, stages });
                }} />
              </div>
            ))}
            <div className="field"><label>Son hafta</label><textarea rows={2} value={editPlan.lastWeek} onChange={(e) => setEditPlan({ ...editPlan, lastWeek: e.target.value })} /></div>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => {
                setData({ ...data, examPlan: editPlan });
                setEditPlan(null);
                toast('Plan kaydedildi');
              }}>Kaydet</button>
              <button className="btn" type="button" onClick={() => setEditPlan(null)}>Vazgeç</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );

  async function runPlan(force: boolean) {
    if (!primary) return toast('Önce sınav ekle.');
    if (!force && data.examPlan) {
      setTab('ai');
      setShowPlanBody(true);
      return;
    }
    setErr('');
    setBusy('Sınav planı hazırlanıyor…');
    try {
      const instruction = examPlanInstruction(data, targets, primary);
      const res = await askExamPlan(data, instruction);
      const built: ExamPlanRecord = res.ok
        ? {
          examId: primary.id,
          examDate: primary.date,
          summary: res.summary,
          weekHint: res.weekHint,
          advice: res.advice,
          stages: res.stages.length ? res.stages : localExamPlanDraft(data, targets, primary).stages,
          lastWeek: res.lastWeek,
          source: 'ai',
          model: res.model,
          createdAt: new Date().toISOString(),
          pendingSchedule: data.examPlan?.pendingSchedule || null,
        }
        : { ...localExamPlanDraft(data, targets, primary), examId: primary.id, examDate: primary.date };
      if (!res.ok) setErr(`Model bağlanamadı: ${res.error} Yerel taslak önerildi; AI planı uydurulmadı.`);
      if (data.examPlan) {
        setData({ ...data, examPlanDraft: built });
        toast('Mevcut verilerine göre yeni bir çalışma planı önerildi.');
      } else {
        setData({ ...data, examPlan: built, examPlanDraft: null });
        if (res.ok && data.examNotifyPrefs.ai) toast('AI sınav planı hazır.');
      }
      setTab('ai');
      setShowPlanBody(true);
    } finally {
      setBusy('');
    }
  }

  async function proposeSchedule() {
    if (!primary) return;
    setBusy('Haftalık program önerisi hazırlanıyor…');
    setErr('');
    try {
      const res = await buildScheduleWithAi({
        data,
        daily: data.weekHours > 0 ? Math.round((data.weekHours * 60) / 6) : 150,
        focus: `${primary.title} ${primary.date}`,
        notes: data.schedule.notes,
        makeLocal: () => generateWeeklySchedule(data, data.weekHours > 0 ? Math.round((data.weekHours * 60) / 6) : 150, 6, primary.kind, 'exam_local', data.schedule.notes),
      });
      const plan = data.examPlan || localExamPlanDraft(data, targets, primary);
      setData({
        ...data,
        examPlan: { ...plan, examId: primary.id, examDate: primary.date, pendingSchedule: res.schedule },
      });
      toast(res.usedAi ? 'Program önerisi hazır — onayın olmadan uygulanmaz.' : res.summary);
      setTab('ai');
    } finally {
      setBusy('');
    }
  }
}

function ExamMonth({
  year, month0, selected, targets, onSelect, onPrev, onNext, onToday, onOpen, onAdd,
}: {
  year: number; month0: number; selected: string; targets: ExamTarget[];
  onSelect: (iso: string) => void; onPrev: () => void; onNext: () => void; onToday: () => void;
  onOpen: (t: ExamTarget) => void; onAdd: () => void;
}) {
  const cells = monthCells(year, month0);
  const today = istanbulToday();
  const dayExams = targets.filter((t) => t.date === selected);
  const tasks = useApp().data.tasks.filter((t) => t.date === selected);
  const sessions = useApp().data.sessions.filter((t) => t.date === selected);
  return (
    <div className="card">
      <div className="section-title">
        <h3>{monthTitle(year, month0)}</h3>
        <div className="actions" style={{ margin: 0 }}>
          <button className="btn" type="button" onClick={onPrev}>Önceki</button>
          <button className="btn secondary" type="button" onClick={onToday}>Bugün</button>
          <button className="btn" type="button" onClick={onNext}>Sonraki</button>
          <button className="btn primary" type="button" onClick={onAdd}>+ Sınav Ekle</button>
        </div>
      </div>
      <div className="calendar-head">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="calendar-grid">
        {cells.map((c) => {
          const hits = targets.filter((t) => t.date === c.iso);
          return (
            <button key={c.iso} type="button" className={`cal-cell ${c.muted ? 'muted' : ''} ${c.iso === today ? 'today' : ''} ${c.iso === selected ? 'selected' : ''}`} onClick={() => onSelect(c.iso)}>
              <div className="cal-num">{c.day}</div>
              <div className="exam-badges">
                {hits.slice(0, 2).map((h) => <span key={h.id} className="exam-badge">{h.kind.slice(0, 8)}</span>)}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: '0 0 8px' }}>{selected}</h4>
        {dayExams.length ? dayExams.map((t) => (
          <button key={t.id} className="exam-row" type="button" onClick={() => onOpen(t)}>
            <div><b>{t.title}</b><small className="muted">{t.kind} • {remainingClock(t.date, t.startTime).headline}</small></div>
          </button>
        )) : <div className="empty">Bu günde sınav yok.</div>}
        {tasks.length ? <p className="muted">{tasks.length} görev kaydı</p> : null}
        {sessions.length ? <p className="muted">{sessions.reduce((a, s) => a + s.minutes, 0)} dk çalışma kaydı</p> : null}
      </div>
    </div>
  );
}

function ExamDetail({ exam, plan, onClose, onEdit, onPrimary }: {
  exam: ExamTarget; plan: ExamPlanRecord | null;
  onClose: () => void; onEdit: () => void; onPrimary: () => void;
}) {
  const c = remainingClock(exam.date, exam.startTime, Date.now(), exam.endTime);
  return (
    <div className="modal" role="dialog">
      <div className="modal-box">
        <h3>{exam.title}</h3>
        <p className="muted">{countdownKindLabel(exam.kind, exam.title)}</p>
        <p>{exam.kind} • {exam.date}{exam.startTime ? ` ${exam.startTime}` : ''}{exam.endTime ? `–${exam.endTime}` : ''}</p>
        <p><b>{c.headline}</b></p>
        <p>Öncelik: {exam.priority} • Bildirim: {exam.notify ? 'açık' : 'kapalı'}</p>
        <p>AI plan: {plan && plan.examId === exam.id ? (plan.source === 'ai' ? 'model planı var' : 'yerel taslak var') : 'bu sınav için kayıt yok'}</p>
        {exam.note ? <p>{exam.note}</p> : null}
        <div className="actions">
          <button className="btn primary" type="button" onClick={onEdit}>Düzenle</button>
          {!exam.isPrimary ? <button className="btn" type="button" onClick={onPrimary}>Ana sınav yap</button> : null}
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
