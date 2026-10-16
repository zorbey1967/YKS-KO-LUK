import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateWeeklySchedule } from '../lib/schedule';
import { buildScheduleFromPdf, buildScheduleWithAi } from '../lib/aiSchedule';
import { blocksToTasks, todaySchedule } from '../lib/insights';
import { suggestedDailyMinutes, examKind } from '../lib/stage';
import { today } from '../lib/util';
import { assertPdfFile, clearSchedulePdf, loadSchedulePdf, saveSchedulePdf } from '../lib/pdfStore';

import { ExamCenter } from '../components/ExamCenter';
import { WeekPlanEditor } from '../components/WeekPlanEditor';
import { emptyWeekPlan, scheduleFromWeekPlan, weekPlanFromSchedule, type WeekPlan } from '../lib/weekPlan';
import { fetchStudentWeekPlan } from '../lib/cloudPlatform';
import { studentOwnedSchedule } from '../lib/studentProgress';
import type { AppData, Schedule, ScheduleDay } from '../lib/types';

export function SchedulePage() {
  const { data, setData, toast, user, profile } = useApp();
  const age = data.age > 0 ? data.age : 0;
  const kind = examKind(data);
  const daily = age > 0 ? suggestedDailyMinutes(age, kind) : 150;
  const days = age > 0 && age <= 13 ? 5 : 6;
  const focus = kind === 'KPSS' ? 'KPSS GY + GK' : kind === 'YKS' ? 'Dengeli TYT + AYT' : 'Okul programı';
  const notes = data.schedule.notes || '';
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState('');
  const [week, setWeek] = useState<WeekPlan>(() => weekPlanFromSchedule(studentOwnedSchedule(data), data.weekHours));
  const [weekBusy, setWeekBusy] = useState(false);
  const sch = studentOwnedSchedule(data);

  function preserveCoach(prev: AppData): Schedule {
    if (prev.coachSchedule.days.some((d) => d.blocks.length)) return prev.coachSchedule;
    if (prev.schedule.source === 'coach') return prev.schedule;
    return prev.coachSchedule;
  }

  function writeStudentSchedule(next: Schedule, extra?: Partial<AppData>) {
    setData((prev) => ({
      ...prev,
      ...extra,
      coachSchedule: preserveCoach(prev),
      schedule: { ...next, source: next.source === 'coach' ? 'self' : (next.source || 'self') },
    }));
  }

  useEffect(() => {
    void loadSchedulePdf().then((f) => { if (f) setFile(f); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchStudentWeekPlan(user.id).then((row) => {
      if (!row || typeof row !== 'object') return;
      const rec = row as { days?: ScheduleDay[]; week_hours?: number; notes?: string; lock?: string; coach_id?: string; updated_at?: string };
      const recDays = Array.isArray(rec.days) ? rec.days as ScheduleDay[] : [];
      const hasBlocks = recDays.some((d) => d.blocks?.length);
      const next: WeekPlan = {
        days: hasBlocks ? recDays : emptyWeekPlan().days,
        weekHours: Number(rec.week_hours) || 0,
        notes: String(rec.notes || ''),
        lock: rec.lock === 'coach' ? 'coach' : 'self',
        coachId: rec.coach_id ? String(rec.coach_id) : null,
        updatedAt: String(rec.updated_at || ''),
      };
      if (next.lock === 'coach') {
        if (!hasBlocks) return;
        setData((prev) => ({
          ...prev,
          coachSchedule: scheduleFromWeekPlan(next, prev.coachSchedule),
        }));
        return;
      }
      if (hasBlocks) {
        setWeek(weekPlanFromSchedule(scheduleFromWeekPlan({ ...next, lock: 'self' }, sch), data.weekHours || next.weekHours));
        setData((prev) => ({
          ...prev,
          coachSchedule: preserveCoach(prev),
          schedule: scheduleFromWeekPlan({ ...next, lock: 'self' }, studentOwnedSchedule(prev)),
          weekHours: next.weekHours || prev.weekHours,
        }));
      }
    });
  }, [user?.id]);

  async function acceptFile(next: File | null) {
    if (!next) return;
    try {
      assertPdfFile(next);
      await saveSchedulePdf(next);
      setFile(next);
      writeStudentSchedule({ ...sch, pdfName: next.name, pdfSize: next.size, source: sch.source || 'school_teacher_pdf', updatedAt: new Date().toISOString() });
      toast('PDF kaydedildi');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF yüklenemedi');
    }
  }

  function generateLocal(source: string) {
    const next = generateWeeklySchedule(data, daily, days, focus, source, notes);
    writeStudentSchedule({ ...next, pdfName: sch.pdfName, pdfSize: sch.pdfSize, source: next.source === 'coach' ? 'self' : (next.source || 'self') });
    toast('Haftalık program oluşturuldu');
  }

  async function fromPdfAi() {
    const pdf = file || await loadSchedulePdf();
    if (!pdf) return toast('Önce PDF yükle.');
    setBusy('PDF okunuyor…');
    try {
      const { extractPdfText } = await import('../lib/pdfText');
      const text = await extractPdfText(pdf);
      if (!text) throw new Error('PDF’den metin çıkarılamadı (taranmış görüntü olabilir).');
      setPreview(text.slice(0, 500));
      setBusy('AI programı hazırlıyor…');
      const res = await buildScheduleFromPdf({ data, text, daily, focus, notes, filename: pdf.name });
      writeStudentSchedule({ ...res.schedule, pdfName: pdf.name, pdfSize: pdf.size, notes, source: res.schedule.source === 'coach' ? 'self' : (res.schedule.source || 'self') });
      toast(res.usedAi ? 'AI programı hazır' : res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF analizi başarısız');
    } finally {
      setBusy('');
    }
  }

  async function fromAi() {
    setBusy('AI kişisel program hazırlıyor…');
    try {
      const res = await buildScheduleWithAi({
        data,
        daily,
        focus,
        notes,
        makeLocal: () => generateWeeklySchedule(data, daily, days, focus, 'ekoc_local', notes),
      });
      writeStudentSchedule({ ...res.schedule, pdfName: sch.pdfName, pdfSize: sch.pdfSize, notes, source: res.schedule.source === 'coach' ? 'self' : (res.schedule.source || 'self') });
      toast(res.usedAi ? 'AI programı hazır' : res.summary);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <ExamCenter />
      {profile?.role !== 'coach' ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Ders Programım</h3><span>Senin planın</span></div>
          <WeekPlanEditor
            key={week.updatedAt || 'empty'}
            plan={week}
            editable
            busy={weekBusy}
            onSave={(next) => {
              const saved: WeekPlan = { ...next, lock: 'self', updatedAt: new Date().toISOString() };
              setWeekBusy(true);
              setWeek(saved);
              writeStudentSchedule(scheduleFromWeekPlan(saved, sch), { weekHours: next.weekHours });
              setWeekBusy(false);
              toast('Program kaydedildi.');
            }}
          />
        </div>
      ) : null}
      <div id="week-program" className="hero" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Haftalık ritim</div>
        <h2>PDF yükle, haftalık program üret</h2>
        <p>Okul programını PDF olarak ekle. Sunucu koçu okul saatlerini korur, boşluklara çalışma koyar. Yanıt yoksa yerel üretici kullanılır.</p>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Program PDF</h3><span>{data.grade}</span></div>
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void acceptFile(e.dataTransfer.files[0] || null); }}
          >
            <input type="file" accept="application/pdf" hidden onChange={(e) => void acceptFile(e.target.files?.[0] || null)} />
            <b>PDF seç veya bırak</b>
            <small>{file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : sch.pdfName ? `${sch.pdfName} • kayıtlı` : 'Henüz PDF yok • en fazla 12 MB'}</small>
          </label>
          <div className="actions">
            <button className="btn primary" type="button" disabled={!!busy} onClick={() => void fromPdfAi()}>PDF’den program</button>
            <button className="btn" type="button" disabled={!!busy} onClick={() => void fromAi()}>Sunucu ile program</button>
            <button className="btn danger" type="button" onClick={() => {
              if (!sch.days.length) return toast('Silinecek program yok.');
              if (!confirm('AI / çalışma programı silinsin mi? Sınavlar, randevular ve hesabın durur.')) return;
              writeStudentSchedule({ ...sch, days: [], source: '', notes: '', updatedAt: new Date().toISOString() });
              toast('Çalışma programı silindi');
            }}>Programı sil</button>
            <button className="btn danger" type="button" onClick={() => {
              void clearSchedulePdf();
              setFile(null);
              setPreview('');
              writeStudentSchedule({ ...sch, pdfName: '', pdfSize: 0 });
              toast('PDF silindi');
            }}>PDF’yi kaldır</button>
          </div>
          {busy ? <div className="notice" style={{ marginTop: 12 }}>{busy}</div> : null}
          {preview ? <p className="pdf-preview">{preview}…</p> : null}
        </div>
        <div className="card">
          <div className="section-title"><h3>Haftalık program üret</h3><span>{data.grade}{data.track ? ` · ${data.track}` : ''}</span></div>
          <p className="muted">Günlük hedef ve odak profilinden gelir. PDF yükle veya yerel üret.</p>
          <div className="actions">
            <button className="btn" type="button" onClick={() => generateLocal(file || sch.pdfName ? 'school_pdf_local' : 'yerel üretici')}>Yerel üret</button>
            <button className="btn secondary" type="button" onClick={() => {
              const day = todaySchedule({ ...data, schedule: sch });
              if (!day?.blocks.length) return toast('Bugün için blok yok.');
              const exist = new Set(data.tasks.filter((t) => t.date === today()).map((t) => t.title));
              const extra = blocksToTasks(day).filter((t) => !exist.has(t.title));
              if (!extra.length) return toast('Bloklar zaten görevlerde.');
              setData({ ...data, tasks: [...extra, ...data.tasks] });
              toast(`${extra.length} görev eklendi`);
            }}>Bugünü görevlere aktar</button>
          </div>
          <div className="status-grid" style={{ marginTop: 14 }}>
            <div className="status"><b>Kaynak</b><span>{sch.source || '—'}</span></div>
            <div className="status"><b>PDF</b><span>{sch.pdfName || 'Yok'}</span></div>
            <div className="status"><b>Gün</b><span>{sch.days.length || 0}</span></div>
          </div>
        </div>
      </div>
      <div className="week-grid" style={{ marginTop: 16 }}>
        {sch.days.length ? sch.days.map((d) => (
          <div className="card week-day" key={d.day}>
            <div className="section-title"><h3>{d.day}</h3><span>{d.blocks.reduce((a, b) => a + b.minutes, 0)} dk</span></div>
            {d.blocks.map((b, i) => (
              <div className="plan-item" key={`${d.day}-${i}`}><span>{b.icon} {b.title}</span><b>{b.minutes} dk</b></div>
            ))}
          </div>
        )) : <div className="card empty">PDF yükleyip program üret, veya soldan yerel üret. Bu Ders Programım’dır; koç programı ayrıdır.</div>}
      </div>
      {data.coachSchedule.days.some((d) => d.blocks.length) ? (
        <>
          <div className="section-title" style={{ marginTop: 16 }}><h3>Koçun Programı</h3></div>
          <div className="week-grid">
            {data.coachSchedule.days.map((d) => (
              <div className="card week-day" key={`coach-${d.day}`}>
                <div className="section-title"><h3>{d.day}</h3><span>{d.blocks.reduce((a, b) => a + b.minutes, 0)} dk</span></div>
                {d.blocks.map((b, i) => (
                  <div className="plan-item" key={`coach-${d.day}-${i}`}><span>{b.icon} {b.title}</span><b>{b.minutes} dk</b></div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
