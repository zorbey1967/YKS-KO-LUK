import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  appendAiBlocksAsTasks,
  cachedAiCoachReport,
  localAiCoachReport,
  requestAiCoachAnalysis,
  type AiCoachReport,
} from '../lib/aiCoachAnalysis';
import { openZorro } from '../lib/zorroBus';

/**
 * ZORRO'nun "durum yorumu" yeteneği — sitede tek bileşen.
 * Ana Sayfa kısa hâlini, Analiz sayfası ayrıntılı hâlini gösterir; ikisi aynı önbelleği ve aynı
 * model çağrısını paylaşır (veri değişmediyse ikinci çağrı yok). Açılışta model çağrılmaz.
 * Takip sorusu ayrı bir AI ekranında değil, ZORRO sohbetinde sorulur.
 */
export function AiCoachCard({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const { data, setData, toast, go } = useApp();
  const local = useMemo(() => localAiCoachReport(data), [data]);
  const [report, setReport] = useState<AiCoachReport | null>(() => cachedAiCoachReport(data));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const shown = report && !report.empty ? report : null;

  async function ask() {
    setBusy(true);
    setErr('');
    try {
      const next = await requestAiCoachAnalysis(data);
      if (next.empty) {
        setReport(null);
        setErr('Yorum için önce çalışma, deneme veya konu kaydı ekle.');
        return;
      }
      if (next.source !== 'ai') setErr('ZORRO şu an yanıt vermedi; kayıtlarına göre özet gösteriliyor.');
      setReport(next);
    } catch {
      setErr('Yorum şu an alınamadı. Biraz sonra tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const base = shown || (local.empty ? null : local);
  return (
    <section className="card ai-coach">
      <div className="section-title">
        <h3>{variant === 'full' ? 'ZORRO değerlendirmesi' : 'ZORRO önerisi'}</h3>
        <span>{shown?.source === 'ai' ? 'yapay zekâ' : 'kayıtlarına göre'}</span>
      </div>
      {base ? (
        <ul className="dash-sw">
          {base.strengths.length ? <li><b>Güçlü:</b> {base.strengths.join(', ')}</li> : null}
          {base.weaknesses.length ? <li><b>Öncelik:</b> {base.weaknesses.join(', ')}</li> : null}
          {variant === 'full' && base.weekHint ? <li><b>Bu hafta:</b> {base.weekHint}</li> : null}
          {base.todayHint ? <li><b>Bugün:</b> {base.todayHint}</li> : null}
        </ul>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>Deneme, çalışma veya konu kaydı ekledikçe öneriler kişiselleşir.</p>
      )}
      {shown?.source === 'ai' && shown.narrative ? <p className="dash-ai-text">{shown.narrative}</p> : null}
      {err ? <p className="muted">{err}</p> : null}
      <div className="actions">
        <button className="btn primary" type="button" disabled={busy || local.empty} onClick={() => void ask()}>
          {busy ? 'Yorumlanıyor…' : shown?.source === 'ai' ? 'Yorumu yenile' : 'Durumumu yorumla'}
        </button>
        <button className="btn secondary" type="button" onClick={() => openZorro('Kayıtlarıma göre bugün neye odaklanmalıyım? Kısa ve somut söyle.')}>ZORRO’ya sor</button>
        {variant === 'full' && base?.todayBlocks.length ? (
          <button className="btn" type="button" onClick={() => {
            setData(appendAiBlocksAsTasks(data, base.todayBlocks));
            toast('Bugünün görevlerine eklendi');
          }}>Görevlere ekle</button>
        ) : null}
        {variant === 'compact' ? <button className="btn" type="button" onClick={() => go('analytics')}>Ayrıntılı analiz</button> : null}
      </div>
    </section>
  );
}
