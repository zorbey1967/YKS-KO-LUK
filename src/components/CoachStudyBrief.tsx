import type { CoachStudyBrief } from '../lib/coachBrief';

export function CoachStudyBriefView({ brief, name }: { brief: CoachStudyBrief; name: string }) {
  if (brief.empty) {
    return (
      <div className="card" style={{ boxShadow: 'none' }}>
        <p className="muted" style={{ margin: 0 }}>
          {name}: henüz paylaşılmış çalışma kaydı yok. Bu, öğrencinin çalışmadığı anlamına gelmez.
        </p>
      </div>
    );
  }
  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="section-title"><h3>{name} — çalışma özeti</h3></div>
      <p className="muted">Süre yalnızca kaydedilmiş oturumlardan. Boş gün “çalışmadı” diye yazılmaz.</p>
      <div className="kpi">
        <div>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Bugün</span>
          <br />
          <b>{brief.todayMinutes == null ? 'kayıt yok' : `${brief.todayMinutes} dk`}</b>
        </div>
        <div>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>7 gün</span>
          <br />
          <b>{brief.weekMinutes == null ? 'kayıt yok' : `${brief.weekMinutes} dk`}</b>
        </div>
        <span className="chip">{brief.tasksDone} bitti / {brief.tasksOpen} açık</span>
      </div>
      {brief.tasksOverdue ? <p>Geciken görev: {brief.overdueTitles.join(', ')}</p> : null}
      {brief.openTitles.length ? <p className="muted">Açık: {brief.openTitles.join(' · ')}</p> : null}
      {brief.dueReviews.length ? (
        <p>Tekrarı gelen: {brief.dueReviews.map((r) => `${r.subject} / ${r.topic}`).join(' · ')}</p>
      ) : null}
      {brief.weakTopics.length ? (
        <p>Soru sonucu: {brief.weakTopics.map((w) => `${w.topic} (${w.wrong} yanlış / ${w.answered} soru)`).join(' · ')}</p>
      ) : null}
      {brief.exams[0] ? (
        <p>
          Son deneme {brief.exams[0].name}: TYT {brief.exams[0].tyt}
          {brief.examDelta.tyt != null ? ` (${brief.examDelta.tyt >= 0 ? '+' : ''}${brief.examDelta.tyt})` : ''}
          {brief.exams[0].ayt ? ` / AYT ${brief.exams[0].ayt}` : ''}
        </p>
      ) : null}
      {brief.difficulties.length ? (
        <p>Öğrencinin belirttiği zorluk: {brief.difficulties.map((d) => `${d.subject} ${d.difficulty}`).join(', ')}</p>
      ) : null}
      {brief.notes.length ? <p>Notlar: {brief.notes.map((n) => n.topic).join(', ')}</p> : null}
      {brief.agenda.length ? (
        <>
          <div className="section-title"><h3>Görüşmede</h3></div>
          <ul className="suggest-evidence">
            {brief.agenda.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      ) : null}
    </div>
  );
}
