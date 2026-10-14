import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';
import { QUALITY_PRIORITY_NEXT_META } from '../data/bankQualityPriorityNextPack';
import { QPN_SECOND_REVIEW, QPN_SECOND_REVIEW_META, qpnSecondReviewSummary } from './bankQualityPriorityNextReview';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { auditQualityPack } from './bankQualityGateAudit';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('QPN ikinci denetim (pakete yazılmaz)', () => {
  it('28 maddeyi kapsar; source_verified ve exclude yok; pakete uygulanmaz', () => {
    expect(QPN_SECOND_REVIEW).toHaveLength(QUALITY_PRIORITY_NEXT_ITEMS.length);
    expect(QPN_SECOND_REVIEW).toHaveLength(28);
    expect(QPN_SECOND_REVIEW.map((r) => r.id).sort()).toEqual(QUALITY_PRIORITY_NEXT_ITEMS.map((x) => x.row.id).sort());
    expect(QPN_SECOND_REVIEW_META.appliedToPack).toBe(false);
    expect(QPN_SECOND_REVIEW_META.mergedIntoBank).toBe(false);
    expect(QPN_SECOND_REVIEW_META.mainPackSha256).toBe(MAIN_PACK_SHA256);
    const sum = qpnSecondReviewSummary();
    expect(sum.appliedToPack).toBe(false);
    expect(sum.sourceVerifiedClaimed).toBe(0);
    expect(sum.excludeIds).toEqual([]);
    expect(sum.verdict.revise).toBe(6);
    expect(sum.reviseIds.sort()).toEqual(
      ['qpn-s1-go-13', 'qpn-s1-go-19', 'qpn-s1-sy-r10', 'qpn-s1-sy-r5', 'qpn-tyt-fn-01', 'qpn-tyt-sy-07'].sort(),
    );
    expect(QPN_SECOND_REVIEW.every((r) => r.verdict !== 'exclude')).toBe(true);
    const tr = ['qpn-s1-sz-11', 'qpn-s1-go-13', 'qpn-s1-km-15', 'qpn-s1-go-19'];
    for (const id of tr) {
      expect(QPN_SECOND_REVIEW.find((r) => r.id === id)?.sourceStatus).toBe('needs_source_verification');
    }
    console.log('QPN_REVIEW_SUMMARY', JSON.stringify(sum));
  });

  it('QPN, qfp, 120’lik paket ve BANK dosyaları bu turda üzerine yazılmaz', () => {
    expect(QUALITY_PRIORITY_NEXT_ITEMS).toHaveLength(28);
    expect(QUALITY_PRIORITY_NEXT_META.mergedIntoBank).toBe(false);
    expect(QUALITY_FIX_ITEMS).toHaveLength(120);
    expect(QUALITY_PRIORITY_ITEMS).toHaveLength(31);
    const gate = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    expect(gate.mappingSafe).toBe(83);
    expect(gate.mappingUnsafe).toHaveLength(37);
    expect(Object.values(BANK_PRE_QUALITY_MERGE).flat().some((q) => String(q.id).startsWith('qpn-'))).toBe(false);
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('bankQualityPriorityNext');
    expect(bankSrc).not.toContain('QPN_SECOND_REVIEW');
    const items = readFileSync(join(root, 'src/data/bankQualityPriorityNextItems.ts'), 'utf8');
    expect(items).toContain('qpn-tyt-sy-07');
    expect(items).toContain('en küçük kareye boşluksuz');
    expect(items).toContain('qpn-s1-sy-r5');
    expect(items).toContain("'25'");
  });
});
