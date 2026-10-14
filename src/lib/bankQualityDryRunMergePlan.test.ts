import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';
import { resolvedQualityPriorityNextItems } from '../data/bankQualityPriorityNextRevisionItems';
import { DRY_RUN_MERGE_META, dryRunQualityMerge } from './bankQualityDryRunMergePlan';
import { MAIN_PACK_SHA256 } from './bankQualityMergePlan';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('kalite paketleri dry-run birleştirme planı (yazım yok)', () => {
  it('BANK’a yazmadan paketleri yeniden hesaplar', () => {
    expect(DRY_RUN_MERGE_META.mergeThisTurn).toBe(false);
    expect(DRY_RUN_MERGE_META.writesBank).toBe(false);
    const resolved = resolvedQualityPriorityNextItems();
    expect(QUALITY_FIX_ITEMS).toHaveLength(120);
    expect(QUALITY_PRIORITY_ITEMS).toHaveLength(31);
    expect(QUALITY_PRIORITY_NEXT_ITEMS).toHaveLength(28);
    expect(resolved).toHaveLength(28);
    const report = dryRunQualityMerge(BANK_PRE_QUALITY_MERGE);
    expect(report.mergeThisTurn).toBe(false);
    expect(report.overlayCheck.revisedIds.sort()).toEqual(
      ['qpn-s1-go-13', 'qpn-s1-go-19', 'qpn-s1-sy-r10', 'qpn-s1-sy-r5', 'qpn-tyt-fn-01', 'qpn-tyt-sy-07'].sort(),
    );
    expect(report.projection.questionsNow).toBe(7007);
    expect(report.projection.questionsAfter).toBe(7007 + report.eligible.add);
    expect(report.eligible.replace + report.eligible.add).toBe(report.eligible.count);
    const nsvInA = report.buckets.A_safe.filter((id) => {
      const c = report.candidates.find((x) => x.id === id);
      return c?.status === 'needs_source_verification' || c?.status === 'needs_human';
    });
    expect(nsvInA).toEqual([]);
    expect(report.buckets.C_human.sort()).toEqual(['qf-8-ink-mm', 'qf-n038'].sort());
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('dryRunQualityMerge');
    expect(MAIN_PACK_SHA256).toBe('734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2');
    console.log('DRY_RUN_TABLE', JSON.stringify(report.tables));
    console.log('DRY_RUN_SEQ', JSON.stringify(report.sequential));
    console.log('DRY_RUN_ELIGIBLE', JSON.stringify(report.eligible));
    console.log('DRY_RUN_BUCKETS', JSON.stringify({
      A: report.buckets.A_safe.length,
      B: report.buckets.B_source.length,
      C: report.buckets.C_human.length,
      D: report.buckets.D_collision_manual.length,
      E: report.buckets.E_do_not_merge.length,
      A_ids: report.buckets.A_safe,
      B_ids: report.buckets.B_source,
      C_ids: report.buckets.C_human,
      D_ids: report.buckets.D_collision_manual,
      E_ids: report.buckets.E_do_not_merge,
    }));
    console.log('DRY_RUN_COLLIDE', JSON.stringify(report.collidingFillers));
    console.log('DRY_RUN_FP', JSON.stringify(report.exactFpHits));
    console.log('DRY_RUN_PROJ', JSON.stringify(report.projection));
    console.log('DRY_RUN_CONCEPT', JSON.stringify(report.conceptualNear.slice(0, 40)));
  });
});
