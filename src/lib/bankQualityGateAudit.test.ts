import { describe, expect, it } from 'vitest';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_FIX_META } from '../data/bankQualityFixPack';
import { auditQualityPack, independentMathValue } from './bankQualityGateAudit';

describe('kalite paketi birleştirme öncesi kapı denetimi', () => {
  it('71 matematiği expected olmadan doğrular; needs_human doğrulanmış sayılmaz; BANK_PRE_QUALITY_MERGE değişmez', () => {
    const before = Object.values(BANK_PRE_QUALITY_MERGE).reduce((n, l) => n + l.length, 0);
    const audit = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    const after = Object.values(BANK_PRE_QUALITY_MERGE).reduce((n, l) => n + l.length, 0);
    expect(after).toBe(before);
    expect(before).toBe(7007);
    expect(QUALITY_FIX_META.mergedIntoBank).toBe(false);
    expect(audit.total).toBe(120);
    expect(audit.mathCount).toBe(71);
    expect(audit.mathFail).toEqual([]);
    expect(audit.mathIndependentOk).toBe(71);
    expect(audit.structuralFail).toEqual([]);
    expect(audit.sourceCitedFetched).toBe(13);
    expect(audit.sourceCitedCount).toBe(13);
    expect(audit.needsSourceVerification).toHaveLength(34);
    expect(audit.needsHuman.sort()).toEqual(['qf-8-ink-mm', 'qf-n038']);
    for (const id of audit.needsHuman) {
      const item = QUALITY_FIX_ITEMS.find((x) => x.row.id === id);
      expect(item?.status).toBe('needs_human');
      expect(item?.verify).not.toBe('math');
    }
    const mathItems = QUALITY_FIX_ITEMS.filter((x) => x.verify === 'math');
    expect(mathItems).toHaveLength(71);
    for (const item of mathItems) {
      expect(independentMathValue(item).ok, item.row.id).toBe(true);
    }
    expect(audit.replaceFiller).toBe(116);
    expect(audit.addOnly).toBe(4);
    expect(audit.mappingSafe).toBe(83);
    expect(audit.mappingUnsafe.length).toBe(37);
    expect(audit.exactBankOverlap).toEqual([]);
    expect(audit.topicsGrowing.sort((a, b) => a.topic.localeCompare(b.topic))).toEqual([
      { topic: '8. Sınıf|Fen|Basınç', before: 23, after: 25, delta: 2 },
      { topic: '8. Sınıf|Matematik|Üslü ifadeler', before: 53, after: 54, delta: 1 },
      { topic: 'YKS TYT|Türkçe|Paragraf', before: 13, after: 14, delta: 1 },
    ]);
    console.log('QUALITY_GATE_AUDIT', JSON.stringify({
      total: audit.total,
      mathIndependentOk: audit.mathIndependentOk,
      sourceCited: audit.sourceCitedCount,
      sourceFetched: audit.sourceCitedFetched,
      needsHuman: audit.needsHuman,
      mappingSafe: audit.mappingSafe,
      mappingUnsafeCount: audit.mappingUnsafe.length,
      topicsGrowing: audit.topicsGrowing,
      unsafeFlags: [...new Set(audit.mappingUnsafe.flatMap((m) => m.flags))],
      overlap: audit.exactBankOverlap.length,
      projectedCount: audit.projectedCount,
      allChecksPassCount: audit.allChecksPassCount,
    }));
    console.log('QUALITY_UNSAFE_MAP', JSON.stringify(audit.mappingUnsafe.map((m) => ({
      topic: m.topic, drop: m.dropFillerId, add: m.addQualityId, action: m.action, flags: m.flags,
    }))));
  });
});
