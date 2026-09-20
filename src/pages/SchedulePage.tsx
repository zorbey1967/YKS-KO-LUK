import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { applyScheduleNotes, generateWeeklySchedule } from '../lib/schedule';
import { buildScheduleFromPdf, buildScheduleWithAi } from '../lib/aiSchedule';
import { blocksToTasks, todaySchedule } from '../lib/insights';
import { suggestedDailyMinutes, examKind } from '../lib/stage';
import { today } from '../lib/util';
import { assertPdfFile, clearSchedulePdf, loadSchedulePdf, saveSchedulePdf } from '../lib/pdfStore';

export function SchedulePage() {
  const { data, setData, toast } = useApp();
  const age = data.age > 0 ? data.age : 0;
  const [daily, setDaily] = useState(() => (age > 0 ? suggestedDailyMinutes(age, examKind(data)) : 150));
  const [days, setDays] = useState(age > 0 && age <= 13 ? 5 : 6);
  const [focus, setFocus] = useState('Dengeli TYT + AYT');
  const [notes, setNotes] = useState(data.schedule.notes || '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState('');
  const sch = data.schedule;

  useEffect(() => {
    void loadSchedulePdf().then((f) => { if (f) setFile(f); }).catch(() => undefined);
  }, []);

  async function acceptFile(next: File | null) {
    if (!next) return;
    try {
      assertPdfFile(next);
      await saveSchedulePdf(next);
      setFile(next);
      setData({ ...data, schedule: { ...sch, pdfName: next.name, pdfSize: next.size, source: sch.source || 'school_teacher_pdf', updatedAt: new Date().toISOString() } });
      toast('PDF kaydedildi');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF yüklenemedi');
    }
  }

  function generateLocal(source: string) {
    const next = generateWeeklySchedule(data, daily, days, focus, source, notes);
    setData({ ...data, schedule: { ...next, pdfName: sch.pdfName, pdfSize: sch.pdfSize } });
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
      setData({ ...data, schedule: { ...res.schedule, pdfName: pdf.name, pdfSize: pdf.size, notes } });
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
      setData({ ...data, schedule: { ...res.schedule, pdfName: sch.pdfName, pdfSize: sch.pdfSize, notes } });
      toast(res.usedAi ? 'AI programı hazır' : res.summary);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Haftalık ritim</div>
        <h2>PDF yükle, AI ile program üret</h2>
        <p>Okul programını PDF olarak ekle. AI okul saatlerini korur, boşluklara çalışma blokları koyar. AI yoksa yerel üretici devreye girer.</p>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>📄 Program PDF</h3><span>{data.grade}</span></div>
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
            <button className="btn primary" type="button" disabled={!!busy} onClick={() => void fromPdfAi()}>🤖 PDF’den AI program</button>
            <button className="btn" type="button" disabled={!!busy} onClick={() => void fromAi()}>✨ AI program (PDF’siz)</button>
            <button className="btn danger" type="button" onClick={() => {
              void clearSchedulePdf();
              setFile(null);
              setPreview('');
              setData({ ...data, schedule: { ...sch, pdfName: '', pdfSize: 0 } });
              toast('PDF silindi');
            }}>PDF’yi kaldır</button>
          </div>
          {busy ? <div className="notice" style={{ marginTop: 12 }}>{busy}</div> : null}
          {preview ? <p className="pdf-preview">{preview}…</p> : null}
        </div>
        <div className="card">
          <div className="section-title"><h3>🗓️ Ayarlar</h3><span>{data.track}</span></div>
          <div className="form-grid">
            <div className="field"><label>Günlük hedef (dk)</label><input type="number" min={60} value={daily} onChange={(e) => setDaily(Number(e.target.value) || 0)} /></div>
            <div className="field">
              <label>Haftalık gün</label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={5}>5 gün</option>
                <option value={6}>6 gün</option>
                <option value={7}>7 gün</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Odak</label>
              <select value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option>Dengeli TYT + AYT</option>
                <option>TYT ağırlıklı</option>
                <option>AYT ağırlıklı</option>
                <option>Zayıf konular</option>
                <option>Deneme + analiz</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Koç / AI notu</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ör. Pazar tatil, Cumartesi deneme, Pazartesi matematik 90 dk" />
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={() => generateLocal(file || sch.pdfName ? 'school_pdf_local' : 'yerel üretici')}>Yerel üret</button>
            <button className="btn" type="button" onClick={() => {
              if (!sch.days.length) return toast('Önce bir program üret.');
              setData({ ...data, schedule: applyScheduleNotes({ ...sch, notes }, notes) });
              toast('Not uygulandı');
            }}>Notu uygula</button>
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
        )) : <div className="card empty">PDF yükleyip “PDF’den AI program”a bas, veya yerel üret.</div>}
      </div>
    </>
  );
}
