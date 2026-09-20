import type { AppData, Schedule, ScheduleDay } from './types';
import { examKind, typicalAge } from './stage';
import { curriculumForGrade } from './curriculum';

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

function subjectPool(data: AppData) {
  const weak = data.topics
    .slice()
    .sort((a, b) => (a.level || 0) - (b.level || 0))
    .map((x) => x.name)
    .filter(Boolean);
  const kind = examKind(data);
  const curr = Object.keys(curriculumForGrade(data.grade)).slice(0, 6);
  const fallback =
    kind === 'KPSS'
      ? ['GY Türkçe', 'GY Matematik', 'GK Tarih', 'Vatandaşlık']
      : kind === 'YKS'
        ? (data.track === 'Sayısal'
          ? ['TYT Matematik', 'AYT Matematik', 'Fizik', 'Kimya']
          : data.track === 'Sözel'
            ? ['TYT Türkçe', 'AYT Edebiyat', 'Tarih', 'Coğrafya']
            : ['TYT Matematik', 'AYT Matematik', 'AYT Edebiyat', 'TYT Türkçe'])
        : (curr.length ? curr : ['Türkçe', 'Matematik', 'Fen', 'Sosyal']);
  return [...new Set([...weak, ...fallback])];
}

export function generateWeeklySchedule(
  data: AppData,
  daily: number,
  dayCount: number,
  focus: string,
  source: string,
  notes: string,
): Schedule {
  const age = data.age || typicalAge(data.grade);
  const kind = examKind(data);
  const mins = Math.max(30, daily || (age <= 9 ? 60 : age <= 13 ? 120 : 240));
  const count = Math.max(age <= 9 ? 5 : 5, Math.min(7, dayCount || (age <= 13 ? 5 : 6)));
  const pool = subjectPool(data);
  const days: ScheduleDay[] = [];
  for (let i = 0; i < count; i++) {
    let remain = mins;
    const blocks: ScheduleDay['blocks'] = [];
    const add = (title: string, min: number, icon: string) => {
      if (remain <= 0) return;
      const m = Math.min(min, remain);
      blocks.push({ title, minutes: m, icon });
      remain -= m;
    };
    const subject = pool[i % pool.length] || 'Eksik konu tekrarı';
    if (kind === 'KPSS') {
      add('GY Türkçe / paragraf', 50, '✍️');
      add('GY Matematik', 50, '➗');
      add(i % 2 ? 'GK Tarih-Coğrafya' : 'Vatandaşlık + güncel', 45, '📜');
      if (focus === 'Deneme + analiz') add('KPSS deneme + analiz', 70, '📝');
      else add(subject, 40, '📚');
    } else if (kind === 'Okul' && age <= 9) {
      add(`${subject} (kısa blok)`, 20, '📘');
      add('Okuma / hikâye', 15, '📖');
      add('Oyunla tekrar', 15, '🎯');
      add('Ödev yardımı', 20, '✏️');
    } else if (kind === 'Okul' && age <= 13) {
      add(subject, 40, '📚');
      add('Matematik soru', 35, '➗');
      add('Okuma-anlama', 25, '✍️');
      add('Kısa tekrar', 20, '🔎');
    } else if (kind === 'Okul') {
      add(subject, 50, '📚');
      add('Soru çözümü', 40, '📝');
      add('Konu tekrarı', 30, '🔎');
    } else if (focus === 'AYT ağırlıklı' && kind === 'YKS') {
      add('AYT Matematik / hedef konu', 70, '➗');
      add(subject, 55, '📚');
      add('Yanlış soru analizi', 35, '🔎');
    } else if (focus === 'TYT ağırlıklı') {
      add('TYT Matematik', 60, '➗');
      add('TYT Türkçe / Paragraf', 45, '✍️');
      add(subject, 40, '📚');
    } else if (focus === 'Zayıf konular') {
      add(subject, 70, '⚠️');
      add('Zayıf konu soru çözümü', 55, '📝');
      add('Yanlış analizi', 35, '🔎');
    } else if (focus === 'Deneme + analiz') {
      add(i % 2 === 0 ? 'TYT Genel Deneme' : 'AYT Deneme', 90, '📝');
      add('Deneme yanlış analizi', 55, '🔎');
      add(subject, 35, '📚');
    } else {
      add(subject, 60, '📚');
      add(i % 2 ? 'TYT Matematik' : 'AYT Matematik', 55, '➗');
      add('Edebiyat / Türkçe tekrar', 40, '📖');
      add('Yanlış soru analizi', 30, '🔎');
    }
    if (remain > 0) add('Serbest tekrar / eksik kapatma', remain, '🎯');
    days.push({ day: WEEKDAYS[i], blocks });
  }
  return { days, source, pdfName: data.schedule?.pdfName || '', pdfSize: data.schedule?.pdfSize || 0, notes, updatedAt: new Date().toISOString() };
}

const SCHOOL_SUBJECTS = [
  'Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Edebiyat', 'Türkçe', 'Türk Dili',
  'Tarih', 'Coğrafya', 'Felsefe', 'Din', 'İngilizce', 'Almanca', 'Beden', 'Müzik', 'Görsel',
  'Rehberlik', 'Seçmeli',
];

function iconFor(title: string) {
  const t = title.toLocaleLowerCase('tr-TR');
  if (t.includes('matematik') || t.includes('geometri')) return '➗';
  if (t.includes('fizik') || t.includes('kimya') || t.includes('biyoloji')) return '🔬';
  if (t.includes('edebiyat') || t.includes('türk')) return '📖';
  if (t.includes('tarih') || t.includes('coğraf')) return '🌍';
  if (t.includes('deneme')) return '📝';
  if (t.includes('okul') || t.includes('ders')) return '🏫';
  return '📚';
}

function minutesFromRange(a: string, b: string) {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(b) - toMin(a);
  return diff > 0 && diff <= 180 ? diff : 40;
}

export function parseSchoolPdfText(text: string): ScheduleDay[] {
  const src = ` ${text} `;
  const days: ScheduleDay[] = [];
  WEEKDAYS.forEach((day, idx) => {
    const start = src.toLocaleLowerCase('tr-TR').indexOf(day.toLocaleLowerCase('tr-TR'));
    if (start < 0) return;
    const nextDay = WEEKDAYS[idx + 1];
    const end = nextDay ? src.toLocaleLowerCase('tr-TR').indexOf(nextDay.toLocaleLowerCase('tr-TR'), start + 3) : src.length;
    const slice = src.slice(start, end > start ? end : start + 500);
    const blocks: ScheduleDay['blocks'] = [];
    const timeRe = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/g;
    let m: RegExpExecArray | null;
    const times: { start: string; end: string; at: number }[] = [];
    while ((m = timeRe.exec(slice))) {
      times.push({ start: m[1].replace('.', ':'), end: m[2].replace('.', ':'), at: m.index });
    }
    SCHOOL_SUBJECTS.forEach((sub) => {
      const re = new RegExp(sub, 'ig');
      let sm: RegExpExecArray | null;
      while ((sm = re.exec(slice))) {
        const near = times.find((t) => Math.abs(t.at - sm!.index) < 80);
        const minutes = near ? minutesFromRange(near.start, near.end) : 40;
        if (!blocks.some((b) => b.title === `Okul • ${sub}`)) {
          blocks.push({ title: `Okul • ${sub}`, minutes, icon: '🏫' });
        }
      }
    });
    if (blocks.length) days.push({ day, blocks });
  });
  return days;
}

export function mergeSchoolWithStudy(
  school: ScheduleDay[],
  data: AppData,
  daily: number,
  focus: string,
  notes: string,
  source: string,
): Schedule {
  const base = generateWeeklySchedule(data, daily, Math.max(school.length, 5), focus, source, notes);
  if (!school.length) return { ...base, source, pdfName: data.schedule?.pdfName || '', pdfSize: data.schedule?.pdfSize };
  const map = new Map(school.map((d) => [d.day, d]));
  const days = base.days.map((d) => {
    const sch = map.get(d.day);
    if (!sch) return d;
    const schoolMins = sch.blocks.reduce((a, b) => a + b.minutes, 0);
    const remain = Math.max(45, daily - Math.min(schoolMins, daily - 45));
    const study = d.blocks.slice(0, 3).map((b) => ({ ...b, minutes: Math.max(25, Math.round((b.minutes / Math.max(1, d.blocks.reduce((a, x) => a + x.minutes, 0))) * remain)) }));
    return { day: d.day, blocks: [...sch.blocks.map((b) => ({ ...b, icon: b.icon || iconFor(b.title) })), ...study] };
  });
  return { days, source, pdfName: data.schedule?.pdfName || '', pdfSize: data.schedule?.pdfSize, notes, updatedAt: new Date().toISOString() };
}

export function scheduleFromUnknown(raw: unknown, fallback: Schedule): Schedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { schedule?: unknown; days?: ScheduleDay[] };
  const s = (obj.schedule && typeof obj.schedule === 'object' ? obj.schedule : obj) as Partial<Schedule>;
  const days = Array.isArray(s.days) ? s.days.filter((d) => d && d.day && Array.isArray(d.blocks)) : [];
  if (!days.length) return null;
  return {
    days: days.map((d) => ({
      day: String(d.day),
      blocks: (d.blocks || []).map((b) => ({
        title: String(b.title || 'Çalışma'),
        minutes: Math.max(15, Number(b.minutes) || 40),
        icon: String(b.icon || iconFor(String(b.title || ''))),
      })),
    })),
    source: String(s.source || fallback.source),
    pdfName: String(s.pdfName || fallback.pdfName),
    pdfSize: Number(s.pdfSize) || fallback.pdfSize,
    notes: String(s.notes || fallback.notes),
    updatedAt: new Date().toISOString(),
  };
}

export function extractJsonObject(text: string) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const blob = fence?.[1] || text;
  const start = blob.indexOf('{');
  const end = blob.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(blob.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export function applyScheduleNotes(schedule: Schedule, note: string): Schedule {
  const days = schedule.days.map((d) => ({ ...d, blocks: [...d.blocks] }));
  const low = note.toLocaleLowerCase('tr-TR');
  let next = days;
  if (/pazar.*(boş|bos)|pazar.*tatil/.test(low)) next = next.filter((x) => x.day !== 'Pazar');
  if (/cumartesi.*deneme/.test(low)) {
    const day = next.find((x) => x.day === 'Cumartesi');
    if (day) day.blocks.unshift({ title: 'Deneme + analiz', minutes: 90, icon: '📝' });
  }
  if (/matematik.*90/.test(low)) {
    const day = next.find((x) => x.day === 'Pazartesi');
    if (day) {
      day.blocks = day.blocks.filter((x) => !x.title.toLocaleLowerCase('tr-TR').includes('matematik'));
      day.blocks.unshift({ title: 'Matematik odak', minutes: 90, icon: '➗' });
    }
  }
  return { ...schedule, days: next, notes: note, updatedAt: new Date().toISOString() };
}
