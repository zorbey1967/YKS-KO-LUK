import type { BankQuestion } from '../lib/types';
import { q } from './bankQ';
import { hash32 } from '../lib/util';

/** Tek satırlık, elle düzenlenen soru. a = doğru şık (0=A … 4=E). */
export type SimpleQ = {
  level: string;
  subject: string;
  topic: string;
  q: string;
  o: [string, string, string, string, string];
  a: number;
  e: string;
  d?: 'Kolay' | 'Orta' | 'Zor';
};

export function bankKey(level: string, subject: string, topic: string) {
  return `${level}|${subject}|${topic}`;
}

export function simpleId(row: SimpleQ, i: number) {
  return `os-${hash32(`${row.level}|${row.subject}|${row.topic}|${row.q}|${i}`).toString(16)}`;
}

/** SimpleQ[] → BANK map. Yeni soru eklemek için diziye satır yeter. */
export function compileSimple(rows: SimpleQ[]): Record<string, BankQuestion[]> {
  const out: Record<string, BankQuestion[]> = {};
  rows.forEach((row, i) => {
    if (row.a < 0 || row.a > 4) return;
    const key = bankKey(row.level, row.subject, row.topic);
    const item = q(simpleId(row, i), row.q, row.o, row.a, row.e, row.d || 'Orta', 'osym');
    (out[key] ||= []).push(item);
  });
  return out;
}

export function mergeSimple(
  bank: Record<string, BankQuestion[]>,
  extra: Record<string, BankQuestion[]>,
): Record<string, BankQuestion[]> {
  const out: Record<string, BankQuestion[]> = { ...bank };
  for (const [key, list] of Object.entries(extra)) {
    out[key] = [...(out[key] || []), ...list];
  }
  return out;
}
