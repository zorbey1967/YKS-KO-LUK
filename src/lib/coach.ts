import type { AppData, PlanBlock } from './types';
import { examCountdown, todaySchedule, weekMinutes, studyStreak } from './insights';
import { examKind, examTitle } from './stage';
import { curriculumForGrade } from './curriculum';
import { eliteReport } from './elite';
import { today } from './util';
import { weakBankTopics } from './practice';

export type CoachSnap = {
  kind: 'YKS' | 'KPSS' | 'Okul';
  exam: string;
  countdown: string;
  past: boolean;
  age: number;
  grade: string;
  track: string;
  dept: string;
  rank: number;
  weekHours: number;
  weekMins: number;
  todayStudy: number;
  open: number;
  openTitle: string;
  streak: number;
  weak: string[];
  lastExam?: string;
  lastNet?: string;
  todayBlocks: string;
  solved: number;
  acc: number;
  subjects: string[];
};

export function coachSnapshot(data: AppData): CoachSnap {
  const todayKey = today();
  const todayTasks = data.tasks.filter((x) => x.date === todayKey);
  const openTasks = todayTasks.filter((x) => !x.done);
  const topics = data.topics.slice().sort((a, b) => a.level - b.level);
  const exams = data.exams.slice().sort((a, b) => b.date.localeCompare(a.date));
  const stats = Object.values(data.questionStats);
  const solved = stats.reduce((a, s) => a + s.attempts, 0);
  const correct = stats.reduce((a, s) => a + s.correct, 0);
  const acc = solved ? Math.round((correct / solved) * 100) : 0;
  const study = data.sessions.filter((x) => x.date === todayKey).reduce((a, x) => a + x.minutes, 0);
  const count = examCountdown(data.examDate);
  const day = todaySchedule(data);
  const last = data.calcs[0];
  const kind = examKind(data);
  const curr = Object.keys(curriculumForGrade(data.grade));
  const fallback =
    kind === 'KPSS'
      ? ['GY Türkçe', 'GY Matematik', 'GK Tarih', 'Vatandaşlık']
      : kind === 'YKS'
        ? data.track === 'Sayısal'
          ? ['TYT Matematik', 'AYT Matematik', 'Fizik', 'Kimya']
          : data.track === 'Sözel'
            ? ['TYT Türkçe', 'AYT Edebiyat', 'Tarih', 'Coğrafya']
            : ['TYT Matematik', 'AYT Matematik', 'TYT Türkçe', 'AYT Edebiyat']
        : (curr.length ? curr : ['Türkçe', 'Matematik']);
  const weak = [
    ...topics.filter((t) => t.level < 70).map((t) => `${t.name} (%${t.level})`),
    ...weakBankTopics(data, 3).map((t) => `${t.topic} (banka %${t.acc})`),
  ];
  return {
    kind,
    exam: examTitle(data),
    countdown: count.label,
    past: count.past,
    age: data.age > 0 ? data.age : 0,
    grade: data.grade,
    track: data.track,
    dept: data.dept,
    rank: data.rank,
    weekHours: data.weekHours,
    weekMins: weekMinutes(data),
    todayStudy: study,
    open: openTasks.length,
    openTitle: openTasks[0]?.title || '',
    streak: studyStreak(data),
    weak: weak.slice(0, 5),
    lastExam: exams[0] ? `${exams[0].name} • TYT ${exams[0].tyt} / AYT ${exams[0].ayt}` : undefined,
    lastNet: last ? `${last.type} ${Number(last.net).toFixed(2)} net` : undefined,
    todayBlocks: day?.blocks.length ? day.blocks.map((b) => `${b.title} (${b.minutes} dk)`).join(' → ') : '',
    solved,
    acc,
    subjects: [...new Set([...topics.map((t) => t.subject || t.name), ...fallback])].filter(Boolean),
  };
}

export function coachContext(data: AppData) {
  const s = coachSnapshot(data);
  return [
    `Öğrenci: ${s.grade || 'belirtilmedi'}, ${s.age > 0 ? `${s.age} yaş` : 'yaş belirtilmedi'}, alan ${s.track || 'belirtilmedi'}, hedef ${s.dept || 'belirtilmedi'} (sıra ${s.rank > 0 ? s.rank : 'belirtilmedi'}).`,
    `Sınav: ${s.exam} • ${s.past ? `tarih geçti (${s.countdown})` : `${s.countdown} kaldı`} • ${data.examDate}.`,
    `Bugün ${s.todayStudy} dk, ${s.open} açık görev${s.openTitle ? ` (ilk: ${s.openTitle})` : ''}, seri ${s.streak} gün, hafta ${s.weekMins} dk / hedef ${s.weekHours}s.`,
    s.weak.length ? `Zayıf konular: ${s.weak.join(', ')}.` : 'Konu seviyesi kaydı az.',
    s.lastExam ? `Son deneme: ${s.lastExam}.` : '',
    s.lastNet ? `Son net: ${s.lastNet}.` : '',
    s.solved ? `Soru bankası: ${s.solved} soru, doğruluk %${s.acc}.` : 'Soru bankasında henüz deneme yok.',
    s.todayBlocks ? `Bugünün programı: ${s.todayBlocks}.` : 'Bugün için haftalık program bloğu yok.',
  ].filter(Boolean).join('\n');
}

function blockLen(age: number) {
  if (age > 0 && age <= 9) return 20;
  if (age > 0 && age <= 13) return 35;
  return 50;
}

export function iconForTopic(title: string) {
  const t = title.toLocaleLowerCase('tr-TR');
  if (t.includes('matematik') || t.includes('geometri') || t.includes('sayı')) return '➗';
  if (t.includes('fizik') || t.includes('kimya') || t.includes('biyoloji') || t.includes('fen')) return '🔬';
  if (t.includes('edebiyat') || t.includes('türk') || t.includes('paragraf')) return '📖';
  if (t.includes('tarih') || t.includes('coğraf') || t.includes('sosyal') || t.includes('vatandaş')) return '🌍';
  if (t.includes('deneme')) return '📝';
  if (t.includes('analiz') || t.includes('yanlış')) return '🔎';
  if (t.includes('okuma') || t.includes('hikâye')) return '📘';
  return '📚';
}

export function generatePlan(data: AppData, minutes: number, focus: string): PlanBlock[] {
  const s = coachSnapshot(data);
  const mins = Math.max(s.age > 0 && s.age <= 9 ? 40 : 60, minutes || 180);
  const unit = blockLen(s.age);
  const weakName = s.weak[0]?.replace(/\s*\(%\d+\)/, '') || s.subjects[0] || 'Eksik konu';
  const weak2 = s.weak[1]?.replace(/\s*\(%\d+\)/, '') || s.subjects[1] || 'Tekrar';
  let remain = mins;
  const out: PlanBlock[] = [];
  const add = (text: string, m: number, icon?: string) => {
    if (remain <= 0) return;
    const mm = Math.min(m, remain);
    out.push({ text, minutes: mm, icon: icon || iconForTopic(text) });
    remain -= mm;
  };

  if (focus === 'Programdan bugün') {
    const day = todaySchedule(data);
    if (day?.blocks.length) {
      day.blocks.forEach((b) => add(b.title, b.minutes, b.icon));
      return out;
    }
  }

  if (s.kind === 'Okul' && s.age > 0 && s.age <= 9) {
    add(`${weakName} (kısa, oyunlu)`, unit, '🎯');
    add('Okuma / hikâye', 15, '📖');
    add('Matematik pratik', unit, '➗');
    add('Serbest tekrar', 15, '📘');
  } else if (s.kind === 'Okul') {
    add(`${weakName} konu + soru`, unit + 10);
    add('Matematik / problem', unit);
    add('Okuma-anlama', Math.min(30, unit));
    add('Kısa yanlış kontrolü', 15, '🔎');
  } else if (s.kind === 'KPSS') {
    if (focus.includes('Deneme')) {
      add('KPSS GY deneme', 70, '📝');
      add('Yanlış analizi', 40, '🔎');
      add('GK tekrar', unit);
    } else {
      add('GY Türkçe / paragraf', unit + 10, '✍️');
      add('GY Matematik', unit + 10, '➗');
      add(weakName.includes('GK') ? weakName : 'GK Tarih-Coğrafya', unit, '📜');
      add('Vatandaşlık + güncel', 30, '🌍');
    }
  } else if (focus === 'Zor konu temposu' || focus === 'Üst düzey kamp') {
    add('Zamanlı Zor set (süre tut, atlama yok)', unit + 10, '⚡');
    add(data.track === 'Sayısal' ? 'AYT zayıf fen / türev-integral' : weakName, unit + 10);
    add('Yanlış etiketleme: bilgi / işlem / süre / dikkatsizlik', 30, '🔎');
    add('TYT paragraf hız (18 dk / 10 soru temposu)', 25, '✍️');
  } else if (focus === 'Zamanlı set') {
    add('40 soruluk zamanlı karışık (TYT+AYT)', 50, '⚡');
    add('Sadece işaretli yanlışların çözüm yazımı', 40, '🔎');
  } else if (focus === 'Deneme + analiz') {
    add('TYT/AYT denemesi', 90, '📝');
    add('Deneme yanlış analizi', 50, '🔎');
    add(weakName, unit);
  } else if (focus === 'AYT ağırlıklı') {
    add('AYT Matematik soru', unit + 20, '➗');
    add(data.track === 'Sayısal' ? 'AYT Fen (zayıf konu)' : weakName, unit);
    add('Yanlış soru analizi', 30, '🔎');
  } else if (focus === 'TYT ağırlıklı') {
    add('TYT Matematik', unit + 15, '➗');
    add('TYT Türkçe / paragraf', unit, '✍️');
    add('TYT sosyal veya fen', 35);
    add('Yanlış analizi', 25, '🔎');
  } else if (focus === 'KPSS GY-GK') {
    add('GY Türkçe', unit, '✍️');
    add('GY Matematik', unit, '➗');
    add('GK', unit, '📜');
  } else {
    add(weakName, unit + 5);
    add(weak2, unit);
    add(s.kind === 'YKS' ? 'TYT/AYT soru çözümü' : 'Soru çözümü', unit, '➗');
    add('Yanlış soru analizi', 25, '🔎');
  }
  if (remain > 0) add(s.age > 0 && s.age <= 9 ? 'Oyun / dinlenme + kısa tekrar' : 'Serbest tekrar / eksik kapatma', remain, '🎯');
  return out;
}

export function planToText(blocks: PlanBlock[]) {
  return blocks.map((b, i) => `${i + 1}. ${b.icon} ${b.text} — ${b.minutes} dk`).join('\n');
}

export function extractMinutes(q: string, fallback: number) {
  const saat = q.match(/(\d+)\s*saat/);
  if (saat) return Math.min(480, Number(saat[1]) * 60);
  const dk = q.match(/(\d+)\s*(dk|dakika)/);
  if (dk) return Math.min(480, Number(dk[1]));
  return fallback;
}

const SUBJECT_HINTS: [string, string][] = [
  ['matematik', 'Matematik'], ['geometri', 'Geometri'], ['fizik', 'Fizik'], ['kimya', 'Kimya'],
  ['biyoloji', 'Biyoloji'], ['türkçe', 'Türkçe'], ['edebiyat', 'Edebiyat'], ['tarih', 'Tarih'],
  ['coğrafya', 'Coğrafya'], ['felsefe', 'Felsefe'], ['paragraf', 'Paragraf'], ['vatandaşlık', 'Vatandaşlık'],
  ['fen', 'Fen'], ['sosyal', 'Sosyal'], ['ingilizce', 'İngilizce'],
];

export function extractSubject(q: string, data: AppData) {
  const t = q.toLocaleLowerCase('tr-TR');
  const hit = SUBJECT_HINTS.find(([k]) => t.includes(k));
  if (hit) return hit[1];
  return coachSnapshot(data).weak[0]?.replace(/\s*\(%\d+\)/, '') || '';
}

export function coachAdvice(data: AppData) {
  const s = coachSnapshot(data);
  const e = eliteReport(data);
  let msg = e.headline + ' — ' + (e.lines[0] || `${s.exam} için bugün ${blockLen(s.age)} dk net blok.`);
  if (s.open) msg = `Bugünün ${s.open} görevi kaldı. İlk: “${s.openTitle}”. Sonra ${e.dailyMin} dk / ~${e.dailyQ} soru.`;
  else if (s.solved && s.acc < 60) msg = `Doğruluk %${s.acc} (${e.phase}). Yanlış kuyruğu bitmeden yeni konu açma.`;
  else if (e.weakLesson) msg = `${e.phase}. En düşük net: ${e.weakLesson}. Zamanlı 20 soru + 15 dk analiz.`;
  else if (s.weak[0]) msg = `${e.phase}. Öncelik ${s.weak[0]}.`;
  else if (s.lastExam) msg = `${e.headline}. Son deneme ${s.lastExam} — yanlışları 4 etikete ayır.`;
  else if (!s.past) msg = `${s.exam}’ye ${s.countdown}. ${e.headline}.`;
  return { msg, open: s.open, study: s.todayStudy, weak: s.weak[0], solved: s.solved, acc: s.acc, phase: e.phase, headline: e.headline };
}

export function chatReply(q: string, data: AppData): { text: string; plan?: PlanBlock[] } {
  const s = coachSnapshot(data);
  const t = q.toLocaleLowerCase('tr-TR');
  const unit = blockLen(s.age);

  if (/\b(selam|merhaba|hey|sa\b)/.test(t)) {
    return { text: `Selam. ${s.grade || 'sınıf belirtilmedi'}, ${s.age > 0 ? `${s.age} yaş` : 'yaş belirtilmedi'}, hedef ${s.dept || 'belirtilmedi'}. ${s.exam}’ye ${s.past ? 'tarih geçmiş' : s.countdown}. Ne çalışmak istiyorsun?` };
  }
  if (t.includes('yoruld') || t.includes('motiv') || t.includes('çalışam') || t.includes('ertele')) {
    return { text: `${unit} dakikalık mini blok yeter: 2 dk hazırlık, ${unit - 7} dk tek konu, 5 dk kapanış. Telefonu başka odaya koy. Bitince 1 görevi işaretle — seri ${s.streak} gün.` };
  }
  if (t.includes('pomodoro') || t.includes('25')) {
    const plan = generatePlan(data, 25, 'Eksik konular').slice(0, 3).map((b, i) => ({
      ...b,
      minutes: i === 0 ? 15 : i === 1 ? 5 : 5,
    }));
    return { text: `25 dk: 5 dk tekrar + 15 dk soru + 5 dk yanlış.\n${planToText(plan)}`, plan };
  }
  if (t.includes('performans') || t.includes('nasılım') || t.includes('istatistik')) {
    return {
      text: [
        `Kayıt: ${s.solved} soru • doğruluk %${s.acc} • bugün ${s.todayStudy} dk • hafta ${s.weekMins} dk / ${s.weekHours}s • seri ${s.streak} gün • ${s.open} açık görev.`,
        s.lastNet ? `Son net: ${s.lastNet}.` : 'Henüz net hesabı yok — Net Hesapla’ya gir.',
        s.lastExam ? `Son deneme: ${s.lastExam}.` : '',
      ].filter(Boolean).join('\n'),
    };
  }
  if (t.includes('yanlış') || t.includes('hata')) {
    return {
      text: s.acc && s.acc < 80
        ? `Doğruluk %${s.acc}. Döngü: soruyu tekrar çöz → hata türünü yaz (bilgi / işlem / dikkatsizlik) → aynı konudan 3 benzer soru → ertesi gün 5 soruluk kontrol.`
        : 'Yanlış biriktikçe konu listesi çıkar. Soru bankasından işaretlediklerini bugün tekrar çöz.',
    };
  }
  if (t.includes('program') || t.includes('ders program')) {
    if (s.todayBlocks) return { text: `Bugün ${s.todayBlocks}` };
    return {
      text: data.schedule.days.length
        ? `Haftalık programın ${data.schedule.days.length} gün ama bugün için blok yok. Ders Programım’dan yeniden üret veya “bugün plan” yaz.`
        : 'Haftalık program yok. Ders Programım’dan PDF veya “AI program” ile üret.',
    };
  }
  if (t.includes('sınav') || t.includes('yks') || t.includes('kpss') || t.includes('kaç gün') || t.includes('hedef')) {
    return {
      text: `Hedef ${s.dept || 'belirtilmedi'} • sıra ${s.rank > 0 ? Number(s.rank).toLocaleString('tr-TR') : 'belirtilmedi'} • ${s.exam} ${s.past ? `geçti (${s.countdown})` : `${s.countdown} kaldı`} (${data.examDate || 'tarih belirtilmedi'}). Yaş ${s.age > 0 ? s.age : 'belirtilmedi'}, sınıf ${s.grade || 'belirtilmedi'}, alan ${s.track || 'belirtilmedi'}. Hedefim sayfasından değiştirebilirsin.`,
    };
  }
  if (t.includes('net') || t.includes('deneme')) {
    return {
      text: [
        s.lastNet ? `Son hesap: ${s.lastNet}.` : 'Net kaydı yok.',
        s.lastExam ? `Son deneme: ${s.lastExam}.` : 'Deneme kaydı yok — Denemeler sayfasına ekle.',
        s.kind === 'YKS' ? 'Yanlış/4 kuralı TYT-AYT için geçerli. Konu bazlı neti yükseltmek zayıf başlıklara 40 dk yeter.' : s.kind === 'KPSS' ? 'KPSS’te de 4 yanlış 1 doğruyu götürür. GY matematik + paragraf her gün.' : 'Okul sınavına konu tekrarı + 10 soru yeter.',
      ].join('\n'),
    };
  }
  if (t.includes('görev')) {
    return {
      text: s.open
        ? `${s.open} açık görev var. İlki: “${s.openTitle}”. Bitir, sonra ${unit} dk ${s.weak[0] || s.subjects[0]}.`
        : 'Bugün açık görev yok. Aşağıdaki planı görevlere aktarabilirsin.',
      plan: s.open ? undefined : generatePlan(data, unit * 3, 'Eksik konular'),
    };
  }

  const wantsPlan = /plan|çalış|program üret|ne yap|ne çalış|blok|saat|dk/.test(t);
  if (wantsPlan || t.includes('bugün')) {
    const minutes = extractMinutes(t, s.todayStudy ? Math.max(unit * 2, 120 - s.todayStudy) : unit * 4);
    const subject = extractSubject(q, data);
    let focus = 'Eksik konular';
    if (t.includes('üst') || t.includes('kamp') || t.includes('zor set') || t.includes('tempo')) focus = 'Zor konu temposu';
    else if (t.includes('zamanlı') || t.includes('süre tut')) focus = 'Zamanlı set';
    else if (t.includes('ayt')) focus = 'AYT ağırlıklı';
    else if (t.includes('tyt')) focus = 'TYT ağırlıklı';
    else if (t.includes('deneme')) focus = 'Deneme + analiz';
    else if (t.includes('kpss')) focus = 'KPSS GY-GK';
    const plan = generatePlan(data, minutes, focus);
    if (subject) {
      plan[0] = { text: `${subject} — aktif çalışma`, minutes: plan[0]?.minutes || unit, icon: iconForTopic(subject) };
    }
    const head = s.todayStudy
      ? `Bugün zaten ${s.todayStudy} dk var; buna ${minutes} dk daha ekleyelim.`
      : `${s.exam} • ${s.grade} • ${minutes} dk’lık kişisel blok:`;
    return { text: `${head}\n${planToText(plan)}\nİstersen “göreve aktar” de.`, plan };
  }

  return {
    text: `Verine göre: ${s.grade || 'sınıf belirtilmedi'} / ${s.age > 0 ? `${s.age} yaş` : 'yaş belirtilmedi'} / ${s.dept || 'hedef belirtilmedi'} / ${s.exam} ${s.countdown}. Örnek yaz: “bugün 2 saat matematik”, “performansım”, “yanlışlarımı nasıl azaltırım”.`,
  };
}

export const COACH_CHIPS: Record<CoachSnap['kind'], string[]> = {
  YKS: ['Zor konu temposu', 'Zamanlı 40 soru', 'Performansım', 'Yanlış analizi'],
  KPSS: ['Bugün GY-GK', '90 dk plan', 'Performansım', 'Deneme nasıl?'],
  Okul: ['Bugün ne çalışayım?', '40 dk plan', 'Ödev + tekrar', 'Performansım'],
};
