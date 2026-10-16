import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FeatureLock } from '../components/FeatureLock';
import { appendAiBlocksAsTasks, localAiCoachReport, requestAiCoachAnalysis, type AiCoachReport } from '../lib/aiCoachAnalysis';
import {
  EXAM_DOC_ACCEPT,
  analyzeExamDocumentFiles,
  clearExamDocumentAnalysisForUser,
  type ExamDocumentAnalysis,
} from '../lib/examDocumentAnalysis';
import { requestExamDocumentScan, uploadExamScan } from '../lib/cloudPlatform';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { weekGoalPct, weekMinutes } from '../lib/insights';
import { buildAnalyticsBoard } from '../lib/studentAnalytics';
import { formatMinutes, getStudentProgress, progressFingerprint } from '../lib/studentProgress';
import { canSeeAnalyticsPage, canUseAnalytics } from '../lib/subscription';
import { getStudentEducationContext } from '../lib/studentEducation';
import { localDateKey } from '../lib/util';

type LocalFile = { id: string; file: File; url: string };

function verdictLabel(v: string) {
  if (v === 'dogru') return 'Doğru';
  if (v === 'yanlis') return 'Yanlış';
  if (v === 'bos') return 'Boş';
  return 'Belirlenemedi';
}

export function AnalyticsPage() {
  const { data, setData, go, profile, isAdmin, user, toast } = useApp();
  const see = canSeeAnalyticsPage(profile, isAdmin);
  const use = canUseAnalytics(profile, isAdmin);
  const board = useMemo(() => buildAnalyticsBoard(data), [data]);
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const edu = useMemo(() => getStudentEducationContext(data), [data]);
  const fp = useMemo(() => progressFingerprint(data), [data]);
  const cacheRef = useRef<{ fp: string; report: AiCoachReport } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [aiReport, setAiReport] = useState<AiCoachReport | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [docBusy, setDocBusy] = useState(false);
  const [docErr, setDocErr] = useState('');
  const [docResult, setDocResult] = useState<ExamDocumentAnalysis | null>(null);
  const localHints = useMemo(() => localAiCoachReport(data, board), [data, board]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearExamDocumentAnalysisForUser(user?.id || null);
    setDocResult(null);
    setDocErr('');
    setAiReport(null);
    cacheRef.current = null;
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
  }, [user?.id]);

  if (!see) {
    return <FeatureLock title="Analiz sayfası üyelik veya 14 günlük deneme sonrası görünür" />;
  }
  if (!use) {
    return (
      <FeatureLock title="Analiz özelliği Premium veya 14 günlük denemede açılır">
        <p className="muted">Sayfa görünür; grafikler ve ücretli analiz Pro veya ücretsiz planda çalışmaz.</p>
      </FeatureLock>
    );
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: LocalFile[] = [];
    for (const file of Array.from(list)) {
      const okType = /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(file.type)
        || /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
      if (!okType) {
        toast('Yalnızca JPEG, PNG, WebP veya PDF.');
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, url: URL.createObjectURL(file) });
    }
    if (next.length) {
      setFiles((prev) => [...prev, ...next].slice(0, 12));
      setDocErr('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const hit = prev.find((f) => f.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function runDocumentAi() {
    if (!files.length) {
      setDocErr('Analiz etmek istediğiniz sınav/deneme fotoğraflarını veya PDF dosyasını yükleyin.');
      return;
    }
    if (!user?.id) {
      setDocErr('Analiz için giriş gerekli.');
      return;
    }
    setDocBusy(true);
    setDocErr('');
    try {
      const out = await analyzeExamDocumentFiles(
        files.map((f) => f.file),
        data,
        user.id,
        fp,
        uploadExamScan,
        requestExamDocumentScan,
      );
      if ('error' in out) {
        setDocErr(out.error);
        setDocResult(null);
        return;
      }
      setDocResult(out);
      toast(out.unreadable && out.empty ? 'Dosya okunamadı' : 'Analiz sonucu hazır');
    } catch {
      setDocErr('Analiz şu an alınamadı. Sonuç uydurulmadı.');
    } finally {
      setDocBusy(false);
    }
  }

  async function runAi() {
    if (!board.hasData && !progress.capacity.weekMinutes) return;
    if (cacheRef.current?.fp === fp) {
      setAiReport(cacheRef.current.report);
      return;
    }
    setAiBusy(true);
    setAiErr('');
    try {
      const report = await requestAiCoachAnalysis(data);
      cacheRef.current = { fp, report };
      setAiReport(report);
    } catch {
      setAiErr('Analiz şu an alınamadı.');
    } finally {
      setAiBusy(false);
    }
  }

  const shown = aiReport && !aiReport.empty ? aiReport : null;
  const total = data.sessions.reduce((a, x) => a + x.minutes, 0);
  const qs = data.questions.reduce((a, x) => a + x.correct + x.wrong + x.blank, 0);
  const bankSolved = Object.values(data.questionStats).reduce((a, s) => a + s.attempts, 0);
  const bankCount = QUESTION_BANK_ENABLED ? bankSolved : 0;
  const done = data.tasks.filter((x) => x.done).length;
  const openTasks = data.tasks.filter((x) => !x.done).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    const date = localDateKey(dt);
    return { date, mins: data.sessions.filter((x) => x.date === date).reduce((a, x) => a + x.minutes, 0) };
  });
  const week = weekMinutes(data);
  const weekGoal = weekGoalPct(data);
  const tytAytExams = data.exams
    .filter((e) => {
      const label = `${e.kind || ''} ${e.name || ''}`;
      return /tyt|ayt/i.test(label) || Number(e.tyt) > 0 || Number(e.ayt) > 0;
    })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

  const hasStats = board.hasData || total || qs || bankCount || data.weekHours > 0;

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {edu.gradeLabel || 'Profil'}
        {edu.fieldShort ? ` · ${edu.fieldShort}` : ''}
        {edu.age ? ` · ${edu.age} yaş` : ''}
        {edu.periodLabel ? ` · ${edu.periodLabel}` : ''}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>AI İLE ANALİZ ET</h3></div>
        <p style={{ marginTop: 0 }}>
          Analiz etmek istediğiniz sınav/deneme fotoğraflarını veya PDF dosyasını yükleyin.
        </p>
        <p className="muted">
          Birden fazla fotoğraf veya PDF ekleyebilirsiniz. Analiz mevcut deneme kaydını otomatik değiştirmez.
          Sayfa açılışında model çağrılmaz.
        </p>
        <div className="field">
          <label>Fotoğraf / PDF</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={EXAM_DOC_ACCEPT}
            multiple
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
        {files.length ? (
          <div style={{ marginTop: 8 }}>
            {files.map((f) => (
              <div className="plan-item" key={f.id}>
                <span>
                  {f.file.type.startsWith('image/') ? (
                    <img src={f.url} alt={f.file.name} style={{ maxWidth: 120, maxHeight: 80, display: 'block', marginBottom: 4 }} />
                  ) : null}
                  {f.file.name}
                  <br />
                  <small className="muted">{Math.round(f.file.size / 1024)} KB</small>
                </span>
                <button className="btn secondary" type="button" onClick={() => removeFile(f.id)}>Kaldır</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">Dosya yüklenmeden AI analizi başlatılamaz.</p>
        )}
        <div className="actions" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            type="button"
            disabled={docBusy || !files.length}
            onClick={() => void runDocumentAi()}
          >
            {docBusy ? 'Analiz ediliyor…' : 'Yüklenen dosyaları analiz et'}
          </button>
        </div>
        {docErr ? <p className="notice">{docErr}</p> : null}
      </div>

      {docResult && !docResult.empty ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>ANALİZ SONUCU</h3><span>{docResult.source === 'cache' ? 'Önbellek' : 'AI'}</span></div>
          {docResult.unreadable ? <p className="notice">{docResult.message}</p> : null}
          {docResult.summary ? <p><b>Genel sonuç:</b> {docResult.summary}</p> : null}
          {docResult.conflictsWithProgress.length ? (
            <div className="notice" style={{ marginTop: 8 }}>
              <b>Kayıtlı veriyle çelişki:</b>
              <ul>{docResult.conflictsWithProgress.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          ) : null}

          {docResult.bySubject.length ? (
            <>
              <div className="section-title" style={{ marginTop: 12 }}><h3>Ders / konu</h3></div>
              {docResult.bySubject.map((s) => (
                <div key={s.subject} style={{ marginBottom: 8 }}>
                  <b>{s.subject}</b>
                  <ul style={{ margin: '4px 0' }}>
                    {s.topics.map((t) => (
                      <li key={`${s.subject}-${t.topic}`}>
                        {t.topic}: {t.wrong} yanlış{t.correct ? ` · ${t.correct} doğru` : ''}{t.blank ? ` · ${t.blank} boş` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : null}

          {docResult.mostWrongTopics.length ? (
            <>
              <div className="section-title" style={{ marginTop: 8 }}><h3>En çok hata yapılan konular</h3></div>
              <ul>{docResult.mostWrongTopics.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          ) : null}
          {docResult.missingTopics.length ? (
            <>
              <div className="section-title" style={{ marginTop: 8 }}><h3>Eksik görünen konular</h3></div>
              <ul>{docResult.missingTopics.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          ) : null}
          {docResult.strongTopics.length ? (
            <>
              <div className="section-title" style={{ marginTop: 8 }}><h3>İyi olunan konular</h3></div>
              <ul>{docResult.strongTopics.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          ) : null}

          {docResult.questions.length ? (
            <>
              <div className="section-title" style={{ marginTop: 8 }}><h3>Soru bazlı analiz</h3></div>
              {docResult.questions.map((q, i) => (
                <div className="plan-item" key={`${q.number}-${i}`}>
                  <span>
                    Soru {q.number ?? '?'} → {q.subject} → {q.topic}
                    {q.subtopic && q.subtopic !== 'Belirlenemedi' ? ` → ${q.subtopic}` : ''}
                    <br />
                    <small className="muted">
                      {verdictLabel(q.verdict)}
                      {q.verdict === 'yanlis' && q.errorType !== 'Belirlenemedi' ? ` · ${q.errorType}` : ''}
                      {!q.readable ? ' · okunamadı' : ''}
                    </small>
                  </span>
                </div>
              ))}
            </>
          ) : null}

          {docResult.unreadableQuestions.length ? (
            <p className="notice" style={{ marginTop: 8 }}>
              Okunamayan sorular: {docResult.unreadableQuestions.join(', ')}
            </p>
          ) : null}

          {docResult.advice ? (
            <>
              <div className="section-title" style={{ marginTop: 8 }}><h3>AI değerlendirmesi</h3></div>
              <p>{docResult.advice}</p>
            </>
          ) : null}
          <p className="muted">Bu sonuç denemelere otomatik kaydedilmez.</p>
        </div>
      ) : docResult?.unreadable ? (
        <div className="card notice" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>ANALİZ SONUCU</h3></div>
          <p>{docResult.message}</p>
        </div>
      ) : null}

      {!hasStats ? (
        <div className="card notice" style={{ marginBottom: 16 }}>
          <h3>Genel durum</h3>
          <p>Henüz yeterli kayıtlı veri yok. Deneme veya çalışma eklediğinde grafikler dolacak. Üstteki dosya analizi bağımsız çalışır.</p>
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn primary" type="button" onClick={() => go('exams')}>Sınav sonuçları</button>
            <button className="btn secondary" type="button" onClick={() => go('timer')}>Çalışma saati</button>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><h3>Genel Durum</h3></div>
            <div className="grid stats">
              <div className="card stat"><div className="label">TOPLAM ÇALIŞMA</div><div className="value">{formatMinutes(total)}</div></div>
              <div className="card stat"><div className="label">SON 7 GÜN</div><div className="value">{formatMinutes(progress.capacity.weekMinutes)}</div></div>
              <div className="card stat"><div className="label">HAFTALIK ORT.</div><div className="value">{formatMinutes(Math.round(progress.capacity.weekMinutes / 7))}</div><div className="sub">günlük</div></div>
              <div className="card stat"><div className="label">TAMAMLANAN GÖREV</div><div className="value">{done}</div></div>
              <div className="card stat"><div className="label">AÇIK GÖREV</div><div className="value">{openTasks}</div></div>
              {board.lastTyt != null ? <div className="card stat"><div className="label">SON TYT</div><div className="value">{board.lastTyt.toFixed(1)}</div></div> : null}
              {board.lastAyt != null ? <div className="card stat"><div className="label">SON AYT</div><div className="value">{board.lastAyt.toFixed(1)}</div></div> : null}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><h3>Deneme Analizi</h3></div>
            {tytAytExams.length ? tytAytExams.map((e) => {
              const kindLabel = /ayt/i.test(String(e.kind || e.name || '')) ? 'AYT' : /tyt/i.test(String(e.kind || e.name || '')) ? 'TYT' : 'TYT / AYT';
              return (
                <div className="plan-item" key={e.id}>
                  <span>
                    {kindLabel} · {e.name || 'Deneme'} · {e.date}
                    <br />
                    <small className="muted">
                      TYT {Number(e.tyt || 0).toFixed(1)} · AYT {Number(e.ayt || 0).toFixed(1)}
                    </small>
                  </span>
                </div>
              );
            }) : <p className="muted">TYT / AYT deneme kaydı yok.</p>}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><h3>Çalışma Analizi</h3></div>
            <div className="chart">
              {days.map((x) => (
                <div className="bar" key={x.date} style={{ height: '100%' }}>
                  <i style={{ height: `${Math.min(100, (x.mins / 180) * 100)}%` }} />
                  <small>{x.mins}</small>
                  <em>{new Date(`${x.date}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}</em>
                </div>
              ))}
            </div>
            <div className="status-grid" style={{ marginTop: 12 }}>
              <div className="status"><b>Haftalık</b><span>{formatMinutes(week)}</span></div>
              <div className="status"><b>Hedef</b><span>{weekGoal.hoursLabel}</span></div>
              <div className="status"><b>Gerçekleşen</b><span>%{weekGoal.pct}</span></div>
              <div className="status"><b>Tipik gün</b><span>{formatMinutes(progress.capacity.typicalDayMinutes)}</span></div>
            </div>
            {progress.capacity.weekTrend.some((d) => d.minutes) ? (
              <div style={{ marginTop: 12 }}>
                {progress.capacity.weekTrend.map((d) => (
                  <div className="kpi" key={`wk-${d.date}`}><div>{d.day}</div><b>{formatMinutes(d.minutes)}</b></div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>AI Değerlendirmesi</h3></div>
        <p className="muted">
          Yaş, sınıf, alan, hedef, deneme sonuçları, çalışma süreleri ve konu ilerlemeleri birlikte değerlendirilir.
          Üstteki dosya analizinden bağımsızdır; sayfa açılınca model çağrılmaz.
        </p>
        <div className="actions">
          <button className="btn primary" type="button" disabled={aiBusy} onClick={() => void runAi()}>
            {aiBusy ? 'Analiz ediliyor…' : 'AI ile Analiz Et'}
          </button>
        </div>
        {aiErr ? <p className="notice">{aiErr}</p> : null}
        {shown ? (
          <div style={{ marginTop: 12 }}>
            <p>{shown.narrative}</p>
            {shown.strengths.length ? <p><b>Güçlü yönler:</b> {shown.strengths.join(', ')}</p> : null}
            {shown.weaknesses.length ? <p><b>Geliştirilmesi gerekenler:</b> {shown.weaknesses.join(', ')}</p> : null}
            {shown.weekHint ? <p><b>Çalışma öncelikleri:</b> {shown.weekHint}</p> : null}
            {shown.todayHint ? <p><b>Hedefe göre durum:</b> {shown.todayHint}</p> : null}
          </div>
        ) : null}
        {localHints.empty || !(localHints.strengths[0] || localHints.weaknesses[0] || localHints.todayHint) ? null : (
          <div style={{ marginTop: 12 }}>
            {localHints.strengths[0] ? <p><b>Güçlü alanın</b><br />{localHints.strengths[0]}</p> : null}
            {localHints.weaknesses[0] ? <p><b>Öncelik</b><br />{localHints.weaknesses[0]}</p> : null}
            {localHints.todayHint ? <p><b>Bugünkü öneri</b><br />{localHints.todayHint}</p> : null}
            {localHints.todayBlocks.length ? (
              <div className="actions">
                <button className="btn secondary" type="button" onClick={() => setData(appendAiBlocksAsTasks(data, localHints.todayBlocks))}>
                  Programa ekle
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
