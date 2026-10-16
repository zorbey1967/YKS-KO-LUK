import { buildAnalyticsBoard } from './studentAnalytics';
import { getStudentProgress, studentStateLines } from './studentProgress';
import type { AppData } from './types';

export const EXAM_DOC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const EXAM_DOC_UNREADABLE =
  'Dosya yeterince net okunamadı. Daha net bir fotoğraf veya PDF yükleyebilirsiniz.';

export type ExamQVerdict = 'dogru' | 'yanlis' | 'bos' | 'belirlenemedi';

export type ExamQuestionRow = {
  number: number | null;
  subject: string;
  topic: string;
  subtopic: string;
  verdict: ExamQVerdict;
  errorType: string;
  readable: boolean;
};

export type TopicWrongRow = { topic: string; wrong: number; correct: number; blank: number; unknown: number };

export type SubjectTopicSummary = {
  subject: string;
  topics: TopicWrongRow[];
};

export type ExamDocumentAnalysis = {
  empty: boolean;
  unreadable: boolean;
  message: string;
  summary: string;
  questions: ExamQuestionRow[];
  bySubject: SubjectTopicSummary[];
  mostWrongTopics: string[];
  missingTopics: string[];
  strongTopics: string[];
  advice: string;
  conflictsWithProgress: string[];
  unreadableQuestions: string[];
  source: 'ai' | 'cache' | 'local';
  fingerprint: string;
};

const UNKNOWN = 'Belirlenemedi';
const TOPIC_UNKNOWN = 'Konusu belirlenemedi';

let memCache: { key: string; result: ExamDocumentAnalysis } | null = null;

export function resetExamDocumentAnalysisCache() {
  memCache = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('yks_exam_doc_analysis_v1_')) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function clearExamDocumentAnalysisForUser(userId: string | null | undefined) {
  memCache = null;
  if (!userId) return;
  try {
    sessionStorage.removeItem(storeKey(userId));
  } catch { /* ignore */ }
}

function storeKey(userId: string) {
  return `yks_exam_doc_analysis_v1_${userId}`;
}

function normLabel(raw: unknown, fallback: string): string {
  const t = String(raw || '').trim();
  if (!t || /uydur|bilinmiyor|unknown|n\/a|yok/i.test(t)) return fallback;
  if (/belirlenemedi|net değil|okunamad/i.test(t)) return fallback;
  return t.slice(0, 80);
}

function normVerdict(raw: unknown): ExamQVerdict {
  const t = String(raw || '').toLocaleLowerCase('tr-TR');
  if (/doğru|dogru|correct|true|\bd\b/.test(t)) return 'dogru';
  if (/yanlış|yanlis|wrong|false|\by\b/.test(t)) return 'yanlis';
  if (/boş|bos|blank|empty/.test(t)) return 'bos';
  return 'belirlenemedi';
}

export function emptyExamDocumentAnalysis(fp = '', message = ''): ExamDocumentAnalysis {
  return {
    empty: true,
    unreadable: false,
    message,
    summary: '',
    questions: [],
    bySubject: [],
    mostWrongTopics: [],
    missingTopics: [],
    strongTopics: [],
    advice: '',
    conflictsWithProgress: [],
    unreadableQuestions: [],
    source: 'local',
    fingerprint: fp,
  };
}

export async function fingerprintExamFiles(files: File[]): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    const buf = new Uint8Array(await f.arrayBuffer());
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    parts.push(`${f.name}|${f.size}|${f.type}|${hex}`);
  }
  parts.sort();
  const joined = parts.join('||');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function analysisCacheKey(userId: string, fileFp: string, progressFp: string) {
  return `${userId}:${fileFp}:${progressFp}`;
}

export function readCachedExamDocumentAnalysis(userId: string, fullKey: string): ExamDocumentAnalysis | null {
  if (memCache?.key === fullKey) return { ...memCache.result, source: 'cache' };
  try {
    const raw = sessionStorage.getItem(storeKey(userId));
    if (!raw) return null;
    const pack = JSON.parse(raw) as { key?: string; result?: ExamDocumentAnalysis };
    if (pack.key !== fullKey || !pack.result) return null;
    memCache = { key: fullKey, result: pack.result };
    return { ...pack.result, source: 'cache' };
  } catch {
    return null;
  }
}

export function writeCachedExamDocumentAnalysis(userId: string, fullKey: string, result: ExamDocumentAnalysis) {
  const stored = { ...result, source: 'ai' as const };
  memCache = { key: fullKey, result: stored };
  try {
    sessionStorage.setItem(storeKey(userId), JSON.stringify({ key: fullKey, result: stored }));
  } catch { /* ignore quota */ }
}

export function parseExamDocumentAiPayload(raw: unknown): {
  questions: ExamQuestionRow[];
  unreadable: boolean;
  message: string;
  advice: string;
  summary: string;
  unreadableQuestions: string[];
} {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const unreadable = Boolean(rec.unreadable) || String(rec.status || '') === 'unreadable';
  const message = String(rec.message || rec.warning || '').trim();
  const advice = String(rec.advice || rec.suggestion || '').trim().slice(0, 800);
  const summary = String(rec.summary || '').trim().slice(0, 800);
  const unreadQ = Array.isArray(rec.unreadableQuestions)
    ? rec.unreadableQuestions.map((x) => String(x).trim()).filter(Boolean).slice(0, 40)
    : [];
  const list = Array.isArray(rec.questions) ? rec.questions : [];
  const questions: ExamQuestionRow[] = [];
  for (const item of list) {
    const r = item && typeof item === 'object' ? item as Record<string, unknown> : null;
    if (!r) continue;
    const numRaw = r.number ?? r.n ?? r.soru;
    const number = numRaw == null || numRaw === '' ? null : Number(numRaw);
    const readable = r.readable !== false && String(r.status || '') !== 'unreadable';
    const subject = readable ? normLabel(r.subject ?? r.ders, UNKNOWN) : UNKNOWN;
    const topic = readable ? normLabel(r.topic ?? r.konu, TOPIC_UNKNOWN) : TOPIC_UNKNOWN;
    const subtopic = readable ? normLabel(r.subtopic ?? r.altKonu, UNKNOWN) : UNKNOWN;
    const verdict = readable ? normVerdict(r.verdict ?? r.result ?? r.durum) : 'belirlenemedi';
    const errorType = verdict === 'yanlis'
      ? normLabel(r.errorType ?? r.hataTuru, UNKNOWN)
      : UNKNOWN;
    questions.push({
      number: Number.isFinite(number) ? Math.max(1, Math.floor(number as number)) : null,
      subject,
      topic,
      subtopic,
      verdict,
      errorType,
      readable,
    });
  }
  return { questions, unreadable, message, advice, summary, unreadableQuestions: unreadQ };
}

export function summarizeExamQuestions(questions: ExamQuestionRow[]): {
  bySubject: SubjectTopicSummary[];
  mostWrongTopics: string[];
  missingTopics: string[];
  strongTopics: string[];
} {
  const map = new Map<string, Map<string, TopicWrongRow>>();
  for (const q of questions) {
    if (!q.readable) continue;
    const subject = q.subject === UNKNOWN ? UNKNOWN : q.subject;
    const topic = q.topic === TOPIC_UNKNOWN ? TOPIC_UNKNOWN : q.topic;
    if (!map.has(subject)) map.set(subject, new Map());
    const topics = map.get(subject)!;
    if (!topics.has(topic)) topics.set(topic, { topic, wrong: 0, correct: 0, blank: 0, unknown: 0 });
    const row = topics.get(topic)!;
    if (q.verdict === 'yanlis') row.wrong += 1;
    else if (q.verdict === 'dogru') row.correct += 1;
    else if (q.verdict === 'bos') row.blank += 1;
    else row.unknown += 1;
  }
  const bySubject: SubjectTopicSummary[] = [...map.entries()]
    .map(([subject, topics]) => ({
      subject,
      topics: [...topics.values()].sort((a, b) => b.wrong - a.wrong || a.topic.localeCompare(b.topic, 'tr')),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, 'tr'));

  const flat = bySubject.flatMap((s) => s.topics.map((t) => ({
    label: s.subject === UNKNOWN ? t.topic : `${s.subject} · ${t.topic}`,
    ...t,
  }))).filter((t) => t.topic !== TOPIC_UNKNOWN);

  const mostWrongTopics = flat
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 8)
    .map((t) => `${t.label}: ${t.wrong} yanlış`);

  const missingTopics = flat
    .filter((t) => t.wrong + t.blank > 0 && t.correct === 0)
    .slice(0, 8)
    .map((t) => t.label);

  const strongTopics = flat
    .filter((t) => t.correct > 0 && t.wrong === 0 && t.blank === 0)
    .slice(0, 8)
    .map((t) => t.label);

  return { bySubject, mostWrongTopics, missingTopics, strongTopics };
}

export function conflictsWithStudentProgress(data: AppData, analysis: Pick<ExamDocumentAnalysis, 'mostWrongTopics' | 'strongTopics' | 'bySubject'>): string[] {
  const board = buildAnalyticsBoard(data);
  const progress = getStudentProgress(data);
  const notes: string[] = [];
  if (!board.hasData && !progress.lastExam) return notes;

  const weak = new Set([
    ...board.weakAreas.map((w) => w.toLocaleLowerCase('tr-TR')),
    ...progress.gaps.map((g) => g.subject.toLocaleLowerCase('tr-TR')),
  ]);
  const strongBoard = new Set(
    board.subjects.filter((s) => s.band === 'İyi' || s.trend === 'up').map((s) => s.name.toLocaleLowerCase('tr-TR')),
  );

  for (const label of analysis.strongTopics) {
    const subj = label.split('·')[0].trim().toLocaleLowerCase('tr-TR');
    if (weak.has(subj)) {
      notes.push(`Yüklenen sınavda ${label} güçlü görünüyor; kayıtlı deneme/konu verisinde ${subj} zayıf/eksik.`);
    }
  }
  for (const label of analysis.mostWrongTopics) {
    const subj = label.split('·')[0].trim().toLocaleLowerCase('tr-TR');
    if (strongBoard.has(subj) && !/yanlış/.test(subj)) {
      notes.push(`Yüklenen sınavda ${label}; kayıtlı netlerde ${subj} görece güçlü.`);
    }
  }
  return notes.slice(0, 5);
}

export function buildExamDocumentAnalysisFromAi(
  raw: unknown,
  opts: { fingerprint: string; data: AppData },
): ExamDocumentAnalysis {
  const parsed = parseExamDocumentAiPayload(raw);
  if (parsed.unreadable && !parsed.questions.length) {
    return {
      ...emptyExamDocumentAnalysis(opts.fingerprint, parsed.message || EXAM_DOC_UNREADABLE),
      unreadable: true,
      message: parsed.message || EXAM_DOC_UNREADABLE,
      source: 'ai',
    };
  }
  const readableQs = parsed.questions.filter((q) => q.readable);
  if (!readableQs.length && !parsed.questions.length) {
    return {
      ...emptyExamDocumentAnalysis(opts.fingerprint, parsed.message || EXAM_DOC_UNREADABLE),
      unreadable: true,
      message: parsed.message || EXAM_DOC_UNREADABLE,
      unreadableQuestions: parsed.unreadableQuestions,
      source: 'ai',
    };
  }
  const agg = summarizeExamQuestions(parsed.questions);
  const base: ExamDocumentAnalysis = {
    empty: false,
    unreadable: parsed.unreadable,
    message: parsed.message,
    summary: parsed.summary || `${readableQs.length} soru okundu.`,
    questions: parsed.questions,
    bySubject: agg.bySubject,
    mostWrongTopics: agg.mostWrongTopics,
    missingTopics: agg.missingTopics,
    strongTopics: agg.strongTopics,
    advice: parsed.advice,
    conflictsWithProgress: [],
    unreadableQuestions: [
      ...parsed.unreadableQuestions,
      ...parsed.questions.filter((q) => !q.readable).map((q) => (q.number != null ? `Soru ${q.number}` : 'Okunamayan soru')),
    ].slice(0, 40),
    source: 'ai',
    fingerprint: opts.fingerprint,
  };
  base.conflictsWithProgress = conflictsWithStudentProgress(opts.data, base);
  return base;
}

export function mergeExamDocumentAnalyses(
  parts: ExamDocumentAnalysis[],
  opts: { fingerprint: string; data: AppData },
): ExamDocumentAnalysis {
  if (!parts.length) {
    return { ...emptyExamDocumentAnalysis(opts.fingerprint, EXAM_DOC_UNREADABLE), unreadable: true };
  }
  if (parts.every((p) => p.unreadable && p.empty)) {
    return {
      ...emptyExamDocumentAnalysis(opts.fingerprint, EXAM_DOC_UNREADABLE),
      unreadable: true,
      message: EXAM_DOC_UNREADABLE,
      source: 'ai',
    };
  }
  const questions = parts.flatMap((p) => p.questions);
  const agg = summarizeExamQuestions(questions);
  const unread = parts.flatMap((p) => p.unreadableQuestions);
  const advice = parts.map((p) => p.advice).filter(Boolean).join(' ').slice(0, 800);
  const summary = parts.map((p) => p.summary).filter(Boolean).join(' ').slice(0, 800)
    || `${questions.filter((q) => q.readable).length} soru okundu.`;
  const base: ExamDocumentAnalysis = {
    empty: !questions.some((q) => q.readable),
    unreadable: parts.some((p) => p.unreadable) && !questions.some((q) => q.readable),
    message: parts.map((p) => p.message).filter(Boolean)[0] || '',
    summary,
    questions,
    bySubject: agg.bySubject,
    mostWrongTopics: agg.mostWrongTopics,
    missingTopics: agg.missingTopics,
    strongTopics: agg.strongTopics,
    advice,
    conflictsWithProgress: [],
    unreadableQuestions: unread.slice(0, 40),
    source: 'ai',
    fingerprint: opts.fingerprint,
  };
  if (base.empty) {
    return {
      ...emptyExamDocumentAnalysis(opts.fingerprint, EXAM_DOC_UNREADABLE),
      unreadable: true,
      message: EXAM_DOC_UNREADABLE,
      unreadableQuestions: base.unreadableQuestions,
      source: 'ai',
    };
  }
  base.conflictsWithProgress = conflictsWithStudentProgress(opts.data, base);
  return base;
}

export function examDocumentAnalysisContext(data: AppData): string {
  return [
    'Öğrenci bağlamı (karşılaştırma; dosyadaki soruları uydurma):',
    ...studentStateLines(data).slice(0, 20),
  ].join('\n');
}

export async function analyzeExamDocumentFiles(
  files: File[],
  data: AppData,
  userId: string,
  progressFp: string,
  upload: (file: File) => Promise<{ path: string } | { error: string }>,
  scan: (path: string, context: string) => Promise<{ ok: true; analysis: unknown } | { ok: false; error: string }>,
): Promise<ExamDocumentAnalysis | { error: string }> {
  if (!userId) return { error: 'Giriş gerekli.' };
  if (!files.length) return { error: 'Önce sınav/deneme fotoğrafı veya PDF yükleyin.' };
  const fileFp = await fingerprintExamFiles(files);
  const fullKey = analysisCacheKey(userId, fileFp, progressFp);
  const cached = readCachedExamDocumentAnalysis(userId, fullKey);
  if (cached) return cached;

  const ctx = examDocumentAnalysisContext(data);
  const parts: ExamDocumentAnalysis[] = [];
  for (const file of files) {
    const up = await upload(file);
    if ('error' in up) return { error: up.error };
    const scanned = await scan(up.path, ctx);
    if (!scanned.ok) return { error: scanned.error };
    parts.push(buildExamDocumentAnalysisFromAi(scanned.analysis, { fingerprint: fileFp, data }));
  }
  const merged = mergeExamDocumentAnalyses(parts, { fingerprint: fileFp, data });
  writeCachedExamDocumentAnalysis(userId, fullKey, merged);
  return merged;
}

export const EXAM_DOCUMENT_ANALYSIS_PROMPT = `Sınav/deneme fotoğrafı veya PDF. SADECE gördüğün soruları analiz et.
JSON döndür:
{
  "unreadable": false,
  "message": "",
  "summary": "kısa özet",
  "advice": "çalışma önerisi (yalnızca okunan sorulara dayalı)",
  "unreadableQuestions": ["Soru 4"],
  "questions": [
    {
      "number": 1,
      "subject": "Matematik",
      "topic": "Fonksiyonlar",
      "subtopic": "Belirlenemedi",
      "verdict": "yanlis",
      "errorType": "Belirlenemedi",
      "readable": true
    }
  ]
}
Kurallar:
- Dosyada olmayan soru üretme. Net/sonuç uydurma.
- Konu görünmüyorsa topic = "Konusu belirlenemedi".
- Doğru/yanlış/boş okunmuyorsa verdict = "belirlenemedi"; tahmin etme.
- Hata türü görünmüyorsa errorType = "Belirlenemedi"; kesin neden uydurma.
- Dosya okunamıyorsa unreadable=true, questions=[], message tam olarak: "${EXAM_DOC_UNREADABLE}"
- Kısmi okumada okunamayan soruları unreadableQuestions’a yaz.`;
