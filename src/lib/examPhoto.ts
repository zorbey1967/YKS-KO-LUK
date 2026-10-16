import type { AppData, ExamSubjectNet } from './types';
import { askCoach } from './coachAi';
import { extractJsonObject } from './llmPrompt';

export type ExamPhotoDraft = {
  name: string;
  tyt: number;
  ayt: number;
  correct: number;
  wrong: number;
  blank: number;
  note: string;
  subjects: ExamSubjectNet[];
  raw: string;
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function subjectFromUnknown(s: unknown): ExamSubjectNet | null {
  const r = s && typeof s === 'object' ? s as Record<string, unknown> : {};
  const name = String(r.name || r.subject || '').trim();
  if (!name) return null;
  return {
    name,
    net: num(r.net),
    correct: r.correct == null ? undefined : num(r.correct),
    wrong: r.wrong == null ? undefined : num(r.wrong),
    blank: r.blank == null ? undefined : num(r.blank),
  };
}

export function draftFromUnknown(raw: unknown, fallbackName: string): ExamPhotoDraft | null {
  const rec = extractJsonObject(typeof raw === 'string' ? raw : JSON.stringify(raw || '')) || (raw && typeof raw === 'object' ? raw as Record<string, unknown> : null);
  if (!rec) return null;
  const subjects = (Array.isArray(rec.subjects) ? rec.subjects : []).map(subjectFromUnknown).filter((s): s is ExamSubjectNet => Boolean(s));
  const tyt = num(rec.tyt ?? rec.TYT ?? rec.gy);
  const ayt = num(rec.ayt ?? rec.AYT ?? rec.gk);
  const correct = num(rec.correct ?? rec.dogru);
  const wrong = num(rec.wrong ?? rec.yanlis);
  const blank = num(rec.blank ?? rec.bos);
  if (tyt <= 0 && ayt <= 0 && !subjects.length && correct <= 0 && wrong <= 0) return null;
  return {
    name: String(rec.name || fallbackName || 'Deneme').trim() || 'Deneme',
    tyt,
    ayt,
    correct,
    wrong,
    blank,
    note: subjects.map((s) => `${s.name} ${s.net}`).join(', '),
    subjects,
    raw: typeof raw === 'string' ? raw : JSON.stringify(raw),
  };
}

export async function suggestExamFromPhoto(file: File, data: AppData): Promise<{ draft: ExamPhotoDraft } | { error: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const mime = file.type || 'image/jpeg';
  const q = 'Bu deneme sonuç kağıdından netleri oku. Uydurma. JSON: {"name":"","tyt":0,"ayt":0,"correct":0,"wrong":0,"blank":0,"subjects":[{"name":"Türkçe","net":0,"correct":0,"wrong":0,"blank":0}]}';
  const ans = await askCoach(q, data, [], { b64, mime });
  if (ans.source !== 'ai') return { error: 'Fotoğraf net okunamadı. Bilgileri elle girebilirsiniz.' };
  const draft = draftFromUnknown(ans.text, file.name.replace(/\.[^.]+$/, ''));
  if (!draft) return { error: 'Fotoğraf net okunamadı. Bilgileri elle girebilirsiniz.' };
  return { draft };
}
