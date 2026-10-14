import type { BankQuestion } from '../lib/types';
import { QUALITY_PRIORITY_ITEMS } from './bankQualityPriorityItems';
import { QUALITY_FIX_KIND, QUALITY_FIX_META } from './bankQualityFixPack';

export { QUALITY_PRIORITY_ITEMS } from './bankQualityPriorityItems';

/** Ana banka ve 120’lik QUALITY_FIX_PACK ile birleştirilmez. */
export const QUALITY_PRIORITY_META = {
  replacesMainBank: false,
  mergedIntoBank: false,
  requiresOwnerApproval: true,
  mainPackSha256: QUALITY_FIX_META.mainPackSha256,
  existingFixPackUntouched: true,
  kind: QUALITY_FIX_KIND,
  osymVerifiedExam: false,
} as const;

export const QUALITY_PRIORITY_PACK: Record<string, BankQuestion[]> = {};
for (const item of QUALITY_PRIORITY_ITEMS) {
  (QUALITY_PRIORITY_PACK[item.topic] ||= []).push(item.row);
}

export function flattenQualityPriorityPack() {
  return QUALITY_PRIORITY_ITEMS.map((x) => ({ topic: x.topic, row: x.row, verify: x.verify, status: x.status }));
}

export function qualityPriorityDistribution() {
  const byTopic: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byVerify: Record<string, number> = {};
  for (const item of QUALITY_PRIORITY_ITEMS) {
    byTopic[item.topic] = (byTopic[item.topic] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byVerify[item.verify] = (byVerify[item.verify] || 0) + 1;
  }
  return { count: QUALITY_PRIORITY_ITEMS.length, byTopic, byStatus, byVerify };
}
