import type { AppData } from './types';
import { examCountdown, weekMinutes } from './insights';
import { examKind } from './stage';

/** Sıralama tahmini yok; tempo, trend ve hata döngüsü. */
export function eliteReport(data: AppData) {
  const kind = examKind(data);
  const count = examCountdown(data.examDate);
  const exams = data.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
  const tyt = exams.map((x) => Number(x.tyt || 0));
  const ayt = exams.map((x) => Number(x.ayt || 0));
  const tytDelta = tyt.length >= 2 ? tyt[tyt.length - 1] - tyt[0] : 0;
  const aytDelta = ayt.length >= 2 ? ayt[ayt.length - 1] - ayt[0] : 0;
  const lastTyt = tyt.length ? tyt[tyt.length - 1] : undefined;
  const lastAyt = ayt.length ? ayt[ayt.length - 1] : undefined;
  const weekTarget = Math.max(0, (data.weekHours || 0) * 60);
  const dailyMin = weekTarget > 0 ? Math.round(weekTarget / 7) : 40;
  const stats = Object.values(data.questionStats);
  const attempts = stats.reduce((a, s) => a + s.attempts, 0);
  const correct = stats.reduce((a, s) => a + s.correct, 0);
  const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
  const lastCalc = data.calcs[0];
  const weakLesson = lastCalc?.subjects?.length
    ? lastCalc.subjects.slice().sort((a, b) => a.net - b.net)[0]?.subject || ''
    : '';
  const week = weekMinutes(data);

  const unset = !data.grade && !data.track;
  let phase = unset ? 'Başlangıç' : 'Okul mastery';
  if (!unset && kind === 'YKS') {
    if (lastTyt === undefined) phase = 'TYT tabanı';
    else if (lastTyt < 70) phase = 'TYT tabanı';
    else if ((lastAyt ?? 0) < 35) phase = 'AYT ivme';
    else phase = 'Sınav temposu';
  } else if (kind === 'KPSS') {
    phase = (lastTyt ?? 0) < 45 ? 'GY tabanı' : 'Deneme + GK';
  }

  const dailyQ = kind === 'YKS'
    ? (phase === 'Sınav temposu' ? 80 : 55)
    : kind === 'KPSS' ? 45 : 25;

  const lines: string[] = [];
  if (unset) {
    lines.push('Yaş, sınıf, alan ve hedef otomatik doldurulmaz. Hedefim sayfasından kaydet.');
  } else if (kind === 'YKS') {
    lines.push(`${phase}: her yanlışta etiket (bilgi / işlem / süre / dikkatsizlik), ertesi gün aynı türden 5 soru.`);
    if (weakLesson) lines.push(`Son nette en düşük ders ${weakLesson} — bugün süre tutarak 20 soru.`);
    if (acc && acc < 65) lines.push(`Banka doğruluk %${acc}. Yeni konu açmadan yanlış kuyruğunu bitir.`);
    if (tyt.length >= 2) lines.push(`TYT ilk→son ${tytDelta >= 0 ? '+' : ''}${tytDelta.toFixed(1)} net.`);
    if (ayt.length >= 2) lines.push(`AYT ilk→son ${aytDelta >= 0 ? '+' : ''}${aytDelta.toFixed(1)} net.`);
  } else if (kind === 'KPSS') {
    lines.push(`${phase}: GY paragraf + işlem her gün; GK’yi konu kartıyla kapat.`);
    if (weakLesson) lines.push(`Zayıf net alanı: ${weakLesson}.`);
  } else {
    lines.push('Kısa blok + 10 soru + yanlış kontrolü. Yaşa uygun süreyi aşma.');
  }
  if (!count.past && count.days > 0 && count.days < 40) {
    lines.push(`${count.days} gün kaldı: deneme haftada en az 1, analiz deneme kadar uzun.`);
  }
  if (weekTarget > 0 && week < weekTarget * 0.5) {
    lines.push(`Haftalık süre hedefin yarısının altında (${Math.round(week / 60)} / ${data.weekHours}s).`);
  }

  const headline = unset
    ? 'Önce yaş, sınıf ve hedefi kaydet'
    : kind === 'YKS'
    ? `${phase} • günde ~${dailyQ} soru / ${dailyMin} dk`
    : `${phase} • ~${dailyMin} dk bugün`;

  return {
    kind,
    phase,
    dailyQ,
    dailyMin,
    tytDelta,
    aytDelta,
    lastTyt,
    lastAyt,
    acc,
    weakLesson,
    headline,
    lines,
    days: count.days,
    past: count.past,
    week,
    weekTarget,
  };
}
