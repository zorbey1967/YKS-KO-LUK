import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { examCountdown } from '../lib/insights';
import { ExamHomeWidget } from '../components/ExamHomeWidget';
import { NextAppointmentCard } from '../components/NextAppointmentCard';
import { examTitle } from '../lib/stage';
import { displayRank } from '../lib/types';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { StudySuggestCard } from '../components/StudySuggestCard';
import { requestAiCoachAnalysis } from '../lib/aiCoachAnalysis';
import { TaskRows } from '../components/TaskRows';
import { formatMinutes, getStudentProgress, progressFingerprint } from '../lib/studentProgress';

export function HomePage({ onNewTask }: { onNewTask: () => void }) {
  const { data, go, profile, user, isPlatformOwner } = useApp();
  const state = useMemo(() => getStudentProgress(data), [data]);
  const count = examCountdown(data.examDate);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiErr, setAiErr] = useState('');
  const [aiSource, setAiSource] = useState<'ai' | 'local' | ''>('');
  const aiCache = useRef<{ fp: string; text: string; source: 'ai' | 'local' } | null>(null);

  async function analyzeToday() {
    const fp = progressFingerprint(data);
    if (aiCache.current?.fp === fp) {
      setAiText(aiCache.current.text);
      setAiSource(aiCache.current.source);
      setAiErr('');
      return;
    }
    setAiBusy(true);
    setAiErr('');
    try {
      const report = await requestAiCoachAnalysis(data);
      if (report.empty) {
        setAiText('');
        setAiSource('');
        setAiErr('Analiz için yeterli kayıt yok. Deneme veya çalışma ekledikten sonra tekrar deneyin.');
        return;
      }
      const text = report.narrative || 'Kayıtlı verilere göre kısa bir özet üretilemedi.';
      aiCache.current = { fp, text, source: report.source };
      setAiText(text);
      setAiSource(report.source);
      if (report.source !== 'ai') {
        setAiErr('Sunucu AI yanıtı yok; yalnızca kayıtlı veriden yerel özet gösteriliyor.');
      }
    } catch {
      setAiErr('Durum özeti şu an alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setAiBusy(false);
    }
  }

  if (profile?.role === 'coach') {
    const display = getCoachDisplayName(profile.name);
    return (
      <>
        <div className="hero">
          <div className="eyebrow" style={{ color: '#cfe1ff' }}>Koçluk</div>
          <h2>{display}</h2>
          <p>Bugünkü dersler ve randevular Koçluk panelinde.</p>
          <div className="hero-actions">
            <button className="btn primary" type="button" onClick={() => go('coaches')}>Koçluk paneli</button>
            <button className="btn" type="button" onClick={() => go('account')}>Hesabım</button>
          </div>
        </div>
        <NextAppointmentCard />
      </>
    );
  }

  const name = getPersonDisplayName(profile?.name, user ? 'Öğrenci' : 'Misafir');

  if (!user) {
    return (
      <>
        <div className="hero">
          <div className="eyebrow" style={{ color: '#cfe1ff' }}>Giriş / Kayıt</div>
          <h2>Hesabınla devam et.</h2>
          <p>Çalışma araçları, randevu ve görüşmeler oturum açtıktan sonra açılır.</p>
          <div className="hero-actions">
            <button className="btn primary" type="button" onClick={() => go('account')}>Giriş / kayıt</button>
            <button className="btn" type="button" onClick={() => go('account', 'oauth=google')}>Google ile devam et</button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title"><h3>Koçluk</h3></div>
          <p className="muted">Koçları incele; randevu için giriş gerekir.</p>
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => go('coaches')}>Koçları incele</button>
          </div>
        </div>
      </>
    );
  }

  const focus = state.todayFocus[0];
  const tasksDoneToday = state.todayTaskTitles.filter((t) => t.startsWith('✓')).length;

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Öğrenci merkezi</div>
        <h2>{isPlatformOwner ? 'Yönetici hesabı' : `Merhaba, ${name}`}</h2>
        <p>
          {data.grade ? `${data.grade}${data.track ? ` · ${data.track}` : ''}${data.dept ? ` · ${data.dept}` : ''}. ` : 'Sınıf ve hedefini Hesabım’dan tamamla. '}
          {data.examDate
            ? (count.past ? `${examTitle(data)} tarihi geçti.` : `${examTitle(data)}’ye ${count.label}.`)
            : 'Sınav tarihleri Sınavlarım’da.'}
          {data.rank > 0 ? ` Hedef sıra ${displayRank(data.rank)}.` : ''}
        </p>
        <div className="hero-actions">
          <button className="btn primary" type="button" onClick={() => go('plan')}>HADİ BAŞLA</button>
          <button className="btn" type="button" onClick={() => window.dispatchEvent(new Event('yks-open-zorro'))}>ZORRO</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Bugün ne yapmalıyım?</h3></div>
        {focus ? (
          <p style={{ marginTop: 0, fontSize: '1.05rem' }}>
            <b>{focus.clock ? `${focus.clock} ` : ''}{focus.subject}</b>
            {focus.topic ? ` / ${focus.topic}` : ''}
            <span className="muted"> — {focus.reason}</span>
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>Öneri için sınıfını seç veya deneme/çalışma ekle. Uydurma öneri yok.</p>
        )}
        <div className="grid stats" style={{ marginTop: 12 }}>
          <div className="card stat">
            <div className="label">ÇALIŞMA</div>
            <div className="value">{formatMinutes(state.capacity.todayTotal)}</div>
          </div>
          <div className="card stat">
            <div className="label">GÖREVLER</div>
            <div className="value">{tasksDoneToday}/{state.todayTaskTitles.length || state.tasks.open}</div>
          </div>
          <div className="card stat">
            <div className="label">HAFTA</div>
            <div className="value">%{state.weekGoal.pct}</div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" type="button" onClick={() => go('plan')}>Akıllı Plan</button>
          <button className="btn secondary" type="button" onClick={() => go('exams')}>Sınavlarım</button>
          <button className="btn secondary" type="button" onClick={() => go('analytics')}>Analiz</button>
          <button className="btn secondary" type="button" onClick={() => go('schedule')}>Ders Programı</button>
          <button className="btn secondary" type="button" onClick={() => go('library')}>Kütüphane</button>
        </div>
      </div>

      <ExamHomeWidget />

      <div style={{ marginTop: 16 }}>
        <StudySuggestCard />
      </div>
      <div style={{ marginTop: 16 }}>
        <NextAppointmentCard />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Koçun verdiği görevler</h3></div>
        {data.tasks.some((t) => t.origin === 'coach') ? (
          <TaskRows tasks={data.tasks.filter((t) => t.origin === 'coach')} />
        ) : <p className="muted">Açık koç görevi yok.</p>}
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn secondary" type="button" onClick={onNewTask}>Görev ekle</button>
          <button className="btn secondary" type="button" onClick={() => go('plan')}>Koçun Programı</button>
        </div>
      </div>

      <section className="card why-here" style={{ marginTop: 20 }} aria-labelledby="why-here-title">
        <div className="section-title">
          <h3 id="why-here-title">Neden Buradan Çalışmalısın?</h3>
        </div>
        <p className="why-here-lead">
          Sınıfın, hedefin, denemelerin ve gerçek çalışma süren aynı zincirde toplanır; plan ve öneriler buna göre şekillenir.
          Veri yoksa sahte istatistik üretilmez.
        </p>
        <details className="why-here-block">
          <summary>Kişiye özel eğitim, AI ve koç bağlantısı</summary>
          <p>
            Alanına (EA/SAY/SÖZ) ve sınıfına göre içerik filtrelenir. ZORRO, Akıllı Plan ve Analiz’deki AI gerçek sunucu
            çağrılarıdır; sayfa açılır açılmaz model çalışmaz. Koçun Programı ile kendi Ders Programın birbirini ezmez.
          </p>
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn secondary" type="button" disabled={aiBusy} onClick={() => void analyzeToday()}>
              {aiBusy ? 'Analiz ediliyor…' : 'Bugünkü durumunu analiz et'}
            </button>
            <button className="btn secondary" type="button" onClick={() => go('analytics')}>AI ile Analiz Et</button>
          </div>
          {aiText ? (
            <p style={{ marginTop: 12 }}>
              {aiSource === 'ai' ? <small className="muted">AI özeti · </small> : <small className="muted">Yerel özet · </small>}
              {aiText}
            </p>
          ) : null}
          {aiErr ? <p className="muted" style={{ marginTop: 12 }}>{aiErr}</p> : null}
        </details>
      </section>
    </>
  );
}
