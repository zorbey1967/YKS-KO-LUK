import type { AppData, ExamPlanRecord, ExamTarget } from './types';
import { remainingClock } from './countdown';
import { coachSnapshot } from './coach';
import { istanbulToday } from './meeting';

function facts(data: AppData, targets: ExamTarget[]) {
  const s = coachSnapshot(data);
  const today = istanbulToday();
  const lines = targets.map((t) => {
    const c = remainingClock(t.date, t.startTime);
    return `${t.title} (${t.kind}) ${t.date}${t.isPrimary ? ' [ana]' : ''} — ${c.headline}`;
  });
  return {
    s,
    today,
    lines,
    weak: s.weak,
    weekHours: data.weekHours,
    dailyHint: data.weekHours > 0 ? Math.round((data.weekHours * 60) / 6) : 0,
    scheduleDays: data.schedule.days.length,
    openTasks: data.tasks.filter((t) => !t.done && t.date >= today).length,
  };
}

export function examPlanInstruction(data: AppData, targets: ExamTarget[], primary: ExamTarget | null) {
  const f = facts(data, targets);
  const days = primary ? remainingClock(primary.date, primary.startTime).days : 0;
  return [
    'Sınava kadar geriye doğru 3 aşamalı çalışma planı yaz. Olmayan veri uydurma. Gerçek dışı günlük saat önerme (14 saat yok). Planı sessizce uygulama; yalnızca öner.',
    `Ana sınav: ${primary ? `${primary.title} ${primary.date}` : 'yok'}. Kalan gün (Türkiye): ${primary ? days : 'yok'}.`,
    `Tüm sınavlar: ${f.lines.join(' | ') || 'kayıt yok'}.`,
    `Hedef: ${data.dept || 'belirtilmedi'}; sınıf ${data.grade || 'belirtilmedi'}; alan ${data.track || 'belirtilmedi'}.`,
    `Haftalık hedef saat: ${data.weekHours > 0 ? data.weekHours : 'belirtilmedi'}. Program gün sayısı: ${f.scheduleDays}. Açık görev: ${f.openTasks}.`,
    f.weak.length ? `Kayıtlı zayıf: ${f.weak.join(', ')}.` : 'Kayıtlı zayıf konu yok — uydurma.',
    f.s.lastExam ? `Son deneme kaydı: ${f.s.lastExam}.` : 'Deneme net kaydı yok.',
    f.s.solved ? `Soru bankası: ${f.s.solved} soru, doğruluk %${f.s.acc}.` : 'Soru bankası denemesi yok.',
    'Yakın sınava öncelik ver ama ana hedefi yok sayma. Oran uydurma; kayıtlı verilere göre önceliklendir.',
    'JSON: {"summary":"...","weekHint":"...","advice":"...","stages":[{"title":"Aşama 1 Temel","body":"..."},{"title":"Aşama 2 Pekiştirme","body":"..."},{"title":"Aşama 3 Deneme","body":"..."}],"lastWeek":"..."}',
    'Son hafta: yeni konu azalt, uyku bırak, sınavdan bir gün önce aşırı yük yok.',
  ].join('\n');
}

export function localExamPlanDraft(data: AppData, targets: ExamTarget[], primary: ExamTarget | null): ExamPlanRecord {
  const s = coachSnapshot(data);
  const clock = primary ? remainingClock(primary.date, primary.startTime) : remainingClock('');
  const others = targets.filter((t) => t.id !== primary?.id).map((t) => `${t.title} ${t.date}`).join('; ');
  const cap = data.weekHours > 0 ? `${data.weekHours} saat/hafta kayıtlı hedef` : 'haftalık saat hedefi belirtilmedi';
  const weak = s.weak.length ? s.weak.join(', ') : 'kayıtlı zayıf konu yok';
  const stages = [
    { title: 'Aşama 1 — Temel / eksik', body: s.weak.length ? `Kayıtlı eksikler: ${weak}. Bunları sınava kadar önce dağıt.` : 'Eksik konu kaydı yok; Hedefim ve Konular’dan seviye girmeden öncelik uydurulmaz.' },
    { title: 'Aşama 2 — Pekiştirme + soru', body: s.solved ? `Soru bankasında ${s.solved} soru, doğruluk %${s.acc}. Soru hacmini kapasiteye göre artır.` : 'Soru bankası denemesi yok. Bu aşama için soru geçmişi yok.' },
    { title: 'Aşama 3 — Deneme + analiz', body: s.lastExam ? `Son deneme: ${s.lastExam}. Yanlış analizi için gün bırak.` : 'Deneme kaydı yok. Deneme tarihi ekleyince bu aşama netleşir.' },
  ];
  const lastWeek = clock.days <= 7 && clock.phase !== 'past' && clock.phase !== 'unset'
    ? 'Son hafta: yeni konu yükünü azalt; kayıtlı zayıflara dön; sınavdan bir gün önce ağır program önerme.'
    : 'Son 7 günde yeni konu azaltılacak; bu taslak model yanıtı değil, kayıtlı özetten üretildi.';
  const weekHint = data.schedule.days.length
    ? `Mevcut haftalık program ${data.schedule.days.length} gün. Taslak programı değiştirmez.`
    : 'Kayıtlı haftalık program yok.';
  return {
    examId: primary?.id || '',
    examDate: primary?.date || '',
    summary: primary
      ? `${primary.title}: ${clock.headline}. Kapasite: ${cap}.${others ? ` Diğer sınavlar: ${others}.` : ''}`
      : 'Ana sınav yok. Önce sınav ekle.',
    weekHint,
    advice: s.weak.length
      ? `Kayıtlı düşüş/eksik: ${s.weak[0]}. Yakın deneme ve ana sınavı birlikte düşün.`
      : 'Öneri için zayıf konu veya deneme kaydı yok; uydurulmadı.',
    stages,
    lastWeek,
    source: 'local',
    createdAt: new Date().toISOString(),
    pendingSchedule: null,
  };
}
