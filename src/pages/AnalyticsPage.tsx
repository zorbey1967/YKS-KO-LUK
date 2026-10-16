import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ExamInsight } from '../components/ExamInsight';
import { FeatureLock } from '../components/FeatureLock';
import { ExamAnalysisPanel } from '../components/ExamAnalysisPanel';
import { appendAiBlocksAsTasks, localAiCoachReport, requestAiCoachAnalysis, type AiCoachReport } from '../lib/aiCoachAnalysis';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { eliteReport } from '../lib/elite';
import { examCountdown, weekGoalPct, weekMinutes } from '../lib/insights';
import { examKind, examTitle } from '../lib/stage';
import { buildAnalyticsBoard } from '../lib/studentAnalytics';
import { formatMinutes, getStudentProgress, progressFingerprint } from '../lib/studentProgress';
import { canSeeAnalyticsPage, canUseAnalytics } from '../lib/subscription';
import { localDateKey } from '../lib/util';

export function AnalyticsPage() {
  const { data, setData, go, profile, isAdmin } = useApp();
  const see = canSeeAnalyticsPage(profile, isAdmin);
  const use = canUseAnalytics(profile, isAdmin);
  const board = useMemo(() => buildAnalyticsBoard(data), [data]);
  const progress = useMemo(() => getStudentProgress(data), [data]);
  const fp = useMemo(() => progressFingerprint(data), [data]);
  const cacheRef = useRef<{ fp: string; report: AiCoachReport } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [aiReport, setAiReport] = useState<AiCoachReport | null>(null);
  const [tab, setTab] = useState<'genel' | 'ders' | 'trend' | 'calisma' | 'ai'>('genel');
  const localHints = useMemo(() => localAiCoachReport(data, board), [data, board]);

  if (!see) {
    return <FeatureLock title="Analiz sayfası üyelik veya 14 günlük deneme sonrası görünür" />;
  }
  if (!use) {
    return (
      <>
        <FeatureLock title="Analiz özelliği Premium veya 14 günlük denemede açılır">
          <p className="muted">Sayfa görünür; grafikler, tarama ve ücretli analiz Pro veya ücretsiz planda çalışmaz. Yerel rol/paket değişikliği yetki vermez.</p>
        </FeatureLock>
      </>
    );
  }

  async function runAi() {
    if (!board.hasData) return;
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
  const bankCorrect = Object.values(data.questionStats).reduce((a, s) => a + s.correct, 0);
  const acc = bankSolved ? Math.round((bankCorrect / bankSolved) * 100) : 0;
  const done = data.tasks.filter((x) => x.done).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    const date = localDateKey(dt);
    return { date, mins: data.sessions.filter((x) => x.date === date).reduce((a, x) => a + x.minutes, 0) };
  });
  const mx = Math.max(1, ...board.tytSeries.map((x) => x.net), ...board.aytSeries.map((x) => x.net));
  const bySub: Record<string, number> = {};
  data.sessions.forEach((s) => { bySub[s.subject] = (bySub[s.subject] || 0) + s.minutes; });
  const week = weekMinutes(data);
  const weekGoal = weekGoalPct(data);
  const weekPct = weekGoal.pct;
  const kind = examKind(data);
  const n1 = kind === 'KPSS' ? 'GY' : kind === 'YKS' ? 'TYT' : 'Deneme-1';
  const n2 = kind === 'KPSS' ? 'GK' : kind === 'YKS' ? 'AYT' : 'Deneme-2';
  const count = examCountdown(data.examDate);
  const lastCalc = data.calcs.slice(0, 4);
  const elite = eliteReport(data);
  const bankCount = QUESTION_BANK_ENABLED ? bankSolved : 0;

  if (!board.hasData && !total && !qs && !bankCount && data.weekHours <= 0) {
    return (
      <div className="card notice">
        <h3>GENEL PERFORMANS</h3>
        <p>Henüz yeterli veri yok. İlk denemeni eklediğinde gelişimini burada görebileceksin.</p>
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn primary" type="button" onClick={() => go('exams')}>Deneme ekle</button>
          <button className="btn secondary" type="button" onClick={() => go('calculator')}>Net hesapla</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="actions analytics-tabs" style={{ marginBottom: 12 }}>
        {([
          ['genel', 'GENEL'],
          ['ders', 'DERS'],
          ['trend', 'DENEME TRENDİ'],
          ['calisma', 'ÇALIŞMA'],
          ['ai', 'AI ANALİZİ'],
        ] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'btn primary' : 'btn secondary'} type="button" onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div hidden={tab !== 'genel'} className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>GENEL PERFORMANS</h3></div>
        <div className="grid stats">
          {board.lastTyt != null ? <div className="card stat"><div className="label">SON TYT NETİ</div><div className="value">{board.lastTyt.toFixed(1)}</div></div> : null}
          {board.lastAyt != null ? <div className="card stat"><div className="label">SON AYT NETİ</div><div className="value">{board.lastAyt.toFixed(1)}</div></div> : null}
          {board.avgTyt != null ? <div className="card stat"><div className="label">ORTALAMA TYT</div><div className="value">{board.avgTyt.toFixed(1)}</div></div> : null}
          {board.avgAyt != null ? <div className="card stat"><div className="label">ORTALAMA AYT</div><div className="value">{board.avgAyt.toFixed(1)}</div></div> : null}
          {board.maxNet != null ? <div className="card stat"><div className="label">EN YÜKSEK NET</div><div className="value">{board.maxNet.toFixed(1)}</div></div> : null}
          {board.lastExamDate ? <div className="card stat"><div className="label">SON DENEME</div><div className="value" style={{ fontSize: 18 }}>{board.lastExamDate}</div></div> : null}
          <div className="card stat"><div className="label">DENEME SAYISI</div><div className="value">{data.exams.length}</div></div>
          <div className="card stat"><div className="label">ÇALIŞMA</div><div className="value">{formatMinutes(progress.capacity.weekMinutes)}</div><div className="sub">7 gün</div></div>
          {progress.insights.strengths[0] ? <div className="card stat"><div className="label">EN İYİ DERS</div><div className="value" style={{ fontSize: 18 }}>{progress.insights.strengths[0]}</div></div> : null}
          {progress.insights.weaknesses[0] ? <div className="card stat"><div className="label">EN ZAYIF DERS</div><div className="value" style={{ fontSize: 18 }}>{progress.insights.weaknesses[0]}</div></div> : null}
          {board.subjects.find((s) => s.trend === 'up') ? <div className="card stat"><div className="label">EN HIZLI GELİŞEN</div><div className="value" style={{ fontSize: 18 }}>{board.subjects.find((s) => s.trend === 'up')?.name}</div></div> : null}
          {board.subjects.find((s) => s.trend === 'down') ? <div className="card stat"><div className="label">GERİLEYEN DERS</div><div className="value" style={{ fontSize: 18 }}>{board.subjects.find((s) => s.trend === 'down')?.name}</div></div> : null}
        </div>
      </div>

      {progress.capacity.weekTrend.some((d) => d.minutes) ? (
        <div hidden={tab !== 'calisma'} className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>ÇALIŞMA TRENDİ</h3></div>
          {progress.capacity.weekTrend.map((d) => (
            <div className="kpi" key={`wk-${d.date}`}><div>{d.day}</div><b>{formatMinutes(d.minutes)}</b></div>
          ))}
        </div>
      ) : null}

      {board.subjects.length ? (
        <div hidden={tab !== 'trend'} className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>DENEME TRENDİ</h3></div>
          {board.subjects.map((s) => (
            <div className="kpi" key={`tr-${s.name}`}>
              <div>{s.name}</div>
              <b>{s.trend === 'up' ? '📈 yükseliyor' : s.trend === 'down' ? '📉 düşüyor' : s.trend === 'flat' ? '➡️ sabit' : '—'}</b>
            </div>
          ))}
        </div>
      ) : null}

      <div hidden={tab !== 'ai'} className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>AI ANALİZİ</h3></div>
        <p className="muted">Sayfa açılınca model çağrılmaz. Yalnızca kayıtlı deneme/net kullanılır.</p>
        <div className="actions">
          <button className="btn primary" type="button" disabled={aiBusy || !board.hasData} onClick={() => void runAi()}>
            {aiBusy ? 'Analiz ediliyor…' : '🤖 AI ile Analiz Et'}
          </button>
        </div>
        {aiErr ? <p className="notice">{aiErr}</p> : null}
        {!board.hasData ? <p className="muted">Analiz için önce deneme veya net kaydı gerekir.</p> : null}
        {shown ? (
          <div style={{ marginTop: 12 }}>
            <p>{shown.narrative}</p>
            {shown.strengths.length ? <p><b>Güçlü olduğun alanlar:</b> {shown.strengths.join(', ')}</p> : null}
            {shown.weaknesses.length ? <p><b>Geliştirmen gereken alanlar:</b> {shown.weaknesses.join(', ')}</p> : null}
            {board.subjects.filter((s) => s.trend === 'up').length ? <p><b>Son dönemde yükselenler:</b> {board.subjects.filter((s) => s.trend === 'up').map((s) => s.name).join(', ')}</p> : null}
            {board.subjects.filter((s) => s.trend === 'down').length ? <p><b>Son dönemde gerileyenler:</b> {board.subjects.filter((s) => s.trend === 'down').map((s) => s.name).join(', ')}</p> : null}
            <p><b>Çalışma tempon:</b> {formatMinutes(progress.capacity.typicalDayMinutes)} / gün · bu hafta {formatMinutes(progress.capacity.weekMinutes)}</p>
            {shown.weekHint ? <p><b>Deneme performansın:</b> {shown.weekHint}</p> : null}
            {shown.todayHint ? <p><b>Bugünkü öneri:</b> {shown.todayHint}</p> : null}
          </div>
        ) : null}
      </div>

      {localHints.empty || !(localHints.strengths[0] || localHints.weaknesses[0] || localHints.todayHint) ? null : (
        <div hidden={tab !== 'ai'} className="card" style={{ marginBottom: 16 }}>
          <div className="section-title"><h3>AI ÖNERİLERİ</h3></div>
          {localHints.strengths[0] ? <p style={{ marginTop: 0 }}><b>Güçlü alanın</b><br />{localHints.strengths[0]}</p> : null}
          {localHints.weaknesses[0] ? <p><b>Öncelik</b><br />{localHints.weaknesses[0]}</p> : null}
          {localHints.todayHint ? <p><b>Bugünkü öneri</b><br />{localHints.todayHint}</p> : null}
          {localHints.todayBlocks.length ? (
            <div className="actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setData(appendAiBlocksAsTasks(data, localHints.todayBlocks))}
              >
                Programa ekle
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div hidden={tab !== 'genel'}>
      {total || data.exams.length || qs || bankCount || data.weekHours > 0 ? (
        <div className="grid stats">
          {total ? <div className="card stat"><div className="label">TOPLAM ÇALIŞMA</div><div className="value">{(total / 60).toFixed(1)}s</div><div className="sub">Kayıtlı oturumlar</div></div> : null}
          {(qs || bankCount) ? <div className="card stat"><div className="label">SORU</div><div className="value">{qs + bankCount}</div><div className="sub">{QUESTION_BANK_ENABLED && bankSolved ? `Doğruluk %${acc}` : 'Kayıtlı set'}</div></div> : null}
          {data.weekHours > 0 ? <div className="card stat"><div className="label">HAFTA</div><div className="value">{weekPct}%</div><div className="sub">{(week / 60).toFixed(1)} / {weekGoal.hoursLabel}</div></div> : null}
        </div>
      ) : null}

      {data.examDate ? (
        <div className="notice banner" style={{ marginBottom: 16 }}>{count.past ? 'Sınav tarihi geçti.' : `${examTitle(data)}’ye ${count.label}.`}{data.tasks.length ? ` Görev tamamlanma %${Math.round((done / data.tasks.length) * 100)}.` : ''}</div>
      ) : null}
      {(data.examDate || bankCount || data.exams.length) ? (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3>Sınav temposu</h3><span>{elite.phase}</span></div>
        {elite.lines.map((ln) => <p key={ln.slice(0, 40)} className="muted" style={{ margin: '6px 0' }}>{ln}</p>)}
      </div>
      ) : null}
      </div>

      <div hidden={tab !== 'trend'}>
      {board.hasData ? <ExamAnalysisPanel /> : null}
      <div style={{ marginBottom: 16 }}><ExamInsight /></div>

      <div className="grid two">
        <div className="card">
          <div className="section-title"><h3>NET DEĞİŞİMİ · {n1}</h3></div>
          <div className="chart">
            {board.tytSeries.length ? board.tytSeries.slice(-10).map((x) => (
              <div className="bar" key={`t-${x.date}-${x.name}`} style={{ height: '100%' }}>
                <i style={{ height: `${(x.net / mx) * 100}%` }} />
                <small>{x.net}</small>
                <em>{x.date.slice(5)}</em>
              </div>
            )) : <div className="empty" style={{ width: '100%' }}>TYT serisi yok.</div>}
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h3>NET DEĞİŞİMİ · {n2}</h3></div>
          <div className="chart">
            {board.aytSeries.length ? board.aytSeries.slice(-10).map((x) => (
              <div className="bar" key={`a-${x.date}-${x.name}`} style={{ height: '100%' }}>
                <i style={{ height: `${(x.net / mx) * 100}%` }} />
                <small>{x.net}</small>
                <em>{x.date.slice(5)}</em>
              </div>
            )) : <div className="empty" style={{ width: '100%' }}>AYT serisi yok.</div>}
          </div>
        </div>
      </div>

      {board.examRows.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Deneme analizi</h3></div>
          {board.examRows.map((e) => (
            <div className="plan-item" key={e.id}>
              <span>
                {e.name} · {e.date}
                <br />
                <small className="muted">
                  Net {e.net}
                  {e.correct != null ? ` · D ${e.correct}` : ''}
                  {e.wrong != null ? ` · Y ${e.wrong}` : ''}
                  {e.blank != null ? ` · B ${e.blank}` : ''}
                  {e.delta != null ? ` · Δ ${e.delta > 0 ? '+' : ''}${e.delta.toFixed(1)}` : ''}
                  {e.subjects.length ? ` · ${e.subjects.map((s) => `${s.name} ${s.net}`).join(', ')}` : ''}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      </div>

      {board.subjects.length ? (
        <div hidden={tab !== 'ders'} className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>DERS PERFORMANSI</h3></div>
          {board.subjects.map((s) => (
            <div className="plan-item" key={s.name}>
              <span>
                {s.name}
                <br />
                <small className="muted">
                  Son: {s.last ?? '—'} · Ort: {s.avg != null ? s.avg.toFixed(1) : '—'} · En yüksek: {s.high ?? '—'}
                  {s.trend === 'up' ? ' · Trend: ↑' : s.trend === 'down' ? ' · Trend: ↓' : s.trend === 'flat' ? ' · Trend: →' : ''}
                  {s.band ? ` · ${s.band}` : ''}
                  {s.status ? ` · ${s.status}` : ''}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {board.weakAreas.length ? (
        <div hidden={tab !== 'ders'} className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>En çok geliştirmen gereken alanlar</h3></div>
          <ol>
            {board.weakAreas.map((w) => <li key={w}>{w}</li>)}
          </ol>
        </div>
      ) : null}

      <div hidden={tab !== 'calisma'} className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Ders süreleri</h3></div>
        {Object.keys(bySub).length ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([s, m]) => (
          <div className="plan-item" key={s}><span>{s}</span><b>{m} dk</b></div>
        )) : <div className="empty">Oturum yok.</div>}
        {lastCalc.length ? (
          <>
            <div className="section-title" style={{ marginTop: 16 }}><h3>Son netler</h3></div>
            {lastCalc.map((c) => (
              <div className="plan-item" key={c.id}><span>{c.type} • {c.date}</span><b>{Number(c.net).toFixed(2)}</b></div>
            ))}
          </>
        ) : null}
      </div>
      <div hidden={tab !== 'calisma'} className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Son 7 gün çalışma</h3><span>dakika</span></div>
        <div className="chart">
          {days.map((x) => (
            <div className="bar" key={x.date} style={{ height: '100%' }}>
              <i style={{ height: `${Math.min(100, (x.mins / 180) * 100)}%` }} />
              <small>{x.mins}</small>
              <em>{new Date(`${x.date}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}</em>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
