import type { AppData } from './types';
import { lastBankTopic, weakBankTopics } from './practice';
import { todaySchedule } from './insights';
import { today } from './util';
import type { ZorroRoute } from './zorroIntent';

export type ZorroUiAction = {
  id: string;
  label: string;
  kind: 'send' | 'goto' | 'task';
  prompt?: string;
  page?: 'questionbank' | 'tasks' | 'schedule' | 'exams' | 'goal' | 'timer';
};

export function zorroHomeHint(data: AppData): string | null {
  const weak = weakBankTopics(data, 1)[0];
  const exams = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));
  const td = today();
  const open = data.tasks.find((t) => t.date === td && !t.done);
  if (weak && exams[0]) {
    return `Son deneme “${exams[0].name}” kayıtlı. Soru bankasında ${weak.topic} %${weak.acc} (${weak.answered} soru). Bugün kısa tekrar öneriyorum; sayı uydurmuyorum.`;
  }
  if (weak) {
    return `${weak.subject} / ${weak.topic}: kayıtlı ${weak.wrong} yanlış, %${weak.acc}. Mini çalışma mantıklı.`;
  }
  if (open) return `Bugün açık görev: “${open.title}”.`;
  const day = todaySchedule(data);
  if (day?.blocks[0]) return `Bugünkü programın ilk bloğu: ${day.blocks[0].title} (${day.blocks[0].minutes} dk).`;
  return null;
}

export function zorroActions(data: AppData, route: ZorroRoute): ZorroUiAction[] {
  const out: ZorroUiAction[] = [];
  const weak = weakBankTopics(data, 1)[0];
  const last = lastBankTopic(data);
  const jump = weak || last;

  if (route === 'plan' || route === 'planner') {
    out.push({ id: 'plan40', label: '40 dk plan', kind: 'send', prompt: 'Mod: Planım. Kayıtlı programa ve açık görevlere bakarak yaklaşık 40 dakikalık öneri yaz. Programı sessizce değiştirme; onay iste.' });
    if (jump) out.push({ id: 'bank', label: '20 soru çöz', kind: 'goto', page: 'questionbank' });
    out.push({ id: 'taskpage', label: 'Görevler', kind: 'goto', page: 'tasks' });
  }
  if (route === 'exam_analysis' || route === 'performance') {
    out.push({ id: 'exams', label: 'Denemeler', kind: 'goto', page: 'exams' });
    if (jump) out.push({ id: 'weak', label: 'Zayıf konuya git', kind: 'goto', page: 'questionbank' });
  }
  if (route === 'quiz' || route === 'review' || route === 'tutor') {
    if (jump) out.push({ id: 'bank', label: 'Soru bankası', kind: 'goto', page: 'questionbank' });
  }
  if (route === 'task') {
    out.push({ id: 'tasks', label: 'Görevlerim', kind: 'goto', page: 'tasks' });
  }
  if (route === 'goal') {
    out.push({ id: 'goal', label: 'Hedefim', kind: 'goto', page: 'goal' });
  }
  if (data.schedule.days.length && (route === 'plan' || route === 'simple_chat')) {
    out.push({ id: 'sch', label: 'Ders programı', kind: 'goto', page: 'schedule' });
  }
  return out.slice(0, 4);
}

export function workingModeChips(data: AppData, loggedIn: boolean, advanced = true): { label: string; prompt: string; display: string }[] {
  const weak = weakBankTopics(data, 1)[0];
  const hasExam = loggedIn && Boolean(data.exams[0] || data.calcs[0]);
  const hasGoal = loggedIn && Boolean(data.dept || data.rank > 0 || data.examDate);
  const hasPlan = loggedIn && (data.schedule.days.length > 0 || data.tasks.some((t) => !t.done));
  const chips = [
    { label: 'Öğren', display: 'Öğren', prompt: 'Mod: Öğren. Seviyeme göre kısa anlat; sonra bir kontrol sorusu sor. Direkt cevabı dayatma.' },
    { label: 'Soru Çöz', display: 'Soru Çöz', prompt: 'Mod: Soru çöz. Soru yoksa benden iste. Direkt çözüm demedikçe önce ipucu ver.' },
    { label: 'Hızlı Tekrar', display: 'Hızlı Tekrar', prompt: weak ? `Mod: Tekrar. Öncelik ${weak.topic} (kayıtlı %${weak.acc}).` : 'Mod: Tekrar. Kayıtlı zayıf konu yoksa benden konu iste; uydurma.' },
    { label: 'Quiz', display: 'Quiz', prompt: 'Mini test: soru bankasında madde varsa onu sor, cevabı hemen söyleme. Banka maddesini AI sorusu diye sunma.' },
  ];
  if (advanced) {
    chips.push(
      { label: 'Bugün ne çalışayım?', display: 'Bugün ne çalışayım?', prompt: 'Mod: Planım. Hedef, kalan süre, program, görev ve zayıf konuya bak. Yoksa yok de. Programı sessizce değiştirme.' },
      { label: '40 dk plan', display: '40 dk plan', prompt: 'Kayıtlı veriye göre yaklaşık 40 dakikalık blok öner. Onaysız programı değiştirme.' },
    );
  }
  chips.push({ label: 'Fotoğraftan Soru', display: 'Fotoğraftan Soru', prompt: 'Soru fotoğrafı göndereceğim. Okuyabilirsen önce ipucu; direkt çözüm istersem tam çözüm.' });
  if (hasExam && advanced) {
    chips.splice(4, 0, {
      label: 'Deneme Analizi',
      display: 'Deneme Analizi',
      prompt: 'Mod: Deneme analizi. Yalnızca kayıtlı deneme ve net. Konu bazlı yanlış yoksa uydurma.',
    });
  }
  if (hasExam) {
    chips.push({
      label: 'Performansım',
      display: 'Performansım',
      prompt: 'Kayıtlı soru bankası, deneme ve net özetle. Yeterli deneme yoksa “yeterli veri yok” de.',
    });
  }
  if (hasPlan) {
    chips.push({ label: 'Planım', display: 'Planım', prompt: 'Mod: Planım. Bugün ve yarın kayıtlı bloklar + açık görevler.' });
    chips.push({ label: 'Görevlerim', display: 'Görevlerim', prompt: 'Açık görevlerimi listele. Tamamlandı varsayma.' });
  }
  if (hasGoal) {
    chips.push({ label: 'Hedefim', display: 'Hedefim', prompt: 'Kayıtlı hedef bölüm, sıra ve sınav tarihine göre konuş. Garanti verme.' });
  }
  if (weak) {
    chips.push({
      label: 'Eksiklerim',
      display: 'Eksiklerim',
      prompt: `Kayıtlı zayıf: ${weak.topic} %${weak.acc}. Başka konu uydurma.`,
    });
    chips.push({
      label: 'Yanlışlarım',
      display: 'Yanlışlarım',
      prompt: `Kayıtlı yanlışlar: ${weak.topic} ${weak.wrong} yanlış. Hata türü uydurma; yalnızca kayıt ve mesajıma bak.`,
    });
  }
  return chips;
}
