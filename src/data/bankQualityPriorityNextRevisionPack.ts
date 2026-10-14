import type { BankQuestion } from '../lib/types';
import { QUALITY_FIX_KIND, QUALITY_FIX_META } from './bankQualityFixPack';
import {
  QUALITY_PRIORITY_NEXT_REVISION_ITEMS,
  QPN_REVISE_IDS,
  resolvedQualityPriorityNextItems,
} from './bankQualityPriorityNextRevisionItems';

export {
  QUALITY_PRIORITY_NEXT_REVISION_ITEMS,
  QPN_REVISE_IDS,
  resolvedQualityPriorityNextItems,
} from './bankQualityPriorityNextRevisionItems';

export const QUALITY_PRIORITY_NEXT_REVISION_META = {
  replacesMainBank: false,
  mergedIntoBank: false,
  overlaysOriginalQpn: true,
  originalQpnItemsUntouched: true,
  requiresOwnerApproval: true,
  mainPackSha256: QUALITY_FIX_META.mainPackSha256,
  kind: QUALITY_FIX_KIND,
  osymVerifiedExam: false,
  reviseCount: QPN_REVISE_IDS.length,
} as const;

export const QUALITY_PRIORITY_NEXT_REVISION_PACK: Record<string, BankQuestion[]> = {};
for (const item of resolvedQualityPriorityNextItems()) {
  (QUALITY_PRIORITY_NEXT_REVISION_PACK[item.topic] ||= []).push(item.row);
}

export function qualityPriorityNextRevisionDistribution() {
  const resolved = resolvedQualityPriorityNextItems();
  const byStatus: Record<string, number> = {};
  for (const item of resolved) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }
  return {
    count: resolved.length,
    reviseCount: QUALITY_PRIORITY_NEXT_REVISION_ITEMS.length,
    byStatus,
  };
}
