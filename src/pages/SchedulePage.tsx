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
import { studentOwnedSchedule } from '../lib/studentProgress';

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
    <div className="card" style={{ marginTop: 16 }}>
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
  );
}
