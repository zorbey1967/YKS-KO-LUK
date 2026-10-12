import type { BankQuestion } from '../lib/types';

export function questionFingerprint(q: BankQuestion) {
  const stem = q.q.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  const opts = [...(q.o || [])].map((o) => o.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()).sort().join('||');
  const ans = String(q.o?.[q.a] || '');
  return `${stem}@@${opts}@@${ans}`;
}

export function isValidQuestion(q: BankQuestion) {
  if (!q?.id || !q.q || !Array.isArray(q.o) || q.o.length < 2) return false;
  if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) return false;
  if (new Set(q.o.map((o) => o.trim())).size !== q.o.length) return false;
  if (!String(q.e || '').trim()) return false;
  return true;
}

export function dedupeBank(bank: Record<string, BankQuestion[]>) {
  const out: Record<string, BankQuestion[]> = {};
  for (const [key, list] of Object.entries(bank)) {
    const seen = new Set<string>();
    const ids = new Set<string>();
    const rows: BankQuestion[] = [];
    for (const item of list || []) {
      if (!isValidQuestion(item) || ids.has(item.id)) continue;
      const fp = questionFingerprint(item);
      if (seen.has(fp)) continue;
      seen.add(fp);
      ids.add(item.id);
      rows.push(item);
    }
    if (rows.length) out[key] = rows;
  }
  return out;
}
