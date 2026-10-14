import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_FIX_META } from '../data/bankQualityFixPack';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_META, qualityPriorityDistribution } from '../data/bankQualityPriorityPack';
import { auditQualityPack } from './bankQualityGateAudit';
import { auditPriorityPack, independentPriorityMath, PRIORITY_TOPICS } from './bankQualityPriorityAudit';
import { MERGE_ROLLBACK_PLAN, MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { sourceAuditSummary } from './bankQualitySourceAudit';
import { isFillerQuestion } from './bankCoverage';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('öncelikli kalite paketi (birleştirme yok)', () => {
  it('120’lik paketi ve 80 güvenli eşlemeyi korur; BANK’a yazılmaz', () => {
    expect(QUALITY_FIX_ITEMS).toHaveLength(120);
    expect(QUALITY_FIX_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_META.existingFixPackUntouched).toBe(true);
    expect(QUALITY_PRIORITY_META.osymVerifiedExam).toBe(false);
    expect(QUALITY_PRIORITY_META.mainPackSha256).toBe(MAIN_PACK_SHA256);
    const audit = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    expect(audit.mappingSafe).toBe(83);
    expect(audit.mappingUnsafe).toHaveLength(37);
    const p = auditPriorityPack(BANK_PRE_QUALITY_MERGE);
    expect(p.existingStillSafe).toBe(80);
    expect(p.existingFixPackCount).toBe(120);
    expect(Object.values(BANK_PRE_QUALITY_MERGE).flat().some((q) => String(q.id).startsWith('qfp-'))).toBe(false);
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('bankQualityPriority');
    expect(bankSrc).not.toContain('QUALITY_PRIORITY');
    const sum = sourceAuditSummary();
    expect(sum.sourceVerified).toBe(13);
    expect(sum.needsSourceVerification).toBe(34);
    expect(sum.needsHuman).toEqual(['qf-n038', 'qf-8-ink-mm']);
    expect(p.programContradictionsKept.sort()).toEqual(['qf-8-fen-p', 'qf-n082', 'qf-n085', 'qf-n097', 'qf-n099'].sort());
    expect(MERGE_ROLLBACK_PLAN.thisTurnCreatedBackup).toBe(false);
  });

  it('yeni maddeler yapı, matematik ve tekrar kapısından geçer', () => {
    const p = auditPriorityPack(BANK_PRE_QUALITY_MERGE);
    expect(p.count).toBe(QUALITY_PRIORITY_ITEMS.length);
    expect(p.count).toBeGreaterThanOrEqual(24);
    expect(p.count).toBeLessThan(40);
    expect(p.structuralFail).toEqual([]);
    expect(p.mathFail).toEqual([]);
    expect(p.exactBank).toEqual([]);
    expect(p.exactOldPack).toEqual([]);
    expect(p.idCollisions).toEqual([]);
    expect(p.byStatus.source_verified).toBe(0);
    expect(p.byStatus.needs_human).toBe(0);
    expect(QUALITY_PRIORITY_ITEMS.every((x) => x.row.kind !== 'osym')).toBe(true);
    expect(QUALITY_PRIORITY_ITEMS.every((x) => !isFillerQuestion(x.row))).toBe(true);
    const math = QUALITY_PRIORITY_ITEMS.filter((x) => x.verify === 'math');
    expect(math.length).toBe(p.mathCount);
    for (const item of math) {
      expect(independentPriorityMath(item).ok, item.row.id).toBe(true);
    }
    for (const t of PRIORITY_TOPICS) {
      expect(QUALITY_PRIORITY_ITEMS.some((x) => x.topic === t), t).toBe(true);
    }
    const dist = qualityPriorityDistribution();
    expect(dist.count).toBe(p.count);
    console.log('PRIORITY_DIST', JSON.stringify(dist));
    console.log('PRIORITY_SPLITS', JSON.stringify(p.splits));
    console.log('PRIORITY_AUDIT', JSON.stringify({
      count: p.count,
      byStatus: p.byStatus,
      mathCount: p.mathCount,
      exactBank: p.exactBank.length,
      exactOldPack: p.exactOldPack.length,
    }));
  });
});
