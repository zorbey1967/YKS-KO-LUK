import type { AppData } from './types';
import { remainingClock } from './countdown';
import { primaryExam } from './examTargets';
import { coachSnapshot } from './coach';
import { todaySchedule, weekdayNameIstanbul } from './insights';
import { addCalendarDays } from './calendar';
import { istanbulToday } from './meeting';
import { formatZoroHtml } from './zoroText';
import { QUESTION_BANK_ENABLED } from './features';

export type TutorIntent = 'teach' | 'solve' | 'review' | 'quiz' | 'exam' | 'schedule' | 'goal' | 'analysis' | 'chat';
export type TutorBadge = 'Ders Anlatımı' | 'Soru Çözümü' | 'Konu Tekrarı' | 'Mini Test' | 'Planlama' | 'Sınav' | 'Hedef' | 'Deneme Analizi' | 'Sohbet';

const SUBJECTS: [RegExp, string][] = [
  [/türe[v]|integral|limit|fonksiyon|denklem|geometri|matematik|üçgen|türev/i, 'Matematik'],
  [/fizik|kuvvet|hareket|elektrik|optik|basınç|enerji/i, 'Fizik'],
  [/kimya|mol|asit|baz|organik|periyodik/i, 'Kimya'],
  [/biyoloji|hücre|dna|fotosentez|ekoloji/i, 'Biyoloji'],
  [/edebiyat|servet.?i.?fünun|divan|şiir|roman/i, 'Edebiyat'],
  [/türkçe|paragraf|dil bilgisi|anlatım/i, 'Türkçe'],
  [/tarih|osmanlı|inkılap|kurtuluş/i, 'Tarih'],
  [/coğrafya|iklim|harita|nüfus/i, 'Coğrafya'],
  [/felsefe|mantık|sosyoloji|psikoloji/i, 'Felsefe'],
  [/din.?kültür|peygamber|ibadet/i, 'Din Kültürü'],
  [/ingilizce|grammar|vocabulary/i, 'İngilizce'],
  [/vatandaşlık|anayasa|kpss\s*gk/i, 'Vatandaşlık'],
  [/fen\s*bil/i, 'Fen'],
];

export function detectSubject(q: string) {
  const t = q.toLocaleLowerCase('tr-TR');
  for (const [re, name] of SUBJECTS) {
    if (re.test(t)) return name;
  }
  return '';
}

export function detectExamBand(q: string, data: AppData) {
  const t = q.toLocaleLowerCase('tr-TR');
  if (/\blgs\b/.test(t)) return 'LGS';
  if (/\bkpss\b/.test(t)) return 'KPSS';
  if (/\bayt\b/.test(t)) return 'AYT';
  if (/\btyt\b/.test(t)) return 'TYT';
  if (/\byks\b/.test(t)) return 'YKS';
  const g = data.grade.toLocaleLowerCase('tr-TR');
  if (g.includes('kpss')) return 'KPSS';
  if (g.includes('8.') || g.includes('lgs')) return 'LGS';
  if (data.track === 'KPSS') return 'KPSS';
  if (data.grade.includes('12') || g.includes('yks') || g.includes('mezun')) return data.track === 'Sayısal' ? 'AYT/TYT' : 'YKS';
  return data.grade || 'belirtilmedi';
}

export function detectTutorIntent(q: string): TutorIntent {
  const t = q.toLocaleLowerCase('tr-TR');
  if (/mod:\s*öğren|ders anlat/.test(t)) return 'teach';
  if (/mod:\s*soru/.test(t)) return 'solve';
  if (/mod:\s*tekrar|konu tekrar/.test(t)) return 'review';
  if (/mod:\s*plan|mod:\s*programım/.test(t)) return 'schedule';
  if (/mod:\s*deneme/.test(t)) return 'analysis';
  if (/örnek ver|daha anlat|detaylı anlat|kısaca anlat/.test(t)) return 'teach';
  if (/(bana .*(soru) ver|bir tane .*soru|zor .*soru ver|kolay .*soru ver)/.test(t)) return 'quiz';
  if (/(sadece cevap|cevap kaç|cevabı söyle)/.test(t)) return 'solve';
  if (/(anlat|öğret|nedir|ne demek|konuyu)\b/.test(t) && !/kaç gün|sınava|program yap|plan yap/.test(t)) return 'teach';
  if (/(soru çöz|bu soruyu|adım adım çöz|cevabı söyle|şıkk[ıi]|ikinci adım|anlamadım)/.test(t) || /=\s*\d/.test(t)) return 'solve';
  if (/mini test/.test(t)) return 'quiz';
  if (/kaç gün kald|sınava kaç|sınavına kaç|yarın .*sınav|bugün .*sınav/.test(t)) return 'exam';
  if (/program yap|plan yap|çalışma planı|ne çalışmalıyım|bugün ne çalış|yarın.*çalış|ders program|programımda/.test(t)) return 'schedule';
  if (/deneme analiz|son netim|kayıtlı net|denemem|netti|net yaptım|saat .*çalıştım/.test(t)) return 'analysis';
  if (/hedefim ne|hedef sıra/.test(t)) return 'goal';
  return 'chat';
}

function lengthHint(q: string) {
  const t = q.toLocaleLowerCase('tr-TR');
  if (/sadece cevap|cevabı söyle|kısaca/.test(t)) return 'çok kısa';
  if (/adım adım|detaylı anlat/.test(t)) return 'uzun/detaylı';
  if (/nedir|ne demek/.test(t) && t.length < 80) return 'kısa (4–8 cümle)';
  return 'orta';
}

export function tutorBadge(intent: TutorIntent): TutorBadge {
  if (intent === 'teach') return 'Ders Anlatımı';
  if (intent === 'solve') return 'Soru Çözümü';
  if (intent === 'review') return 'Konu Tekrarı';
  if (intent === 'quiz') return 'Mini Test';
  if (intent === 'exam') return 'Sınav';
  if (intent === 'goal') return 'Hedef';
  if (intent === 'analysis') return 'Deneme Analizi';
  if (intent === 'schedule') return 'Planlama';
  return 'Sohbet';
}

export function tutorContext(data: AppData, q: string, intent: TutorIntent) {
  const s = coachSnapshot(data);
  const subject = detectSubject(q);
  const band = detectExamBand(q, data);
  const primary = primaryExam(data.examTargets || []);
  const clock = primary ? remainingClock(primary.date, primary.startTime) : remainingClock(data.examDate);
  const today = istanbulToday();
  const day = todaySchedule(data);
  const tomorrowName = weekdayNameIstanbul(addCalendarDays(today, 1));
  const tomorrow = data.schedule.days.find((d) => d.day === tomorrowName);
  const lines: string[] = [
    'Disiplin: Yalnızca kullanıcının son mesajındaki soruyu cevapla. İstemeden program, sınav countdown, hedef, koçluk, motivasyon, özellik tanıtımı YASAK.',
    'Kayıtta olmayan çalışma saati, net, deneme, randevu, hedef, başarı oranı uydurma. Yoksa tam bu cümleyi kullan: “Bu bilgi henüz hesabında bulunmuyor.”',
    `Cevap uzunluğu: ${lengthHint(q)}.`,
  ];
  if (intent === 'teach' || intent === 'solve' || intent === 'review') {
    lines.push(`Seviye bandı: ${band}. Sınıf kaydı: ${s.grade || 'belirtilmedi'}.`);
    if (s.track) lines.push(`Alan: ${s.track}.`);
    if (subject) lines.push(`Ders: ${subject}.`);
    if (s.dept) lines.push(`Hedef bölüm kaydı: ${s.dept}.`);
    if (s.weak?.length) lines.push(`Kayıtlı zayıf konular: ${s.weak.slice(0, 5).join(', ')}.`);
    if (s.openTitle) lines.push(`Açık görev başlığı: ${s.openTitle}.`);
    lines.push('Bu maddeler kayıtta varsa kullan. Kayıtsız net/deneme/saat uydurma. İstemeden sınav tarihi veya program dayatma.');
    return lines.join('\n');
  }
  if (intent === 'quiz') {
    lines.push(`Seviye: ${band}. ${subject ? `Ders ${subject}.` : ''}`);
    lines.push(QUESTION_BANK_ENABLED ? 'Soru bankası maddesi varsa onu kullan; yoksa uydurma ID verme, “bankada yok” de.' : 'Düzeye uygun kısa soru sor; cevabı hemen verme.');
    return lines.join('\n');
  }
  if (intent === 'exam') {
    lines.push(
      primary
        ? `Ana sınav: ${primary.title} (${primary.kind}) tarih ${primary.date}. Hesaplanmış kalan gün: ${clock.days} (${clock.headline}). Gün sayısını yeniden uydurma.`
        : (data.examDate ? `Hedef tarihi ${data.examDate}. Hesaplanmış: ${clock.headline} (${clock.days} gün).` : 'Sınav tarihi: Bu bilgi henüz hesabında bulunmuyor.'),
    );
    if (data.examTargets?.length) lines.push(`Kayıtlı sınavlar: ${data.examTargets.map((t) => `${t.title} ${t.date}`).join('; ')}.`);
    return lines.join('\n');
  }
  if (intent === 'schedule') {
    lines.push(day?.blocks.length ? `Bugün (${today}) program: ${day.blocks.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}.` : 'Ders programı: Bu bilgi henüz hesabında bulunmuyor.');
    lines.push(tomorrow?.blocks.length ? `Yarın program: ${tomorrow.blocks.map((b) => `${b.title} ${b.minutes} dk`).join(', ')}.` : 'Yarın programı: Bu bilgi henüz hesabında bulunmuyor.');
    lines.push(`Açık görev: ${s.open}${s.openTitle ? ` (${s.openTitle})` : 'yok'}. Bugün çalışma kaydı ${s.todayStudy > 0 ? `${s.todayStudy} dk` : 'Bu bilgi henüz hesabında bulunmuyor.'}.`);
    if (primary) lines.push(`Ana sınav ${primary.title} ${primary.date} — ${clock.days} gün (hesaplanmış).`);
    lines.push('Programı sessizce değiştirme.');
    return lines.join('\n');
  }
  if (intent === 'analysis') {
    lines.push(s.lastExam ? `Kayıtlı deneme: ${s.lastExam}.` : 'Deneme: Bu bilgi henüz hesabında bulunmuyor.');
    lines.push(s.lastNet ? `Kayıtlı net: ${s.lastNet}.` : 'Net: Bu bilgi henüz hesabında bulunmuyor.');
    if (QUESTION_BANK_ENABLED) lines.push(s.solved ? `Soru bankası: ${s.solved} soru, kayıtlı doğruluk %${s.acc}.` : 'Soru bankası sonucu: Bu bilgi henüz hesabında bulunmuyor.');
    return lines.join('\n');
  }
  if (intent === 'goal') {
    lines.push(`Hedef bölüm: ${s.dept || 'Bu bilgi henüz hesabında bulunmuyor.'}; sıra ${s.rank > 0 ? s.rank : 'Bu bilgi henüz hesabında bulunmuyor.'}.`);
    lines.push(`Sınıf: ${s.grade || 'Bu bilgi henüz hesabında bulunmuyor.'}. Haftalık hedef: ${s.weekHours > 0 ? `${s.weekHours} saat` : 'Bu bilgi henüz hesabında bulunmuyor.'}.`);
    return lines.join('\n');
  }
  lines.push('Kısa cevap. Dosyanın tamamı ekli değil.');
  return lines.join('\n');
}

export function tutorUserPrompt(q: string, intent: TutorIntent) {
  const extra = {
    teach: 'Sadece sorulan konuyu anlat. JSON yazma. Formül: f(x)=x², f′(x)=2x. Program/sınav ekleme. Anlatınca bir kontrol sorusu sor.',
    solve: 'Direkt çözüm istenmediyse önce ipucu. "cevap kaç" / "direkt çöz" ise kısa tam çözüm. Emin değilsen uydurma.',
    review: 'Kısa tekrar, 5 madde.',
    quiz: QUESTION_BANK_ENABLED ? 'Gerçek soru bankası maddesi context’te varsa onu sor. Uydurma banka ID yok.' : 'Düzeyime uygun kısa bir soru sor; cevabı ben yazınca kontrol et.',
    exam: 'Yalnızca hesaplanmış kalan günü kullan. Yeni tarih üretme.',
    schedule: 'Kayıtlı bugün/yarın bloklarına bak. Yoksa yok de. “Hazırlanıyorum” tek başına plan üretmez.',
    goal: 'Yalnızca kayıtlı hedef.',
    analysis: 'Yalnızca kayıtlı deneme/net. Öğrencinin söylediği kayıtsız neti gerçek sayma.',
    chat: 'Kısa cevap. İstenmeyen konuya sapma.',
  }[intent];
  return extra ? `${extra}\n\nÖğrenci: ${q}` : q;
}

export function formatCoachHtml(text: string) {
  return formatZoroHtml(text);
}
