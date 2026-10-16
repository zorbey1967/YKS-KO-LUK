import type { AppData, CalcRecord, Exam } from './types';

export type NetPoint = { date: string; net: number; name: string };

export type SubjectInsight = {
  name: string;
  last: number | null;
  avg: number | null;
  high: number | null;
  trend: 'up' | 'down' | 'flat' | 'none';
  band: 'Zayıf' | 'Orta' | 'İyi' | null;
  status: string;
};

export type ExamBreakdown = {
  id: string;
  name: string;
  date: string;
  type: string;
  net: number;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
  minutes: number | null;
  subjects: { name: string; net: number }[];
  delta: number | null;
};

export type AnalyticsBoard = {
  hasData: boolean;
  lastTyt: number | null;
  lastAyt: number | null;
  avgTyt: number | null;
  avgAyt: number | null;
  maxNet: number | null;
  lastExamDate: string | null;
  tytSeries: NetPoint[];
  aytSeries: NetPoint[];
  subjects: SubjectInsight[];
  weakAreas: string[];
  examRows: ExamBreakdown[];
};

const SUBJECT_ORDER = ['Türkçe', 'Matematik', 'Sosyal', 'Fen', 'Edebiyat', 'Tarih', 'Coğrafya', 'Fizik', 'Kimya', 'Biyoloji'];

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function trendOf(values: number[]): SubjectInsight['trend'] {
  if (values.length < 2) return 'none';
  const a = values[values.length - 2];
  const b = values[values.length - 1];
  const d = b - a;
  if (d >= 0.8) return 'up';
  if (d <= -0.8) return 'down';
  return 'flat';
}

function bandOf(last: number | null, maxHint: number): SubjectInsight['band'] {
  if (last == null || maxHint <= 0) return null;
  const pct = last / maxHint;
  if (pct < 0.45) return 'Zayıf';
  if (pct < 0.7) return 'Orta';
  return 'İyi';
}

function statusOf(t: SubjectInsight['trend'], band: SubjectInsight['band']): string {
  if (t === 'up') return 'Gelişiyor';
  if (t === 'down') return 'Geriliyor';
  if (band === 'İyi') return 'İstikrarlı';
  if (band === 'Zayıf') return 'Öncelik';
  if (band === 'Orta') return 'Sabit';
  return '';
}

function sortExams(exams: Exam[]) {
  return exams.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}

function sortCalcs(calcs: CalcRecord[]) {
  return calcs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.id) - Number(b.id));
}

function isTyt(type: string) {
  return /tyt|gy|deneme-1/i.test(type);
}

function isAyt(type: string) {
  return /ayt|gk|deneme-2/i.test(type);
}

export function buildAnalyticsBoard(data: AppData): AnalyticsBoard {
  const exams = sortExams(data.exams.filter((e) => e && e.date));
  const calcs = sortCalcs(data.calcs.filter(Boolean));
  const hasData = exams.length > 0 || calcs.length > 0;
  if (!hasData) {
    return {
      hasData: false,
      lastTyt: null,
      lastAyt: null,
      avgTyt: null,
      avgAyt: null,
      maxNet: null,
      lastExamDate: null,
      tytSeries: [],
      aytSeries: [],
      subjects: [],
      weakAreas: [],
      examRows: [],
    };
  }

  const tytFromExams = exams.map((e) => ({ date: e.date, net: Number(e.tyt || 0), name: e.name || 'Deneme' }));
  const aytFromExams = exams.map((e) => ({ date: e.date, net: Number(e.ayt || 0), name: e.name || 'Deneme' }));
  const tytFromCalcs = calcs.filter((c) => isTyt(String(c.type))).map((c) => ({
    date: String(c.date),
    net: Number(c.net || 0),
    name: String(c.type || 'TYT'),
  }));
  const aytFromCalcs = calcs.filter((c) => isAyt(String(c.type))).map((c) => ({
    date: String(c.date),
    net: Number(c.net || 0),
    name: String(c.type || 'AYT'),
  }));

  const tytSeries = (tytFromExams.length ? tytFromExams : tytFromCalcs).slice(-10);
  const aytSeries = (aytFromExams.length ? aytFromExams : aytFromCalcs).slice(-10);
  const lastTyt = tytSeries.length ? tytSeries[tytSeries.length - 1].net : null;
  const lastAyt = aytSeries.length ? aytSeries[aytSeries.length - 1].net : null;
  const avgTyt = avg(tytSeries.map((x) => x.net));
  const avgAyt = avg(aytSeries.map((x) => x.net));
  const allNets = [
    ...exams.flatMap((e) => [Number(e.tyt || 0), Number(e.ayt || 0)]),
    ...calcs.map((c) => Number(c.net || 0)),
  ];
  const maxNet = allNets.length ? Math.max(...allNets) : null;
  const lastExamDate = [...exams.map((e) => e.date), ...calcs.map((c) => String(c.date))].sort().at(-1) || null;

  const bySubject: Record<string, { nets: number[]; max: number }> = {};
  for (const e of exams) {
    for (const s of e.subjects || []) {
      const name = String(s.name || '').trim();
      if (!name) continue;
      if (!bySubject[name]) bySubject[name] = { nets: [], max: 40 };
      bySubject[name].nets.push(Number(s.net || 0));
    }
  }
  for (const c of calcs) {
    for (const s of c.subjects || []) {
      const name = String(s.subject || '').trim();
      if (!name) continue;
      if (!bySubject[name]) bySubject[name] = { nets: [], max: Number(s.max) || 40 };
      bySubject[name].nets.push(Number(s.net || 0));
      if (Number(s.max) > bySubject[name].max) bySubject[name].max = Number(s.max);
    }
  }
  const topicFallback = data.topics.filter((t) => t && t.name);
  for (const t of topicFallback) {
    const name = String(t.name);
    if (bySubject[name]) continue;
    if (!SUBJECT_ORDER.includes(name)) continue;
    bySubject[name] = { nets: [Number(t.level) || 0], max: 100 };
  }

  const subjects: SubjectInsight[] = Object.keys(bySubject)
    .sort((a, b) => {
      const ia = SUBJECT_ORDER.indexOf(a);
      const ib = SUBJECT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'tr');
    })
    .map((name) => {
      const nets = bySubject[name].nets;
      const last = nets[nets.length - 1] ?? null;
      const t = trendOf(nets);
      const band = bandOf(last, bySubject[name].max);
      return {
        name,
        last,
        avg: avg(nets),
        high: nets.length ? Math.max(...nets) : null,
        trend: t,
        band,
        status: statusOf(t, band),
      };
    });

  const weakAreas = subjects
    .filter((s) => s.band === 'Zayıf' || s.trend === 'down')
    .sort((a, b) => (a.last ?? 99) - (b.last ?? 99))
    .slice(0, 5)
    .map((s) => s.name);

  const examRows: ExamBreakdown[] = [];
  const lastByType: Record<string, number> = {};
  if (exams.length) {
    let prevTyt: number | undefined;
    for (const e of exams.slice(-10)) {
      const net = Number(e.tyt || 0);
      examRows.push({
        id: String(e.id),
        name: e.name || 'Deneme',
        date: e.date,
        type: 'TYT/AYT',
        net,
        correct: e.correct != null ? Number(e.correct) : null,
        wrong: e.wrong != null ? Number(e.wrong) : null,
        blank: e.blank != null ? Number(e.blank) : null,
        minutes: null,
        subjects: (e.subjects || []).length
          ? (e.subjects || []).map((s) => ({ name: String(s.name), net: Number(s.net || 0) }))
          : [
            { name: 'TYT', net: Number(e.tyt || 0) },
            { name: 'AYT', net: Number(e.ayt || 0) },
          ],
        delta: prevTyt == null ? null : net - prevTyt,
      });
      prevTyt = net;
    }
  } else {
    for (const c of calcs.slice(-12)) {
      const type = String(c.type || 'Deneme');
      const net = Number(c.net || 0);
      const prev = lastByType[type];
      examRows.push({
        id: String(c.id),
        name: type,
        date: String(c.date),
        type,
        net,
        correct: Number.isFinite(c.correct) ? c.correct : null,
        wrong: Number.isFinite(c.wrong) ? c.wrong : null,
        blank: Number.isFinite(c.blank) ? c.blank : null,
        minutes: null,
        subjects: (c.subjects || []).map((s) => ({ name: String(s.subject), net: Number(s.net || 0) })),
        delta: prev == null ? null : net - prev,
      });
      lastByType[type] = net;
    }
  }

  return {
    hasData: true,
    lastTyt,
    lastAyt,
    avgTyt,
    avgAyt,
    maxNet,
    lastExamDate,
    tytSeries,
    aytSeries,
    subjects,
    weakAreas,
    examRows: examRows.slice().reverse(),
  };
}

export function analyticsFingerprint(data: AppData) {
  return [
    data.exams.map((e) => `${e.id}:${e.tyt}:${e.ayt}:${e.date}:${e.correct ?? ''}:${e.wrong ?? ''}:${e.blank ?? ''}:${(e.subjects || []).map((s) => `${s.name}:${s.net}`).join(',')}`).join(';'),
    data.calcs.map((c) => `${c.id}:${c.net}:${c.date}:${(c.subjects || []).map((s) => `${s.subject}:${s.net}`).join(',')}`).join(';'),
    data.topics.map((t) => `${t.name}:${t.level}`).join(','),
  ].join('|');
}
