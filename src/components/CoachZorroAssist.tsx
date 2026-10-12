import { useState } from 'react';
import { askZorroPlain } from '../lib/coachAi';
import type { LinkedStudentRow } from '../lib/cloudPlatform';
import type { CoachHomework } from '../lib/coaches';
import { formatCoachHtml } from '../lib/aiTutor';

/** Koç yalnızca bağlı öğrenci özetini gönderir; başka öğrencinin student_data’sı çekilmez. */
export function CoachZorroAssist({
  students,
  homeworks,
}: {
  students: LinkedStudentRow[];
  homeworks: CoachHomework[];
}) {
  const [sid, setSid] = useState('');
  const [q, setQ] = useState('Bu öğrencinin kayıtlı özetine göre bir sonraki derste neye odaklanmalıyım?');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  const student = students.find((s) => s.id === sid) || students[0];

  async function run() {
    if (!student) return;
    setBusy(true);
    setReply('');
    const hw = homeworks.filter((h) => h.studentId === student.id);
    const ctx = [
      'Koç asistanı: yalnızca aşağıdaki kayıtlı satırlar. Uydurma net/deneme yok.',
      `Öğrenci adı: ${student.name}.`,
      `Sınıf: ${student.grade || 'Bu bilgi henüz hesabında bulunmuyor.'}.`,
      `Hedef: ${student.dept || 'Bu bilgi henüz hesabında bulunmuyor.'}.`,
      `Sınav tarihi: ${student.examDate || 'Bu bilgi henüz hesabında bulunmuyor.'}.`,
      `Haftalık saat: ${student.weekHours > 0 ? student.weekHours : 'Bu bilgi henüz hesabında bulunmuyor.'}.`,
      `Açık görev (öğrenci kaydı): ${student.openTasks}.`,
      hw.length
        ? `Koç ödevi: ${hw.map((h) => `${h.title}${h.done ? ' (tamam)' : ''}`).join('; ')}.`
        : 'Koç ödevi kaydı yok.',
    ].join('\n');
    const ans = await askZorroPlain(q, ctx);
    setReply(ans.text);
    setBusy(false);
  }

  if (!students.length) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>ZORRO — Koç Asistanı</h3></div>
        <p className="muted">Bağlı öğrenci özeti yok (014 veya randevu). Başka öğrencinin verisi istenmez.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title"><h3>ZORRO — Koç Asistanı</h3></div>
      <p className="muted">Yalnızca randevu/eşleşmeli öğrencinin özet alanları. Sohbet geçmişi açılmaz.</p>
      {student ? (
        <div className="plan-item">
          <span>
            <b>Zorro öğrenme özeti</b>
            <br />
            <small className="muted">
              Sınıf: {student.grade || 'kayıt yok'}
              {' • '}Hedef: {student.dept || 'kayıt yok'}
              {' • '}Sınav: {student.examDate || 'kayıt yok'}
              {' • '}Açık görev: {student.openTasks}
              {' • '}Ödev: {homeworks.filter((h) => h.studentId === student.id && !h.done).length}
            </small>
          </span>
        </div>
      ) : null}
      <div className="form-grid">
        <div className="field">
          <label>Öğrenci</label>
          <select value={student.id} onChange={(e) => setSid(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Soru</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void run()}>{busy ? 'Zorro…' : 'Özetle'}</button>
      </div>
      {reply ? <div className="chat-msg chat-bot" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: formatCoachHtml(reply) }} /> : null}
    </div>
  );
}
