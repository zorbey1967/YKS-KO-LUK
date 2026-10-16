import { askZorroPlain } from './coachAi';
import { buildAnalyticsBoard, type AnalyticsBoard } from './studentAnalytics';
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

  const series = board.tytSeries.slice(-3).map((x) => x.net);
  const tytLine = series.length >= 2
    ? `Son denemelerde TYT netin ${series.join(' → ')}.`
    : board.lastTyt != null
      ? `Son TYT netin ${board.lastTyt}.`
      : '';
  const aytLine = board.lastAyt != null ? `Son AYT netin ${board.lastAyt}.` : '';
  const weakLine = weaknesses.length ? `${weaknesses.join(', ')} alanında kayıtlı net daha düşük.` : '';
  const strongLine = strengths.length ? `${strengths.join(', ')} görece güçlü.` : '';
  const narrative = [tytLine, aytLine, strongLine, weakLine].filter(Boolean).join(' ');

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
  const weekMin = data.sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  return {
    lastTyt: board.lastTyt,
    lastAyt: board.lastAyt,
    avgTyt: board.avgTyt,
    avgAyt: board.avgAyt,
    tytSeries: board.tytSeries.slice(-5),
    aytSeries: board.aytSeries.slice(-5),
    subjects: board.subjects.map((s) => ({ name: s.name, last: s.last, avg: s.avg, trend: s.trend, band: s.band })),
    weakAreas: board.weakAreas,
    goal: { dept: data.dept, rank: data.rank, examDate: data.examDate, weekHours: data.weekHours },
    scheduleDays: data.schedule?.days?.length || 0,
    tasksDone: done,
    openTasks: open,
    recordedStudyMinutes: weekMin,
  };
}

export async function requestAiCoachAnalysis(data: AppData): Promise<AiCoachReport> {
  const board = buildAnalyticsBoard(data);
  const local = localAiCoachReport(data, board);
  if (local.empty) return local;
  const facts = factsForModel(data, board);
  const cloud = await askZorroPlain(
    'Öğrencinin kayıtlı deneme ve net verisini analiz et. Sayı uydurma. Verilmeyen dersi zayıf sayma.',
    `SADECE bu JSON’daki gerçek kayıtlar:\n${JSON.stringify(facts)}\nKısa Türkçe değerlendirme yaz (en fazla 8 cümle). Yeni net icat etme.`,
  );
  if (cloud.source === 'ai' && cloud.text && !/yanıt veremiyor|üye/i.test(cloud.text)) {
    return { ...local, narrative: cloud.text, source: 'ai' };
  }
  return local;
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
