import type { BankQuestion } from '../lib/types';
import { QUALITY_PRIORITY_NEXT_ITEMS } from './bankQualityPriorityNextItems';
import { QUALITY_FIX_KIND, QUALITY_FIX_META } from './bankQualityFixPack';

export { QUALITY_PRIORITY_NEXT_ITEMS } from './bankQualityPriorityNextItems';

/** Ana banka, 120’lik paket ve qfp paketi ile birleştirilmez. */
export const QUALITY_PRIORITY_NEXT_META = {
  replacesMainBank: false,
  mergedIntoBank: false,
  requiresOwnerApproval: true,
  mainPackSha256: QUALITY_FIX_META.mainPackSha256,
  existingFixPackUntouched: true,
  existingPriorityPackUntouched: true,
  kind: QUALITY_FIX_KIND,
  osymVerifiedExam: false,
} as const;

export const QUALITY_PRIORITY_NEXT_PACK: Record<string, BankQuestion[]> = {};
for (const item of QUALITY_PRIORITY_NEXT_ITEMS) {
  (QUALITY_PRIORITY_NEXT_PACK[item.topic] ||= []).push(item.row);
}

export function flattenQualityPriorityNextPack() {
  return QUALITY_PRIORITY_NEXT_ITEMS.map((x) => ({
    topic: x.topic,
    row: x.row,
    verify: x.verify,
    status: x.status,
    kazanım: x.kazanım,
  }));
}

export function qualityPriorityNextDistribution() {
  const byTopic: Record<string, number> = {};
  const byKazanım: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byVerify: Record<string, number> = {};
  for (const item of QUALITY_PRIORITY_NEXT_ITEMS) {
    byTopic[item.topic] = (byTopic[item.topic] || 0) + 1;
    byKazanım[item.kazanım] = (byKazanım[item.kazanım] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byVerify[item.verify] = (byVerify[item.verify] || 0) + 1;
  }
  return { count: QUALITY_PRIORITY_NEXT_ITEMS.length, byTopic, byKazanım, byStatus, byVerify };
}
