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
import { formatMinutes, getStudentProgress, progressFingerprint } from '../lib/studentProgress';

export function HomePage({ onNewTask }: { onNewTask: () => void }) {
  const { data, go, profile, user, isPlatformOwner } = useApp();
  const state = useMemo(() => getStudentProgress(data), [data]);
  const count = examCountdown(data.examDate);
  const todayDone = data.tasks.filter((t) => t.done).length;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiErr, setAiErr] = useState('');
  const aiCache = useRef<{ fp: string; text: string } | null>(null);

  async function analyzeToday() {
    const fp = progressFingerprint(data);
    if (aiCache.current?.fp === fp) {
      setAiText(aiCache.current.text);
      setAiErr('');
      return;
    }
    setAiBusy(true);
    setAiErr('');
    try {
      const report = await requestAiCoachAnalysis(data);
      if (report.empty) {
        setAiText('');
        setAiErr('Analiz için yeterli kayıt yok. Konu, deneme veya çalışma ekledikten sonra tekrar deneyin.');
        return;
      }
      const text = report.narrative || 'Kayıtlı verilere göre kısa bir özet üretilemedi.';
      aiCache.current = { fp, text };
      setAiText(text);
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

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Öğrenci merkezi</div>
        <h2>{isPlatformOwner ? 'Yönetici hesabı' : `Merhaba, ${name}`}</h2>
        <p>
          Sistem seni tanıyor: sınıf, hedef, konular, denemeler ve çalışma sürelerin tek yerde Akıllı Plan’a gider.
          {data.examDate
            ? (count.past ? ` ${examTitle(data)} tarihi geçti.` : ` ${examTitle(data)}’ye ${count.label}.`)
            : ' Sınav tarihi Hedefim veya Takvim’de.'}
          {data.rank > 0 ? ` Hedef sıra ${displayRank(data.rank)}.` : ''}
        </p>
        <div className="hero-actions">
          <button className="btn primary" type="button" onClick={() => go('plan')}>HAZIRIM / HADİ BAŞLA</button>
          <button className="btn" type="button" onClick={() => window.dispatchEvent(new Event('yks-open-zorro'))}>ZORRO ile konuş</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Bugün Nasılsın?</h3></div>
        <div className="grid stats">
          <div className="card stat"><div className="label">BUGÜN NE KADAR ÇALIŞTIM?</div><div className="value">{formatMinutes(state.capacity.todayTotal)}</div><div className="sub">timer {formatMinutes(state.capacity.todayTimer)}</div></div>
          <div className="card stat"><div className="label">SESSİZ KÜTÜPHANEDE NE KADAR KALDIM?</div><div className="value">{formatMinutes(state.capacity.todayLibrary)}</div><div className="sub">hafta {formatMinutes(state.capacity.weekLibrary)}</div></div>
          <div className="card stat"><div className="label">GÖREVLER</div><div className="value">{state.todayTaskTitles.filter((t) => t.startsWith('✓')).length}</div><div className="sub">{state.todayTaskTitles.length ? `${state.todayTaskTitles.length} bugün` : `${state.tasks.open} açık`}</div></div>
          <div className="card stat"><div className="label">BUGÜN KONU</div><div className="value" style={{ fontSize: 18 }}>{state.todayTopics[0] ? state.todayTopics.length : '—'}</div><div className="sub">{state.todayTopics.slice(0, 2).join(' · ') || 'kayıt yok'}</div></div>
          <div className="card stat"><div className="label">SON ÇALIŞMA</div><div className="value" style={{ fontSize: 16 }}>{state.activity[0] ? 'var' : '—'}</div><div className="sub">{state.activity[0]?.text || 'henüz yok'}</div></div>
          <div className="card stat"><div className="label">HAFTALIK İLERLEME</div><div className="value">{formatMinutes(state.capacity.weekMinutes)}</div><div className="sub">{state.weekGoal.hoursLabel} · %{state.weekGoal.pct}</div></div>
          <div className="card stat"><div className="label">SON DENEME DURUMU</div><div className="value" style={{ fontSize: 18 }}>{state.lastExam ? state.lastExam.tyt : '—'}</div><div className="sub">{state.lastExam?.delta != null ? `Δ ${state.lastExam.delta > 0 ? '+' : ''}${state.lastExam.delta}` : 'kayıt yok'}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Hesabıma göre bugün ne yapmalıyım?</h3></div>
        {state.todayFocus[0] ? <p><b>{state.todayFocus[0].clock ? `${state.todayFocus[0].clock} ` : ''}{state.todayFocus[0].subject}{state.todayFocus[0].topic ? ` / ${state.todayFocus[0].topic}` : ''}</b> — {state.todayFocus[0].reason}</p> : <p className="muted">Önce Hesabım’dan sınıfını seç veya konu/deneme ekle. Uydurma öneri yok.</p>}
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => go('plan')}>HAZIRIM / HADİ BAŞLA</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Yaptıkların</h3></div>
        {state.activity.length ? (
          <ul className="muted" style={{ marginTop: 0 }}>
            {state.activity.map((a, i) => <li key={`${a.at}-${i}`}>{a.text}</li>)}
          </ul>
        ) : <p className="muted">Henüz kayıtlı çalışma, deneme veya tamamlanan görev yok.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Akıllı Plan’ın bugünkü önerisi</h3></div>
        {state.todayFocus.length ? state.todayFocus.map((x) => (
          <div className="plan-item" key={`${x.order}-${x.subject}`}>
            <span>{x.order}. {x.subject}{x.topic ? ` — ${x.topic}` : ''}<br /><small className="muted">{x.minutes} dk · {x.reason}</small></span>
          </div>
        )) : <p className="muted">Öneri için Hesabım’dan sınıfını seç veya konu/deneme ekle. Uydurma plan yok.</p>}
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => go('plan')}>Akıllı Plan</button>
          <button className="btn secondary" type="button" onClick={() => go('timer')}>Çalışma saati</button>
        </div>
      </div>

      <ExamHomeWidget />

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Son Deneme Durumu</h3></div>
          {state.lastExam ? (
            <p>TYT {state.lastExam.tyt}{state.lastExam.delta != null ? ` · Δ ${state.lastExam.delta > 0 ? '+' : ''}${state.lastExam.delta}` : ''}</p>
          ) : <p className="muted">Henüz yeterli deneme verisi bulunmuyor.</p>}
          <p className="muted">{state.examFeedback.text}</p>
        </div>
        <div className="card">
          <div className="section-title"><h3>Güçlü Olduğun Alanlar</h3></div>
          {state.insights.strengths[0] ? <p>{state.insights.strengths.join(', ')}</p> : <p className="muted">Güçlü alan için kayıtlı ders neti yok.</p>}
          <div className="section-title" style={{ marginTop: 12 }}><h3>Geliştirmen Gereken Alanlar</h3></div>
          {state.insights.weaknesses[0] ? <p>{state.insights.weaknesses.join(', ')}</p> : <p className="muted">Zayıf alan tahmini yapılmadı.</p>}
          <p className="muted">Tamamlanan görev: {todayDone}</p>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <StudySuggestCard />
      </div>
      <div style={{ marginTop: 16 }}>
        <NextAppointmentCard />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Neden buradan çalışmalısın?</h3></div>
        <p className="muted" style={{ marginTop: 0 }}>
          Bu sistemi neden kullanmalısın? Çalışmaların tek yerde toplanır; programın onayın olmadan değişmez.
        </p>
        <ul className="muted">
          <li>Çalışma süreni takip eder</li>
          <li>Konu ilerlemeni takip eder</li>
          <li>Denemelerini analiz eder</li>
          <li>Eksiklerini belirler</li>
          <li>Hedefini dikkate alır</li>
          <li>Koçunun programını gösterir</li>
          <li>Kendi çalışma programını takip eder</li>
          <li>Yaklaşan sınavlarını dikkate alır</li>
          <li>Yapay zekâ ile performansını yorumlar</li>
          <li>Akıllı Plan’ı buna göre oluşturur</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Yapay Zeka Senin İçin Nasıl Çalışıyor?</h3></div>
        <p style={{ marginTop: 0 }}>
          Hedefini, konu ilerlemeni, deneme sonuçlarını, çalışma sürelerini ve programını birlikte analiz ederek sana kişiselleştirilmiş çalışma önerileri oluşturuyoruz.
        </p>
        <p className="muted">Ne kadar çok veri oluşursa öneriler o kadar kişiselleşir. Sayfa açılınca model çağrılmaz; veri yoksa sonuç uydurulmaz.</p>
        <p className="muted">Yapay zekayı senin için nasıl kullanıyoruz? Konular, denemeler, çalışma ve kütüphane süreleri, kendi programın, koç programı, hedef, sınavlar ve görevler birlikte değerlendirilir.</p>
        <ul className="muted">
          <li>Denemelerini analiz eder</li>
          <li>Konu eksiklerini bulur</li>
          <li>Çalışma temposunu inceler</li>
          <li>Hedefini dikkate alır</li>
          <li>Kendi ders programını dikkate alır</li>
          <li>Koç programını dikkate alır; sessizce değiştirmez</li>
          <li>Yaklaşan sınavlarını dikkate alır</li>
          <li>Gelişimine göre plan değişikliği önerir, onayınla uygular</li>
        </ul>
        <div className="ai-flow" aria-label="Veri akışı">
          {['Verilerin', 'Analiz', 'Eksikler / güçlü yönler', 'Plan önerisi', 'Senin onayın', 'Uygulama', 'Yeni sonuçlar', 'Tekrar analiz'].map((x) => (
            <span className="chip" key={x}>{x}</span>
          ))}
        </div>
        <div className="actions">
          <button className="btn primary" type="button" disabled={aiBusy} onClick={() => void analyzeToday()}>
            {aiBusy ? 'Analiz ediliyor…' : 'Bugünkü durumunu analiz et'}
          </button>
        </div>
        {aiText ? <p style={{ marginTop: 12 }}>{aiText}</p> : null}
        {aiErr ? <p className="muted" style={{ marginTop: 12 }}>{aiErr}</p> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Koçumun Yaptığı Program</h3></div>
        {state.coachToday.length || state.coachWeekFocus.some((d) => d.minutes) ? (
          <>
            {state.coachToday.length ? <p>Bugün: {state.coachToday.map((b) => `${b.title} ${b.minutes} dk`).join(' · ')}</p> : <p className="muted">Bugün için koç bloğu yok.</p>}
            <div className="actions">
              <button className="btn secondary" type="button" onClick={() => go('schedule')}>Programı gör</button>
            </div>
          </>
        ) : <p className="muted">Koç henüz program yazmadı. Uydurma program yok.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Bugünkü Programım</h3></div>
        {state.scheduleToday.length || state.weekFocus.some((d) => d.minutes) ? (
          <>
            {state.scheduleToday.length ? <p>Bugün: {state.scheduleToday.map((b) => `${b.title} ${b.minutes} dk`).join(' · ')}</p> : <p className="muted">Bugün için kendi bloğun yok.</p>}
            <div className="actions">
              <button className="btn secondary" type="button" onClick={() => go('schedule')}>Ders Programım</button>
            </div>
          </>
        ) : <p className="muted">Henüz kendi programını yazmadın. Koç programının üzerine yazılmaz.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Koçumun Benden İstedikleri</h3></div>
        {state.coachTasks.length ? (
          <ul className="muted" style={{ marginTop: 0 }}>
            {state.coachTasks.map((t) => <li key={t}>{t}</li>)}
          </ul>
        ) : <p className="muted">Açık koç görevi yok.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Çalışma araçları</h3></div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => go('plan')}>Akıllı Plan</button>
          <button className="btn secondary" type="button" onClick={() => go('exams')}>Denemeler</button>
          <button className="btn secondary" type="button" onClick={() => go('topics')}>Konular</button>
          <button className="btn secondary" type="button" onClick={onNewTask}>Görev ekle</button>
          <button className="btn secondary" type="button" onClick={() => go('library')}>Kütüphane</button>
          <button className="btn secondary" type="button" onClick={() => go('analytics')}>Analiz</button>
        </div>
      </div>
    </>
  );
}
