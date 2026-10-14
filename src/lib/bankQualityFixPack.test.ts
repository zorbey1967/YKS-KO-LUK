import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK, BANK_PRE_QUALITY_MERGE, CURRICULUM } from '../data/bankData';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import {
  QUALITY_FIX_KIND,
  QUALITY_FIX_MATH,
  QUALITY_FIX_META,
  QUALITY_FIX_PACK,
  flattenQualityFixPack,
  numericOption,
  qualityFixDistribution,
} from '../data/bankQualityFixPack';
import { proposeQualityMerge } from './bankQualityMergePlan';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MAIN_SHA = '734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2';

describe('ayrı kalite düzeltme paketi (ana bankayı değiştirmez)', () => {
  it('ana BANK 7007 kalır; pack.json birleştirilmez', () => {
    const n = Object.values(BANK).reduce((a, l) => a + l.length, 0);
    expect(n).toBe(7007);
    expect(QUALITY_FIX_META.replacesMainBank).toBe(false);
    expect(QUALITY_FIX_META.mergedIntoBank).toBe(false);
    expect(QUALITY_FIX_META.requiresOwnerApproval).toBe(true);
    expect(QUALITY_FIX_META.mainPackSha256).toBe(MAIN_SHA);
    const bankData = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankData).not.toContain('QUALITY_FIX_PACK');
    expect(bankData).not.toContain('bankQualityFixPack');
    expect(bankData).not.toContain('bankQualityFixItems');
    expect(Object.values(BANK_PRE_QUALITY_MERGE).flat().some((q) => String(q.id).startsWith('qf-'))).toBe(false);
  });

  it('en az 100 özgün soru; şablon/osym yok; id ve parmak izi tek; matematik anahtarı sayısal', () => {
    const rows = flattenQualityFixPack();
    expect(rows.length).toBeGreaterThanOrEqual(100);
    const ids = new Set<string>();
    const fps = new Set<string>();
    const curriculumKeys = new Set(
      Object.entries(CURRICULUM).flatMap(([lv, subs]) =>
        Object.entries(subs).flatMap(([su, ts]) => ts.map((t) => `${lv}|${su}|${t}`)),
      ),
    );
    for (const { topic, row, verify } of rows) {
      expect(curriculumKeys.has(topic) || Boolean(BANK[topic]), topic).toBe(true);
      expect(isValidQuestion(row), row.id).toBe(true);
      expect(isFillerQuestion(row), row.id).toBe(false);
      expect(row.kind).toBe(QUALITY_FIX_KIND);
      expect(row.kind).not.toBe('osym');
      expect(ids.has(row.id), row.id).toBe(false);
      ids.add(row.id);
      const fp = questionFingerprint(row);
      expect(fps.has(fp), row.id).toBe(false);
      fps.add(fp);
      expect(row.o).toHaveLength(5);
      expect(verify).not.toBeUndefined();
    }
    expect(QUALITY_FIX_MATH.length).toBeGreaterThanOrEqual(50);
    const byId = Object.fromEntries(rows.map((r) => [r.row.id, r.row]));
    expect(7 + 5).toBe(12);
    expect(2 ** 5).toBe(32);
    expect(80 * 0.2).toBe(16);
    for (const m of QUALITY_FIX_MATH) {
      const row = byId[m.id];
      expect(row, m.id).toBeTruthy();
      expect(numericOption(row), m.id).toBeCloseTo(m.expected, 8);
    }
    const dist = qualityFixDistribution();
    expect(Object.keys(QUALITY_FIX_PACK).length).toBeGreaterThan(20);
    expect(dist.count).toBe(rows.length);
    console.log('QUALITY_FIX_DIST', JSON.stringify(dist));
  });

  it('birleştirme planı onaysız uygulanmaz; çakışma yok; doldurma eşlemesi üretir', () => {
    const plan = proposeQualityMerge(BANK_PRE_QUALITY_MERGE);
    expect(plan.mergedIntoBank).toBe(false);
    expect(plan.requiresOwnerApproval).toBe(true);
    expect(plan.bankCount).toBe(7007);
    expect(plan.packCount).toBeGreaterThanOrEqual(100);
    expect(plan.idCollisions).toEqual([]);
    expect(plan.unknownTopics).toEqual([]);
    expect(plan.packFpDup).toBe(0);
    expect(plan.invalid).toEqual([]);
    expect(plan.replaceFiller).toBeGreaterThan(40);
    expect(Object.values(BANK).reduce((n, l) => n + l.length, 0)).toBe(7007);
    console.log('QUALITY_MERGE_PREVIEW', JSON.stringify({
      bankCount: plan.bankCount,
      packCount: plan.packCount,
      replaceFiller: plan.replaceFiller,
      addOnly: plan.addOnly,
      projectedIfReplace: plan.projectedBankCountIfReplaceOnly,
      sample: plan.replacements.slice(0, 8),
    }));
  });
});
