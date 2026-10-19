import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NextAppointmentCard } from '../components/NextAppointmentCard';
import { useStudySuggestion } from '../components/StudySuggest';
import { TaskRows } from '../components/TaskRows';
import { ExamListRow } from '../components/ExamListRow';
import { useExamDialogs } from '../components/ExamDialogs';
import { AiCoachCard } from '../components/AiCoachCard';
import { NAV, displayRank } from '../lib/types';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import { formatMinutes, getStudentProgress } from '../lib/studentProgress';
import { getStudentEducationContext } from '../lib/studentEducation';
import { examDaysLeft, fmtExamDateLong, primaryExam, upcomingExams } from '../lib/examTargets';
import { istanbulToday } from '../lib/meeting';
import { weekdayNameIstanbul } from '../lib/insights';
import { isNavPageVisible } from '../lib/features';
import type { PageId } from '../lib/types';

/** Hızlı erişim: ikon ve ad kenar menüyle aynı kaynaktan (NAV) gelir. */
const QUICK_IDS: PageId[] = ['calendar', 'timer', 'tasks', 'plan', 'exams', 'schedule', 'library', 'analytics'];

/**
 * Öğrenci ana sayfası — öncelik sırası:
 * karşılama (tek "Başla") → hedef → bugünkü çalışma → bugünün görevleri → yaklaşan sınav →
 * bugünkü program → hızlı erişim → ZORRO önerisi → son aktiviteler.
 * Her bilgi bir kez görünür. Açılışta model çağrılmaz.
 */
export function HomePage({ onNewTask }: { onNewTask: () => void }) {
  const { data, go, profile, user, isPlatformOwner } = useApp();
  const state = useMemo(() => getStudentProgress(data), [data]);
  const ctx = useMemo(() => getStudentEducationContext(data), [data.grade, data.age, data.track]);
  const dialogs = useExamDialogs();
  const suggestion = useStudySuggestion();

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

  const name = getPersonDisplayName(profile?.name, 'Öğrenci');
  const today = istanbulToday();
  const upcoming = upcomingExams(data.examTargets || [], today);
  const target = primaryExam(upcoming) || null;
  const targetDays = target ? examDaysLeft(target, today) : 0;
  const nextExams = upcoming.filter((t) => t.id !== target?.id).slice(0, 3);
  const todayTasks = data.tasks.filter((t) => t.date === today);
  const doneToday = todayTasks.filter((t) => t.done).length;
  const openTasks = data.tasks.filter((t) => !t.done);
  const listTasks = (todayTasks.length ? todayTasks : openTasks).slice(0, 4);
  const coachOpen = openTasks.filter((t) => t.origin === 'coach').length;
  const weekday = weekdayNameIstanbul(today);
  const profileLine = [ctx.gradeLabel, ctx.fieldShort, ctx.periodLabel].filter(Boolean).join(' · ');
  const quick = QUICK_IDS.map((id) => NAV.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => Boolean(n) && isNavPageVisible(n!.id));

  return (
    <div className="dash">
      <section className="hero dash-hero">
        <p className="dash-date">{fmtExamDateLong(today)}{profileLine ? ` · ${profileLine}` : ''}</p>
        <h2>{isPlatformOwner ? 'Yönetici hesabı' : `Merhaba, ${name}`}</h2>
        <p className="dash-next">
          {suggestion.title
            ? <>Sıradaki: <b>{suggestion.title}</b>{suggestion.meta ? ` · ${suggestion.meta}` : ''}<br /><small>{suggestion.rec.reason}</small></>
            : suggestion.rec.reason}
        </p>
        <div className="hero-actions">
          <button className="btn primary" type="button" onClick={suggestion.start}>{suggestion.cta}</button>
          {suggestion.snooze ? <button className="btn" type="button" onClick={suggestion.snooze}>Yarına ertele</button> : null}
        </div>
      </section>

      <div className="dash-row">
        <section className="card dash-goal" aria-label="Hedefim">
          <div className="section-title">
            <h3>Hedefim</h3>
            <button className="btn secondary" type="button" onClick={() => go('goal')}>{data.dept || data.rank > 0 ? 'Düzenle' : 'Belirle'}</button>
          </div>
          {data.dept ? <p className="dash-goal-dept">{data.dept}</p> : null}
          <p className="muted" style={{ margin: 0 }}>
            {[data.rank > 0 ? `Hedef sıra ${displayRank(data.rank)}` : '', data.weekHours > 0 ? `haftada ${data.weekHours} saat` : ''].filter(Boolean).join(' · ') || 'Bölüm, sıra ve haftalık saatini belirle; öneriler buna göre şekillenir.'}
          </p>
          {target ? (
            <button type="button" className="dash-count" onClick={() => dialogs.openDetail(target)}>
              <b>{targetDays}</b>
              <span>{targetDays === 0 ? 'bugün' : 'gün kaldı'} · {target.title}<br /><small>{fmtExamDateLong(target.date)}</small></span>
            </button>
          ) : null}
        </section>

        <section className="dash-today" aria-label="Bugünkü çalışma">
          <div className="card stat">
            <div className="label">Bugün çalışma</div>
            <div className="value">{formatMinutes(state.capacity.todayTotal)}</div>
            <div className="sub">{state.capacity.todayLibrary ? `kütüphane ${formatMinutes(state.capacity.todayLibrary)}` : `günlük tempo ~${formatMinutes(state.capacity.typicalDayMinutes)}`}</div>
          </div>
          <div className="card stat">
            <div className="label">Bu hafta</div>
            <div className="value">{formatMinutes(state.capacity.weekMinutes)}</div>
            <div className="sub">{data.weekHours > 0 ? `hedefin %${state.weekGoal.pct}’i` : 'haftalık hedef yok'}</div>
            {data.weekHours > 0 ? <div className="progress" role="progressbar" aria-label="Haftalık hedef" aria-valuenow={state.weekGoal.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${state.weekGoal.pct}%` }} /></div> : null}
          </div>
          <div className="card stat">
            <div className="label">Son deneme</div>
            <div className="value">{state.lastExam ? state.lastExam.tyt : '—'}</div>
            <div className="sub">
              {state.lastExam
                ? (state.lastExam.delta != null ? `öncekine göre ${state.lastExam.delta > 0 ? '+' : ''}${state.lastExam.delta}` : state.lastExam.name)
                : 'sonuç yok'}
            </div>
          </div>
        </section>
      </div>

      <div className="dash-row">
        <section className="card">
          <div className="section-title">
            <h3>{todayTasks.length ? `Bugünün görevleri · ${doneToday}/${todayTasks.length}` : 'Açık görevler'}</h3>
            <button className="btn secondary" type="button" onClick={onNewTask}>+ Görev</button>
          </div>
          {coachOpen ? <p className="muted" style={{ marginTop: 0 }}>Koçundan {coachOpen} açık görev var.</p> : null}
          {listTasks.length ? <TaskRows tasks={listTasks} hideStart /> : <p className="muted" style={{ margin: 0 }}>Görev yok.</p>}
          {openTasks.length > listTasks.length ? (
            <div className="actions"><button className="btn" type="button" onClick={() => go('tasks')}>Tüm görevler ({openTasks.length})</button></div>
          ) : null}
        </section>

        <section className="card">
          <div className="section-title">
            <h3>Yaklaşan sınavlar</h3>
            <button className="btn secondary" type="button" onClick={() => dialogs.openNew()}>+ Sınav</button>
          </div>
          {nextExams.length
            ? nextExams.map((t) => <ExamListRow key={t.id} exam={t} onOpen={dialogs.openDetail} />)
            : <p className="muted" style={{ margin: 0 }}>{target ? 'Hedef sınavın dışında yaklaşan sınav yok.' : 'Yaklaşan sınav yok. Yazılı veya denemelerini ekle; öneriler buna göre ayarlanır.'}</p>}
          <div className="actions"><button className="btn" type="button" onClick={() => go('calendar')}>Takvim</button></div>
        </section>
      </div>

      <div className="dash-row">
        <section className="card">
          <div className="section-title"><h3>Bugünkü program</h3><span>{weekday}</span></div>
          {state.scheduleToday.length || state.coachToday.length ? (
            <div className="dash-program">
              {state.scheduleToday.length ? (
                <div>
                  <h4>Ders Programım</h4>
                  {state.scheduleToday.map((b, i) => <div className="cal-line" key={`o-${i}`}><span>{b.title}</span><b>{b.minutes} dk</b></div>)}
                </div>
              ) : null}
              {state.coachToday.length ? (
                <div>
                  <h4>Koçun Programı</h4>
                  {state.coachToday.map((b, i) => <div className="cal-line" key={`c-${i}`}><span>{b.title}</span><b>{b.minutes} dk</b></div>)}
                </div>
              ) : null}
            </div>
          ) : <p className="muted" style={{ marginTop: 0 }}>Bugün için program bloğu yok.</p>}
          <div className="actions"><button className="btn" type="button" onClick={() => go('schedule')}>{state.scheduleToday.length ? 'Programı düzenle' : 'Program oluştur'}</button></div>
        </section>

        <nav className="card dash-quick" aria-label="Hızlı erişim">
          <div className="section-title"><h3>Hızlı erişim</h3></div>
          <div className="dash-tiles">
            {quick.map((q) => (
              <button key={q.id} type="button" className="dash-tile" onClick={() => go(q.id)}>
                <span aria-hidden="true">{q.icon}</span>{q.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <NextAppointmentCard />

      <div className="dash-row">
        <AiCoachCard />
        <section className="card">
          <div className="section-title"><h3>Son yaptıkların</h3></div>
          {state.activity.length ? (
            <ul className="dash-activity">
              {state.activity.slice(0, 5).map((a, i) => <li key={`${a.at}-${i}`}>{a.text}</li>)}
            </ul>
          ) : <p className="muted" style={{ margin: 0 }}>Henüz kayıtlı çalışma, deneme veya tamamlanan görev yok.</p>}
        </section>
      </div>
      {dialogs.element}
    </div>
  );
}
