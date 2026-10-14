import type { BankQuestion } from '../lib/types';
import { QUALITY_FIX_ITEMS, QUALITY_FIX_KIND } from './bankQualityFixItems';

export { QUALITY_FIX_ITEMS, QUALITY_FIX_KIND };
export type { QualityFixItem } from './bankQualityFixItems';

/** Ana 7007’lik paketle birleştirilmez. Hash/içerik korunur. ÖSYM etiketi yok. */
export const QUALITY_FIX_META = {
  replacesMainBank: false,
  mergedIntoBank: false,
  requiresOwnerApproval: true,
  mainPackSha256: '734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2',
  kind: QUALITY_FIX_KIND,
} as const;

export const QUALITY_FIX_PACK: Record<string, BankQuestion[]> = {};
for (const item of QUALITY_FIX_ITEMS) {
  (QUALITY_FIX_PACK[item.topic] ||= []).push(item.row);
}

export const QUALITY_FIX_MATH = QUALITY_FIX_ITEMS.filter((x) => x.verify === 'math' && typeof x.expected === 'number').map((x) => ({
  id: x.row.id,
  expected: x.expected as number,
}));

export function flattenQualityFixPack() {
  return QUALITY_FIX_ITEMS.map((x) => ({ topic: x.topic, row: x.row, verify: x.verify, status: x.status }));
}

export function numericOption(row: BankQuestion) {
  const s = String(row.o[row.a] || '').replace(/[−–]/g, '-').replace(',', '.').trim();
  const frac = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const raw = s.match(/-?\d+(\.\d+)?/g);
  if (!raw?.length) return NaN;
  return Number(raw[raw.length - 1]);
}

export function qualityFixDistribution() {
  const byLevel: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const byVerify: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of QUALITY_FIX_ITEMS) {
    const [level, subject] = item.topic.split('|');
    byLevel[level] = (byLevel[level] || 0) + 1;
    bySubject[subject] = (bySubject[subject] || 0) + 1;
    byVerify[item.verify] = (byVerify[item.verify] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }
  return { count: QUALITY_FIX_ITEMS.length, byLevel, bySubject, byVerify, byStatus };
}
