import type { BankManifest, BankQuestion } from './types';
import { bundledManifest, questionsForLevel } from '../data/bankData';
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
