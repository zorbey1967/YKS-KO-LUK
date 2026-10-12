import type { BankManifest, BankQuestion } from './types';
import { BANK, bundledManifest, questionsForLevel } from '../data/bankData';
import { hash32, seededOrder } from './util';

let manifestCache: BankManifest | null = null;
const levelCache = new Map<string, Record<string, BankQuestion[]>>();

export async function loadManifest(): Promise<BankManifest> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch('/bank/manifest.json');
    if (res.ok) {
      manifestCache = (await res.json()) as BankManifest;
      return manifestCache;
    }
  } catch {
    /* bundled fallback */
  }
  manifestCache = bundledManifest();
  return manifestCache;
}

export async function loadLevel(slug: string, levelName: string): Promise<Record<string, BankQuestion[]>> {
  const cacheKey = slug || levelName;
  if (levelCache.has(cacheKey)) return levelCache.get(cacheKey)!;
  try {
    const res = await fetch(`/bank/${slug}.json`);
    if (res.ok) {
      const data = (await res.json()) as Record<string, BankQuestion[]>;
      const shuffled = shuffleBank(data);
      levelCache.set(cacheKey, shuffled);
      return shuffled;
    }
  } catch {
    /* bundled */
  }
  const bundled = shuffleBank(questionsForLevel(levelName));
  levelCache.set(cacheKey, bundled);
  return bundled;
}

export function levelSlug(name: string) {
  return name
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  const topic = (opts.topic || '').toLocaleLowerCase('tr-TR');
  const subject = (opts.subject || '').toLocaleLowerCase('tr-TR');
  const exam = (opts.examHint || '').toLocaleLowerCase('tr-TR');
  const diff = opts.difficulty;
  const limit = Math.min(5, Math.max(1, opts.limit || 1));
  const hits: BankQuestion[] = [];
  for (const [key, list] of Object.entries(BANK)) {
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
  if (!hits.length) return [];
  const order = seededOrder(hits.length, hash32(`${topic}|${subject}|${exam}|${Date.now() % 9973}`));
  return order.slice(0, limit).map((i) => hits[i]);
}
