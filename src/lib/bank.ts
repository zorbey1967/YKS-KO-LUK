import type { BankManifest, BankQuestion } from './types';
import { hash32, seededOrder } from './util';
import { isSupabaseConfigured, supabase } from './supabase';
import { QUESTION_BANK_ENABLED } from './features';
import { slugifyLevel } from '../../supabase/functions/_shared/bankPackSchema.ts';

let manifestCache: BankManifest | null = null;
const levelCache = new Map<string, Record<string, BankQuestion[]>>();

/** Bayrak kapalıyken hiçbir yerden paket veya edge yüklenmez. */
function closedManifest(): BankManifest {
  return { version: 0, generatedAt: '', questionCount: 0, levels: [], curriculum: {} };
}

function packErrorText(e: unknown) {
  if (e == null) return '';
  if (typeof e === 'string') return e.trim();
  if (e instanceof Error) return e.message.trim();
  if (typeof e === 'object' && 'message' in e) return String((e as { message?: unknown }).message || '').trim();
  return String(e).trim();
}

async function invokeBankPack(body: Record<string, unknown>) {
  if (!supabase || !isSupabaseConfigured()) return { error: 'config', data: null as Record<string, unknown> | null };
  const { data, error } = await supabase.functions.invoke('bank-pack', { body });
  const payload = (data && typeof data === 'object') ? data as Record<string, unknown> : null;
  if (error) return { error: packErrorText(error) || 'bank-pack çağrısı başarısız', data: payload };
  if (payload && payload.ok === false) return { error: packErrorText(payload.error) || 'Soru paketi reddedildi.', data: payload };
  return { error: null as string | null, data: payload };
}

/**
 * Sorular yalnızca bank-pack edge’inden (oturum + üyelik kapısı) gelir.
 * İstemci paketine soru verisi gömülmez; edge reddederse yerel yedek yoktur.
 */
export async function loadManifest(): Promise<BankManifest> {
  if (!QUESTION_BANK_ENABLED) return closedManifest();
  if (manifestCache) return manifestCache;
  const remote = await invokeBankPack({ action: 'manifest' });
  const man = remote.data?.manifest;
  if (man && typeof man === 'object') {
    manifestCache = man as BankManifest;
    return manifestCache;
  }
  throw new Error(remote.error || 'Soru paketi alınamadı.');
}

export async function loadLevel(slug: string, levelName: string): Promise<Record<string, BankQuestion[]>> {
  if (!QUESTION_BANK_ENABLED) return {};
  const cacheKey = slug || levelName;
  if (levelCache.has(cacheKey)) return levelCache.get(cacheKey)!;
  const remote = await invokeBankPack({ action: 'level', slug, level: levelName });
  const pack = remote.data?.questions;
  if (pack && typeof pack === 'object') {
    const shuffled = shuffleBank(pack as Record<string, BankQuestion[]>);
    levelCache.set(cacheKey, shuffled);
    return shuffled;
  }
  throw new Error(remote.error || `${levelName} soruları alınamadı.`);
}

export function levelSlug(name: string) {
  return slugifyLevel(name);
}

function shuffleBank(data: Record<string, BankQuestion[]>) {
  const out: Record<string, BankQuestion[]> = {};
  for (const [key, list] of Object.entries(data)) {
    out[key] = (list || []).map((q) => shuffleQuestion({ ...q, _bankKey: key }));
  }
  return out;
}

function shuffleQuestion(q: BankQuestion): BankQuestion {
  if (!Array.isArray(q.o) || q.o.length < 2) return q;
  const old = Number.isInteger(q.a) ? q.a : 0;
  const order = seededOrder(q.o.length, hash32(`${q.id}|${q.q}`));
  return { ...q, o: order.map((i) => q.o[i]), a: Math.max(0, order.indexOf(old)) };
}

export function topicKey(level: string, subject: string, topic: string) {
  return `${level}|${subject}|${topic}`;
}

export function flattenBank(data: Record<string, BankQuestion[]>) {
  return Object.values(data).flat();
}

export function topicCountOf(counts: Record<string, number> | undefined, level: string, subject: string, topic: string) {
  return counts?.[topicKey(level, subject, topic)] || 0;
}

export function pickSeries(list: BankQuestion[], n: number, seed: number) {
  if (!list.length || n <= 0) return [];
  const cap = Math.min(n, list.length);
  return seededOrder(list.length, seed).slice(0, cap).map((i) => list[i]);
}

export function findBankQuestions(opts: {
  topic?: string;
  subject?: string;
  difficulty?: string;
  examHint?: string;
  limit?: number;
}): BankQuestion[] {
  if (!QUESTION_BANK_ENABLED) return [];
  const topic = (opts.topic || '').toLocaleLowerCase('tr-TR');
  const subject = (opts.subject || '').toLocaleLowerCase('tr-TR');
  const exam = (opts.examHint || '').toLocaleLowerCase('tr-TR');
  const diff = opts.difficulty;
  const limit = Math.min(5, Math.max(1, opts.limit || 1));
  const hits: BankQuestion[] = [];
  for (const data of levelCache.values()) {
    for (const [key, list] of Object.entries(data)) {
      const k = key.toLocaleLowerCase('tr-TR');
      if (exam.includes('ayt') && !k.includes('ayt')) continue;
      if (exam.includes('tyt') && !k.includes('tyt')) continue;
      if (exam.includes('lgs') && !k.includes('8. sınıf') && !k.includes('lgs')) continue;
      if (exam.includes('kpss') && !k.includes('kpss')) continue;
      if (subject && !k.includes(subject)) continue;
      if (topic && !k.includes(topic)) continue;
      for (const item of list) {
        if (diff && (item.difficulty || 'Orta') !== diff) continue;
        hits.push({ ...item, _bankKey: key });
      }
    }
  }
  if (!hits.length) return [];
  const order = seededOrder(hits.length, hash32(`${topic}|${subject}|${exam}|${Date.now() % 9973}`));
  return order.slice(0, limit).map((i) => hits[i]);
}
