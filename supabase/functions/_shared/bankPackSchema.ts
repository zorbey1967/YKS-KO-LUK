/** bank-pack JSON sözleşmesi. İstemci Vite paketine gömülmez. */

export const BANK_PACK_SCHEMA = "yks-bank-pack-v7";
export const BANK_PACK_VERSION = 7;

export type BankPackQuestion = {
  id: string;
  q: string;
  o: string[];
  a: number;
  e: string;
  difficulty?: string;
  kind?: string;
};

export type BankPackManifest = {
  version: number;
  generatedAt: string;
  questionCount: number;
  levels: { name: string; slug: string; subjects: number; topics: number }[];
  curriculum: Record<string, Record<string, string[]>>;
  topicCounts: Record<string, number>;
};

export type BankPackFile = {
  schema: string;
  version: number;
  generatedAt: string;
  source: string;
  manifest: BankPackManifest;
  levels: Record<string, { name: string; questions: Record<string, BankPackQuestion[]> }>;
};

export function slugifyLevel(name: string) {
  return String(name)
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isBankPackQuestion(row: unknown): row is BankPackQuestion {
  if (!row || typeof row !== "object") return false;
  const q = row as Record<string, unknown>;
  if (typeof q.id !== "string" || !q.id) return false;
  if (typeof q.q !== "string" || !q.q) return false;
  if (!Array.isArray(q.o) || q.o.length < 2 || q.o.some((x) => typeof x !== "string")) return false;
  if (!Number.isInteger(q.a) || Number(q.a) < 0 || Number(q.a) >= q.o.length) return false;
  if (typeof q.e !== "string" || !String(q.e).trim()) return false;
  return true;
}

export function parseBankPack(raw: unknown): BankPackFile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.schema !== BANK_PACK_SCHEMA) return null;
  if (p.version !== BANK_PACK_VERSION) return null;
  if (!p.manifest || typeof p.manifest !== "object") return null;
  if (!p.levels || typeof p.levels !== "object") return null;
  const man = p.manifest as BankPackManifest;
  if (!Array.isArray(man.levels) || typeof man.questionCount !== "number") return null;
  return p as unknown as BankPackFile;
}

export function questionsForPackLevel(pack: BankPackFile, slug: string, levelName: string) {
  const bySlug = pack.levels[slug];
  if (bySlug?.questions) return bySlug.questions;
  const key = Object.keys(pack.levels).find((s) => pack.levels[s].name === levelName);
  return key ? pack.levels[key].questions : null;
}
