import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_FIX_META } from '../data/bankQualityFixPack';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_META } from '../data/bankQualityPriorityPack';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';
import { QUALITY_PRIORITY_NEXT_META, qualityPriorityNextDistribution } from '../data/bankQualityPriorityNextPack';
import { auditQualityPack } from './bankQualityGateAudit';
import { auditPriorityNextPack, independentPriorityNextMath } from './bankQualityPriorityNextAudit';
import { PRIORITY_SCOPE_REMEDIATION } from './bankQualityPriorityNextRemediation';
import { MERGE_ROLLBACK_PLAN, MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { sourceAuditSummary } from './bankQualitySourceAudit';
import { isFillerQuestion } from './bankCoverage';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('öncelik sonraki paket (birleştirme yok)', () => {
  it('eski paketleri, qfp’yi ve 80 güvenli eşlemeyi korur', () => {
    expect(QUALITY_FIX_ITEMS).toHaveLength(120);
    expect(QUALITY_PRIORITY_ITEMS).toHaveLength(31);
    expect(QUALITY_FIX_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_NEXT_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_NEXT_META.existingFixPackUntouched).toBe(true);
    expect(QUALITY_PRIORITY_NEXT_META.existingPriorityPackUntouched).toBe(true);
    expect(QUALITY_PRIORITY_NEXT_META.mainPackSha256).toBe(MAIN_PACK_SHA256);
    const audit = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    expect(audit.mappingSafe).toBe(83);
    expect(audit.mappingUnsafe).toHaveLength(37);
    const p = auditPriorityNextPack(BANK_PRE_QUALITY_MERGE);
    expect(p.existingStillSafe).toBe(80);
    expect(p.existingFixPackCount).toBe(120);
    expect(p.existingPriorityCount).toBe(31);
    expect(Object.values(BANK_PRE_QUALITY_MERGE).flat().some((q) => String(q.id).startsWith('qpn-'))).toBe(false);
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('bankQualityPriorityNext');
    expect(bankSrc).not.toContain('QUALITY_PRIORITY_NEXT');
    const qfpSrc = readFileSync(join(root, 'src/data/bankQualityPriorityItems.ts'), 'utf8');
    expect(qfpSrc).toContain('qfp-s1-sz-02');
    expect(qfpSrc).toContain('qfp-s1-go-02');
    expect(qfpSrc).toContain('qfp-s1-ol-01');
    expect(qfpSrc).not.toContain('qpn-');
    const sum = sourceAuditSummary();
    expect(sum.sourceVerified).toBe(13);
    expect(sum.needsSourceVerification).toBe(34);
    expect(MERGE_ROLLBACK_PLAN.thisTurnCreatedBackup).toBe(false);
    expect(PRIORITY_SCOPE_REMEDIATION.map((r) => r.id).sort()).toEqual(
      ['qfp-s1-go-01', 'qfp-s1-go-02', 'qfp-s1-ol-01', 'qfp-s1-sz-02'].sort(),
    );
  });

  it('qpn maddeleri yapı, matematik, parmak izi ve kavramsal kapıdan geçer', () => {
    const p = auditPriorityNextPack(BANK_PRE_QUALITY_MERGE);
    expect(p.count).toBe(28);
    expect(p.structuralFail).toEqual([]);
    expect(p.mathFail).toEqual([]);
    expect(p.exactBank).toEqual([]);
    expect(p.exactOldPack).toEqual([]);
    expect(p.exactQfp).toEqual([]);
    expect(p.idCollisions).toEqual([]);
    expect(p.conceptualBank).toEqual([]);
    expect(p.conceptualPack).toEqual([]);
    expect(p.bannedStems).toEqual([]);
    expect(p.byStatus.source_verified).toBe(0);
    expect(p.byStatus.needs_human).toBe(0);
    expect(p.byStatus.needs_source_verification).toBe(4);
    expect(p.byStatus.machine_ok).toBe(24);
    expect(QUALITY_PRIORITY_NEXT_ITEMS.every((x) => x.row.kind !== 'osym')).toBe(true);
    expect(QUALITY_PRIORITY_NEXT_ITEMS.every((x) => !isFillerQuestion(x.row))).toBe(true);
    expect(QUALITY_PRIORITY_NEXT_ITEMS.every((x) => x.row.id.startsWith('qpn-'))).toBe(true);
    const math = QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.verify === 'math');
    expect(math.length).toBe(p.mathCount);
    expect(math.length).toBe(24);
    for (const item of math) {
      expect(independentPriorityNextMath(item).ok, item.row.id).toBe(true);
    }
    expect(QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.topic === 'YKS TYT|Matematik|Sayılar')).toHaveLength(8);
    expect(QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.topic === 'YKS TYT|Matematik|Fonksiyon')).toHaveLength(4);
    expect(QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => x.topic === 'YKS AYT|Matematik|Fonksiyonlar')).toHaveLength(4);
    const dist = qualityPriorityNextDistribution();
    expect(dist.count).toBe(28);
    expect(dist.byKazanım['T.1.3.11']).toBe(1);
    expect(dist.byKazanım['T.1.3.13']).toBe(1);
    expect(dist.byKazanım['T.1.3.15']).toBe(1);
    expect(dist.byKazanım['T.1.3.19']).toBe(1);
    expect(dist.byKazanım['M.1.1.1.3']).toBe(2);
    expect(dist.byKazanım['M.1.1.1.7']).toBe(1);
    expect(dist.byKazanım['M.1.1.2.3']).toBe(1);
    expect(dist.byKazanım['M.1.1.2.4']).toBe(1);
    expect(dist.byKazanım['M.1.2.1.2']).toBe(1);
    expect(dist.byKazanım['M.1.2.3']).toBe(1);
    expect(dist.byKazanım['M.1.3.1.2']).toBe(1);
    const metreGrade1 = QUALITY_PRIORITY_NEXT_ITEMS.find((x) => x.row.id === 'qpn-s1-ol-ns');
    expect(metreGrade1?.row.o[metreGrade1.row.a]).toBe('Parmak');
    console.log('NEXT_DIST', JSON.stringify(dist));
    console.log('NEXT_AUDIT', JSON.stringify({
      count: p.count,
      byStatus: p.byStatus,
      mathCount: p.mathCount,
      exactBank: p.exactBank.length,
      conceptualBank: p.conceptualBank.length,
      conceptualPack: p.conceptualPack.length,
    }));
  });
});
