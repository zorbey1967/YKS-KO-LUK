import { useEffect, useState } from 'react';
import { searchExamCatalog, type CatalogExam } from '../data/examCatalog';
import { scoreCatalogExam, type Mark } from '../lib/examScore';
import { listMyExamReports, requestExamScan, saveExamReport, uploadExamScan } from '../lib/cloudPlatform';
import { useApp } from '../context/AppContext';

const OPT = ['A', 'B', 'C', 'D', 'E'] as const;

export function ExamAnalysisPanel() {
  const { toast } = useApp();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CatalogExam[]>([]);
  const [exam, setExam] = useState<CatalogExam | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [result, setResult] = useState<ReturnType<typeof scoreCatalogExam> | null>(null);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listMyExamReports>>>([]);
  const [fileNote, setFileNote] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    void listMyExamReports().then(setReports);
  }, []);

  function pick(e: CatalogExam) {
    setExam(e);
    setMarks(Array.from({ length: e.questions.length }, () => null));
    setResult(null);
  }

  async function onFile(file?: File) {
    if (!file) return;
    setBusy('Dosya yükleniyor…');
    setFileNote('');
    const up = await uploadExamScan(file);
    if ('error' in up) {
      setBusy('');
      setFileNote(up.error);
      toast(up.error);
      return;
    }
    setBusy('Görsel okunuyor…');
    const scan = await requestExamScan(up.path);
    setBusy('');
    if (!scan.ok) {
      setFileNote(scan.error);
      toast(scan.error);
      return;
    }
    setFileNote(scan.warning || 'Belirsiz işaretler kesin kayıt edilmedi. Aşağıdan düzelt.');
    if (exam && Array.isArray(scan.marks)) {
      setMarks(scan.marks.map((m) => (typeof m === 'number' && m >= 0 && m <= 4 ? m as Mark : null)));
    }
  }

  async function grade() {
    if (!exam) return;
    const scored = scoreCatalogExam(exam, marks);
    setResult(scored);
    const saved = await saveExamReport({
      examId: exam.id,
      examName: exam.name,
      correct: scored.correct,
      wrong: scored.wrong,
      blank: scored.blank,
      net: scored.net,
      topics: scored.byTopic,
      verifiedKey: scored.verifiedKey,
    });
    toast(saved.ok ? 'Sonuç hesabına yazıldı.' : saved.error);
    if (saved.ok) void listMyExamReports().then(setReports);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title"><h3>Deneme analizi</h3><span>Premium / deneme</span></div>
      <p className="muted">
        Fotoğraf ve PDF yalnızca senin hesabına özel depoda tutulur; herkese açık bağlantı üretilmez.
        Okunamayan işaret kesinlik gibi kaydedilmez. Resmî yayınevi anahtarı yoksa sistem uydurmaz.
        Görseller sınav analizi için işlenir; saklama süresi depo politikasına bağlıdır.
      </p>

      <div className="field">
        <label>Sınav adı</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Örn. E-Koçluk TYT Matematik" />
      </div>
      <div className="actions">
        <button className="btn secondary" type="button" onClick={() => {
          const found = searchExamCatalog(query);
          setHits(found);
          setExam(null);
          setResult(null);
          if (!found.length) toast('Katalogda eşleşme yok. Resmî anahtar uydurulmadı.');
        }}>Katalogda ara</button>
      </div>
      {hits.length ? hits.map((h) => (
        <div className="plan-item" key={h.id}>
          <span><b>{h.name}</b><br /><small className="muted">{h.published} • {h.questions.length} soru</small></span>
          <button className="btn primary" type="button" onClick={() => pick(h)}>Bu sınav</button>
        </div>
      )) : query.trim().length >= 3 && hits.length === 0 ? (
        <p className="notice">Bu isim katalogda yok. İzinli anahtar yoksa sonuç hesaplanmaz. Elle optik formu yalnızca platform alıştırmalarında doldurabilirsin.</p>
      ) : null}

      <div className="field" style={{ marginTop: 12 }}>
        <label>Optik / sonuç görseli (JPEG, PNG veya PDF, en fazla 8 MB)</label>
        <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {busy ? <p className="muted">{busy}</p> : null}
      {fileNote ? <p className="notice">{fileNote}</p> : null}

      {exam ? (
        <>
          <div className="section-title" style={{ marginTop: 12 }}><h3>{exam.name}</h3><span>Dijital optik</span></div>
          {exam.questions.map((q, i) => (
            <div className="plan-item" key={q.n}>
              <span>Soru {q.n}<br /><small className="muted">{q.subject} • {q.topic}</small></span>
              <span className="chip-row">
                {OPT.map((lab, oi) => (
                  <button key={lab} className={`chip ${marks[i] === oi ? 'on' : ''}`} type="button" onClick={() => setMarks((m) => m.map((x, ix) => (ix === i ? (oi as Mark) : x)))}>{lab}</button>
                ))}
                <button className="chip" type="button" onClick={() => setMarks((m) => m.map((x, ix) => ix === i ? null : x))}>Boş</button>
              </span>
            </div>
          ))}
          <div className="actions">
            <button className="btn primary" type="button" onClick={() => void grade()}>Net hesapla</button>
          </div>
        </>
      ) : null}

      {result ? (
        <div style={{ marginTop: 12 }}>
          <p><b>{result.correct} doğru</b> / {result.wrong} yanlış / {result.blank} boş • net {result.net}</p>
          {result.verifiedKey ? (
            result.weak.length ? result.weak.slice(0, 5).map((w) => (
              <div className="plan-item" key={w.topic}><span>{w.topic.replace('|', ' • ')}</span><span>{w.wrong} yanlış</span></div>
            )) : <p className="muted">Yanlış konu yok.</p>
          ) : <p className="notice">Anahtar doğrulanmadı; konu analizi kesin değildir.</p>}
        </div>
      ) : null}

      <div className="section-title" style={{ marginTop: 16 }}><h3>Kayıtlı analizler</h3></div>
      {reports.length ? reports.map((r) => (
        <div className="plan-item" key={String((r as { id?: string }).id)}>
          <span>{String((r as { exam_name?: string }).exam_name)}<br /><small className="muted">{String((r as { created_at?: string }).created_at || '').slice(0, 10)}</small></span>
          <b>{Number((r as { net?: number }).net)}</b>
        </div>
      )) : <p className="muted">Kayıtlı analiz yok.</p>}
    </div>
  );
}
