import { askZorroPlain } from './coachAi';
import { buildAnalyticsBoard, type AnalyticsBoard } from './studentAnalytics';
import { MIN_EXAMS_FOR_TREND, getStudentProgress, progressFingerprint, studentStateLines, writtenExamFeedback } from './studentProgress';
import type { AppData, Task } from './types';
import { today, uid } from './util';

export type AiStudyBlock = { minutes: number; subject: string };

export type AiCoachReport = {
  empty: boolean;
  strengths: string[];
  weaknesses: string[];
  weekHint: string;
  todayHint: string;
  todayBlocks: AiStudyBlock[];
  narrative: string;
  source: 'local' | 'ai';
};

function emptyReport(): AiCoachReport {
  return {
    empty: true,
    strengths: [],
    weaknesses: [],
    weekHint: '',
    todayHint: '',
    todayBlocks: [],
    narrative: '',
    source: 'local',
  };
}

export function localAiCoachReport(data: AppData, board = buildAnalyticsBoard(data)): AiCoachReport {
  if (!board.hasData) return emptyReport();
  const strengths = board.subjects.filter((s) => s.band === 'İyi' || s.trend === 'up').map((s) => s.name).slice(0, 3);
  const weaknesses = board.weakAreas.slice(0, 3);
  const todayBlocks: AiStudyBlock[] = [];
  if (weaknesses[0]) todayBlocks.push({ minutes: 45, subject: weaknesses[0] });
  if (strengths[0] && strengths[0] !== weaknesses[0]) todayBlocks.push({ minutes: 30, subject: strengths[0] });
  else if (weaknesses[1]) todayBlocks.push({ minutes: 30, subject: weaknesses[1] });

  const feedback = writtenExamFeedback(data);
  const series = board.tytSeries.slice(-3).map((x) => x.net);
  const tytLine = series.length >= MIN_EXAMS_FOR_TREND
    ? `Kayıtlı TYT netlerin ${series.join(' → ')}.`
    : board.lastTyt != null
      ? `Kayıtlı son TYT netin ${board.lastTyt}. Trend için en az ${MIN_EXAMS_FOR_TREND} deneme gerekir.`
      : '';
  const aytLine = board.lastAyt != null ? `Kayıtlı son AYT netin ${board.lastAyt}.` : '';
  const weakLine = weaknesses.length ? `${weaknesses.join(', ')} alanında kayıtlı net daha düşük.` : '';
  const strongLine = strengths.length ? `${strengths.join(', ')} kayıtlı netlere göre görece güçlü.` : '';
  const narrative = feedback.ready
    ? [feedback.text, tytLine, aytLine, strongLine, weakLine].filter(Boolean).join(' ')
    : feedback.text;

  return {
    empty: false,
    strengths,
    weaknesses,
    weekHint: weaknesses[0] ? `Bu hafta ${weaknesses[0]} için ek tekrar.` : (strengths[0] ? `Bu hafta ${strengths[0]} temposunu koru.` : ''),
    todayHint: todayBlocks.map((b) => `${b.minutes} dakika ${b.subject}`).join(' · '),
    todayBlocks,
    narrative,
    source: 'local',
  };
}

function factsForModel(data: AppData, board: AnalyticsBoard) {
  const done = data.tasks.filter((t) => t.done).length;
  const open = data.tasks.filter((t) => !t.done).slice(0, 6).map((t) => t.title);
  const progress = getStudentProgress(data);
  return {
    lastTyt: board.lastTyt,
    lastAyt: board.lastAyt,
    avgTyt: board.avgTyt,
    avgAyt: board.avgAyt,
    tytSeries: board.tytSeries.slice(-5),
    aytSeries: board.aytSeries.slice(-5),
    subjects: board.subjects.map((s) => ({ name: s.name, last: s.last, avg: s.avg, trend: s.trend, band: s.band })),
    weakAreas: board.weakAreas,
    goal: { dept: data.dept, rank: data.rank, examDate: data.examDate, weekHours: data.weekHours, grade: data.grade, track: data.track },
    scheduleDays: data.schedule?.days?.length || 0,
    tasksDone: done,
    openTasks: open,
    todayTimer: progress.capacity.todayTimer,
    todayLibrary: progress.capacity.todayLibrary,
    weekTimer: progress.capacity.weekTimer,
    weekLibrary: progress.capacity.weekLibrary,
    topicGaps: progress.gaps.slice(0, 6).map((g) => `${g.subject} / ${g.name}`),
    studentState: studentStateLines(data),
  };
}

let aiReportCache: { fp: string; report: AiCoachReport } | null = null;
let aiInflight: { fp: string; p: Promise<AiCoachReport> } | null = null;

export function resetAiCoachCache() {
  aiReportCache = null;
}

/** Peek: Ana Sayfa ve Analiz aynı raporu gösterir; veri değişmediyse model tekrar çağrılmaz. */
export function cachedAiCoachReport(data: AppData): AiCoachReport | null {
  return aiReportCache?.fp === progressFingerprint(data) ? aiReportCache.report : null;
}

/** Aynı veri için tek model çağrısı (önbellek + eşzamanlı istek birleştirme). */
export function requestAiCoachAnalysis(data: AppData): Promise<AiCoachReport> {
  const fp = progressFingerprint(data);
  if (aiReportCache?.fp === fp) return Promise.resolve(aiReportCache.report);
  if (aiInflight?.fp === fp) return aiInflight.p;
  const p = runAiCoachAnalysis(data, fp).finally(() => {
    if (aiInflight?.p === p) aiInflight = null;
  });
  aiInflight = { fp, p };
  return p;
}

async function runAiCoachAnalysis(data: AppData, fp: string): Promise<AiCoachReport> {
  const board = buildAnalyticsBoard(data);
  const local = localAiCoachReport(data, board);
  if (local.empty) {
    aiReportCache = { fp, report: local };
    return local;
  }
  const facts = factsForModel(data, board);
  const cloud = await askZorroPlain(
    'Öğrencinin kayıtlı deneme, konu, çalışma ve kütüphane verisini doğal bir koç gibi değerlendir. Sayı uydurma. Verilmeyen dersi zayıf sayma. Olmayan deneme, süre veya görevi yazma.',
    `SADECE bu JSON’daki gerçek kayıtlar:\n${JSON.stringify(facts)}\nEn fazla 8 kısa Türkçe cümle. Örnek üslup: “Bu konuda oldukça iyi durumdasın.” “Burada son iki denemende düşüş var.” “Matematikte şu konuyu tamamlaman şu anda daha öncelikli.” Yeni net icat etme.`,
  );
  const report = cloud.source === 'ai' && cloud.text && !/yanıt veremiyor|üye/i.test(cloud.text)
    ? { ...local, narrative: cloud.text, source: 'ai' as const }
    : local;
  // Model yanıt vermediyse yerel özet gösterilir ama önbelleğe alınmaz: öğrenci tekrar deneyebilir.
  if (report.source === 'ai') aiReportCache = { fp, report };
  return report;
}

export function appendAiBlocksAsTasks(data: AppData, blocks: AiStudyBlock[]): AppData {
  if (!blocks.length) return data;
  const date = today();
  const extra: Task[] = blocks.map((b) => ({
    id: uid(),
    title: `${b.subject} çalışması`,
    subject: b.subject,
    minutes: b.minutes,
    priority: 'normal',
    done: false,
    date,
    origin: 'zorro',
  }));
  return { ...data, tasks: [...data.tasks, ...extra] };
}
