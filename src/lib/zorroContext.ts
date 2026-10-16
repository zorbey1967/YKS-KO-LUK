import type { AppData } from './types';
import { remainingClock } from './countdown';
import { primaryExam } from './examTargets';
import { coachSnapshot } from './coach';
import { todaySchedule, weekdayNameIstanbul } from './insights';
import { addCalendarDays } from './calendar';
import { istanbulToday } from './meeting';
import { detectSubject } from './aiTutor';
import { QUESTION_BANK_ENABLED } from './features';
import { lastBankTopic, weakBankTopics } from './practice';
import { type ZorroRoute } from './zorroIntent';
import { masteryLine, topicMastery } from './zorroMastery';
import { learningLines } from './zorroMemory';
import { studentStateLines } from './studentProgress';

const MISSING = 'Bu bilgi henüz hesabında bulunmuyor.';

export function selectZorroContext(data: AppData, q: string, route: ZorroRoute): string {
  const s = coachSnapshot(data);
  const subject = detectSubject(q);
  const primary = primaryExam(data.examTargets || []);
  const clock = primary ? remainingClock(primary.date, primary.startTime) : remainingClock(data.examDate);
  const today = istanbulToday();
  const day = todaySchedule(data);
  const tomorrow = data.schedule.days.find((d) => d.day === weekdayNameIstanbul(addCalendarDays(today, 1)));
  const rules = [
    'Kayıtta olmayan net, hedef, süre, deneme, görev, koç, randevu, başarı oranı uydurma.',
    `Yoksa tam cümle: “${MISSING}” veya deneme için: “Henüz kayıtlı bir deneme sonucunu göremiyorum.”`,
    'Kesin sıralama/kazanma sözü yok.',
    'Programı sessizce değiştirme; onay iste.',
    'Jenerik “nasıl yardımcı olabilirim” tekrarı yok; son soruya gir.',
    'Yanlışta küçümseme yok. Hata türü: işlem / kavram / formül / paragraf yorumu / bilgi eksikliği / zaman baskısı — yalnızca metin destekliyorsa.',
  ];

  if (route === 'simple_chat') {
    return [...rules, 'Kısa selam. Dosyanın tamamı ekli değil.'].join('\n');
  }

  const lines = [...rules, ...studentStateLines(data)];

  if (route === 'tutor' || route === 'question_solving' || route === 'review' || route === 'quiz' || route === 'photo') {
    lines.push(`Sınıf: ${s.grade || MISSING}. Alan: ${s.track || MISSING}.`);
    if (subject) lines.push(`Ders ipucu: ${subject}.`);
    const master = topicMastery(data, subject || q).slice(0, 3);
    if (master.length) lines.push(master.map(masteryLine).join(' | '));
    else lines.push('Bu konu için kayıtlı çalışma veya deneme yok.');
    const mem = learningLines(data, subject || q, 3);
    if (mem.length) lines.push(`Öğrenme notu (kalıcı, öğrencinin belirttiği): ${mem.join(' | ')}`);
    const weak = QUESTION_BANK_ENABLED ? weakBankTopics(data, 2) : [];
    if (weak.length) lines.push(`Kayıtlı zayıf: ${weak.map((w) => `${w.topic} %${w.acc} (${w.answered} soru)`).join(', ')}.`);
    return lines.join('\n');
  }

  if (route === 'exam' || route === 'goal') {
    lines.push(`Hedef bölüm: ${s.dept || MISSING}. Sıra: ${s.rank > 0 ? s.rank : MISSING}.`);
    lines.push(`Haftalık hedef saat: ${s.weekHours > 0 ? s.weekHours : MISSING}.`);
    lines.push(
      primary
        ? `Ana sınav: ${primary.title} ${primary.date} — hesaplanmış ${clock.headline} (${clock.days} gün).`
        : (data.examDate ? `Hedef tarihi ${data.examDate}. ${clock.headline}.` : `Sınav tarihi: ${MISSING}`),
    );
    return lines.join('\n');
  }

  if (route === 'plan' || route === 'planner' || route === 'task') {
    lines.push(day?.blocks.length
      ? `Bugün program: ${day.blocks.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}.`
      : `Bugün program: ${MISSING}`);
    lines.push(tomorrow?.blocks.length
      ? `Yarın program: ${tomorrow.blocks.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}.`
      : `Yarın program: ${MISSING}`);
    const open = data.tasks.filter((t) => !t.done);
    lines.push(open.length
      ? `Açık görev: ${open.slice(0, 5).map((t) => `${t.title} (${t.origin === 'zorro' ? 'Zorro' : t.origin === 'coach' ? 'Koç' : 'Öğrenci'} • ${t.date})`).join('; ')}.`
      : `Açık görev: ${MISSING}`);
    if (s.todayStudy > 0) lines.push(`Bugün kayıtlı çalışma: ${s.todayStudy} dk.`);
    const weak = QUESTION_BANK_ENABLED ? weakBankTopics(data, 3) : [];
    if (weak.length) lines.push(`Kayıtlı zayıf konular: ${weak.map((w) => w.topic).join(', ')}.`);
    if (primary) lines.push(`Ana sınav ${primary.title} ${clock.days} gün (hesaplanmış).`);
    lines.push('Çakışan randevu saati uydurma; randevu listesi bu istekte yoksa yok de.');
    return lines.join('\n');
  }

  if (route === 'exam_analysis' || route === 'performance') {
    const exams = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (exams[0]) {
      lines.push(`Son deneme: ${exams[0].name} ${exams[0].date} TYT ${exams[0].tyt} AYT ${exams[0].ayt}.`);
      if (exams[1]) lines.push(`Önceki: ${exams[1].name} TYT ${exams[1].tyt} AYT ${exams[1].ayt}. Değişim TYT ${exams[0].tyt - exams[1].tyt}.`);
    } else lines.push(`Deneme: ${MISSING}`);
    lines.push(s.lastNet ? `Son net hesabı: ${s.lastNet}.` : `Net: ${MISSING}`);
    const last = lastBankTopic(data);
    lines.push(last ? `Son banka: ${last.topic} ${last.correct}/${last.answered}.` : `Soru bankası sonucu: ${MISSING}`);
    const master = topicMastery(data, subject).slice(0, 5);
    if (master.length) lines.push(master.map(masteryLine).join('\n'));
    return lines.join('\n');
  }

  if (route === 'coach_context') {
    lines.push('Koç adı ve randevu bu bağlamda yoksa yok de. Başka öğrencinin verisini isteme.');
    return lines.join('\n');
  }

  return lines.join('\n');
}
