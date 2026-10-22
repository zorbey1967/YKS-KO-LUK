import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildScheduleFromPdf } from '../lib/aiSchedule';
import { assertPdfFile, clearSchedulePdf, loadSchedulePdf, saveSchedulePdf } from '../lib/pdfStore';
import {
  createSchedulePdfSignedUrl,
  listMySchedulePdfSubmissions,
  sendSchedulePdfToCoach,
  type SchedulePdfSubmission,
} from '../lib/schedulePdfCloud';
import { suggestedDailyMinutes, examKind } from '../lib/stage';
import { coachOwnedSchedule, saveOwnSchedule, studentOwnedSchedule } from '../lib/studentProgress';
import {
  createCoachProgramPdfSignedUrl,
  listMyCoachProgramPdfs,
  type CoachProgramPdf,
} from '../lib/coachProgramPdfCloud';
import { WEEK_DAYS } from '../lib/weekPlan';
import { iconForTopic } from '../lib/coach';
import type { ScheduleBlock, ScheduleDay } from '../lib/types';

function editableDays(days: ScheduleDay[]): ScheduleDay[] {
  return WEEK_DAYS.map((day) => ({ day, blocks: (days.find((d) => d.day === day)?.blocks || []).map((b) => ({ ...b })) }));
}

/**
 * Programım: öğrencinin tek ders programı (data.schedule). Takvim ve Ana Sayfa buradan okur;
 * PDF analizi veya Akıllı Plan önerisi de buraya yazar ve burada düzenlenir.
 */
function ScheduleEditor() {
  const { data, setData, toast } = useApp();
  const own = studentOwnedSchedule(data);
  const [days, setDays] = useState<ScheduleDay[]>(() => editableDays(own.days));
  const [dirty, setDirty] = useState(false);
  const [openDay, setOpenDay] = useState<string>(() => own.days.find((d) => d.blocks.length)?.day || WEEK_DAYS[0]);

  useEffect(() => {
    if (!dirty) setDays(editableDays(studentOwnedSchedule(data).days));
  }, [data.schedule.updatedAt, data.schedule.days]);

  function patch(day: string, i: number, next: Partial<ScheduleBlock>) {
    setDirty(true);
    setDays((cur) => cur.map((d) => (d.day !== day ? d : { ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...next } : b)) })));
  }
  function add(day: string) {
    setDirty(true);
    setOpenDay(day);
    setDays((cur) => cur.map((d) => (d.day !== day ? d : { ...d, blocks: [...d.blocks, { title: '', minutes: 40, icon: '📚', start: '' }] })));
  }
  function remove(day: string, i: number) {
    setDirty(true);
    setDays((cur) => cur.map((d) => (d.day !== day ? d : { ...d, blocks: d.blocks.filter((_, j) => j !== i) })));
  }
  function save() {
    const withIcons = days.map((d) => ({ ...d, blocks: d.blocks.map((b) => ({ ...b, icon: b.icon && b.icon !== '📚' ? b.icon : iconForTopic(b.title || '') })) }));
    setData((prev) => saveOwnSchedule(prev, withIcons, own.source && own.source !== 'coach' ? own.source : 'self'));
    setDirty(false);
    toast('Programın kaydedildi; Takvim ve Ana Sayfa güncellendi.');
  }

  const total = days.reduce((a, d) => a + d.blocks.reduce((x, b) => x + (Number(b.minutes) || 0), 0), 0);
  return (
    <div className="card">
      <div className="section-title">
        <h3>Programım</h3>
        <span>{total ? `haftada ${Math.round(total / 60)} saat` : 'boş'}</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>Günlere ders ekle; Takvim’de ve Ana Sayfa’da görünür. PDF analizi ve Akıllı Plan önerisi de buraya yazılır, istediğin gibi düzenleyebilirsin.</p>
      <div className="sched-days">
        {days.map((d) => {
          const isOpen = openDay === d.day;
          const mins = d.blocks.reduce((x, b) => x + (Number(b.minutes) || 0), 0);
          return (
            <div key={d.day} className={`sched-day${isOpen ? ' open' : ''}`}>
              <button type="button" className="sched-day-head" aria-expanded={isOpen} onClick={() => setOpenDay(isOpen ? '' : d.day)}>
                <b>{d.day}</b>
                <span className="muted">{d.blocks.length ? `${d.blocks.length} ders · ${mins} dk` : 'boş'}</span>
              </button>
              {isOpen ? (
                <div className="sched-blocks">
                  {d.blocks.map((b, i) => (
                    <div className="sched-block" key={i}>
                      <input aria-label="Saat" type="time" value={b.start || ''} onChange={(e) => patch(d.day, i, { start: e.target.value })} />
                      <input aria-label="Ders" placeholder="Ders (örn. Matematik)" value={b.title} maxLength={60} onChange={(e) => patch(d.day, i, { title: e.target.value })} />
                      <input aria-label="Konu" placeholder="Konu (isteğe bağlı)" value={b.topic || ''} maxLength={60} onChange={(e) => patch(d.day, i, { topic: e.target.value })} />
                      <input aria-label="Dakika" type="number" min={5} max={300} step={5} value={b.minutes} onChange={(e) => patch(d.day, i, { minutes: Number(e.target.value) || 0 })} />
                      <button className="btn danger" type="button" aria-label={`${d.day} dersini sil`} onClick={() => remove(d.day, i)}>Sil</button>
                    </div>
                  ))}
                  <button className="btn secondary" type="button" onClick={() => add(d.day)}>+ Ders ekle</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="actions">
        <button className="btn primary" type="button" disabled={!dirty} onClick={save}>Programı kaydet</button>
        {dirty ? <button className="btn" type="button" onClick={() => { setDays(editableDays(own.days)); setDirty(false); }}>Vazgeç</button> : null}
      </div>
    </div>
  );
}

/** Koçun Programı: koçun yazdığı bloklar ve yüklediği PDF'ler (salt okunur; öğrenci programına kopyalanmaz). */
function CoachProgram() {
  const { data, toast, user } = useApp();
  const coach = coachOwnedSchedule(data);
  const [pdfs, setPdfs] = useState<CoachProgramPdf[]>([]);
  useEffect(() => {
    if (!user?.id) {
      setPdfs([]);
      return;
    }
    let alive = true;
    void listMyCoachProgramPdfs().then((res) => {
      if (alive && res.ok) setPdfs(res.rows.filter((r) => r.student_id === user.id));
    });
    return () => { alive = false; };
  }, [user?.id]);
  const days = coach.days.filter((d) => d.blocks.length);
  return (
    <div className="card">
      <div className="section-title"><h3>Koçun Programı</h3><span>salt okunur</span></div>
      {days.length ? days.map((d) => (
        <div key={d.day} className="cal-group">
          <h4>{d.day}</h4>
          {d.blocks.map((b, i) => (
            <div className="cal-line" key={i}>
              <span className="cal-time">{b.start || '—'}</span>
              <span>{[b.title, b.topic].filter(Boolean).join(' · ')}</span>
              <b>{b.minutes} dk</b>
            </div>
          ))}
        </div>
      )) : null}
      {pdfs.map((r) => (
        <div className="plan-item" key={r.id}>
          <span>{r.file_name}<br /><small className="muted">{new Date(r.created_at).toLocaleString('tr-TR')}</small></span>
          <button className="btn secondary" type="button" onClick={() => {
            void createCoachProgramPdfSignedUrl(r.storage_path).then((url) => {
              if (!url) return toast('PDF açılamadı.');
              window.open(url, '_blank', 'noopener,noreferrer');
            });
          }}>PDF’yi aç</button>
        </div>
      ))}
      {!days.length && !pdfs.length ? <p className="muted" style={{ margin: 0 }}>Koçun henüz program paylaşmadı.</p> : null}
    </div>
  );
}

export function SchedulePage() {
  const { data, setData, toast, user } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState('');
  const [sent, setSent] = useState<SchedulePdfSubmission[]>([]);
  const sch = studentOwnedSchedule(data);
  const age = data.age > 0 ? data.age : 0;
  const kind = examKind(data);
  const daily = age > 0 ? suggestedDailyMinutes(age, kind) : 150;
  const focus = kind === 'KPSS' ? 'KPSS GY + GK' : kind === 'YKS' ? 'Dengeli TYT + AYT' : 'Okul programı';

  useEffect(() => {
    void loadSchedulePdf().then((f) => { if (f) setFile(f); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setSent([]);
      return;
    }
    let alive = true;
    void listMySchedulePdfSubmissions().then((res) => {
      if (!alive) return;
      if (res.ok) setSent(res.rows.filter((r) => r.student_id === user.id));
    });
    return () => { alive = false; };
  }, [user?.id]);

  async function acceptFile(next: File | null) {
    if (!next) return;
    try {
      assertPdfFile(next);
      await saveSchedulePdf(next);
      setFile(next);
      setPreview('');
      setData((prev) => {
        const cur = studentOwnedSchedule(prev);
        return {
          ...prev,
          schedule: {
            ...cur,
            pdfName: next.name,
            pdfSize: next.size,
            source: cur.source || 'school_teacher_pdf',
            updatedAt: new Date().toISOString(),
          },
        };
      });
      toast('PDF kaydedildi');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast(/PDF|MB|boyut|geçersiz|izin/i.test(msg) ? msg : 'PDF yüklenemedi');
    }
  }

  function viewPdf() {
    if (!file) {
      toast('Önce PDF yükle.');
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function analyzePdf() {
    const pdf = file || await loadSchedulePdf();
    if (!pdf) return toast('Önce PDF yükle.');
    setBusy('PDF okunuyor…');
    try {
      const { extractPdfText } = await import('../lib/pdfText');
      const text = await extractPdfText(pdf);
      if (!text) throw new Error('PDF’den metin çıkarılamadı (taranmış görüntü olabilir).');
      setPreview(text.slice(0, 500));
      setBusy('PDF analiz ediliyor…');
      const res = await buildScheduleFromPdf({
        data,
        text,
        daily,
        focus,
        notes: sch.notes || '',
        filename: pdf.name,
      });
      setData((prev) => {
        const cur = studentOwnedSchedule(prev);
        return {
          ...prev,
          schedule: {
            ...res.schedule,
            pdfName: pdf.name,
            pdfSize: pdf.size,
            notes: cur.notes || '',
            source: res.schedule.source === 'coach' ? 'self' : (res.schedule.source || 'self'),
          },
        };
      });
      toast(res.usedAi ? 'PDF analiz edildi' : res.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast(/PDF|metin|taranmış|analiz/i.test(msg) ? msg : 'PDF analizi başarısız');
    } finally {
      setBusy('');
    }
  }

  async function sendToCoach() {
    if (!user) {
      toast('Koça göndermek için giriş gerekli.');
      return;
    }
    const pdf = file || await loadSchedulePdf();
    if (!pdf) return toast('Önce PDF yükle.');
    setBusy('Koça gönderiliyor…');
    try {
      const res = await sendSchedulePdfToCoach(pdf);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setSent((prev) => [res.row, ...prev.filter((r) => r.id !== res.row.id)]);
      toast('Koça gönderildi');
    } finally {
      setBusy('');
    }
  }

  async function openSent(row: SchedulePdfSubmission) {
    if (user && row.student_id !== user.id) {
      toast('Bu dosyaya erişim yok.');
      return;
    }
    const url = await createSchedulePdfSignedUrl(row.storage_path);
    if (!url) {
      toast('PDF açılamadı.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="sched-page">
    <ScheduleEditor />
    <div className="card">
      <div className="section-title"><h3>Program PDF</h3><span>okul / dershane programı</span></div>
      <p className="muted" style={{ marginTop: 0 }}>PDF’yi yükle; “PDF’yi Analiz Et” programını çıkarır ve yukarıdaki Programım’a yazar. Premium’da ZORRO okur; Pro’da PDF metni yerel olarak okunur.</p>
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
        <button className="btn secondary" type="button" disabled={!!busy || !file} onClick={viewPdf}>PDF’yi görüntüle</button>
        <button className="btn" type="button" disabled={!!busy || !file} onClick={() => void analyzePdf()}>PDF’yi Analiz Et</button>
        <button className="btn primary" type="button" disabled={!!busy || !file || !user} onClick={() => void sendToCoach()}>Koça Gönder</button>
        <button className="btn danger" type="button" disabled={!!busy} onClick={() => {
          void clearSchedulePdf();
          setFile(null);
          setPreview('');
          setData((prev) => {
            const cur = studentOwnedSchedule(prev);
            return { ...prev, schedule: { ...cur, pdfName: '', pdfSize: 0 } };
          });
          toast('PDF silindi');
        }}>PDF’yi kaldır</button>
      </div>
      {busy ? <div className="notice" style={{ marginTop: 12 }}>{busy}</div> : null}
      {preview ? <p className="pdf-preview">{preview}…</p> : null}
      {sent.length ? (
        <div style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Gönderimler</h3></div>
          {sent.map((r) => (
            <div className="plan-item" key={r.id}>
              <span>
                {r.file_name}
                <br />
                <small className="muted">Koça gönderildi · {new Date(r.created_at).toLocaleString('tr-TR')}</small>
              </span>
              <button className="btn secondary" type="button" onClick={() => void openSent(r)}>Aç</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
    <CoachProgram />
    </div>
  );
}
