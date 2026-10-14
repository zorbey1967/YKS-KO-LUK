import { describe, expect, it } from 'vitest';
import { BANK, BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_APPLIED_REPLACEMENTS } from '../data/bankQualityAppliedReplacements';
import { isFillerQuestion } from './bankCoverage';
import { fillerInventory } from './bankQualityInventory';

describe('kalite merge uygulaması (106 replace)', () => {
  it('soru sayısı aynı, filler −106, add/delete yok, filler tekil', () => {
    const before = Object.values(BANK_PRE_QUALITY_MERGE).reduce((n, l) => n + l.length, 0);
    const after = Object.values(BANK).reduce((n, l) => n + l.length, 0);
    expect(QUALITY_APPLIED_REPLACEMENTS).toHaveLength(106);
    expect(before).toBe(7007);
    expect(after).toBe(7007);
    expect(fillerInventory(BANK_PRE_QUALITY_MERGE).filler).toBe(5643);
    expect(fillerInventory(BANK).filler).toBe(5537);
    const fillers = QUALITY_APPLIED_REPLACEMENTS.map((o) => o.target_filler_id);
    expect(new Set(fillers).size).toBe(106);
    const qids = QUALITY_APPLIED_REPLACEMENTS.map((o) => o.quality_id);
    expect(new Set(qids).size).toBe(106);
    for (const op of QUALITY_APPLIED_REPLACEMENTS) {
      const liveTopic = BANK[op.topic] || [];
      const preTopic = BANK_PRE_QUALITY_MERGE[op.topic] || [];
      expect(liveTopic.some((q) => q.id === op.quality_id)).toBe(true);
      expect(liveTopic.some((q) => q.id === op.target_filler_id)).toBe(false);
      expect(preTopic.some((q) => q.id === op.target_filler_id)).toBe(true);
      expect(liveTopic.length).toBe(preTopic.length);
      expect(isFillerQuestion(op.row)).toBe(false);
    }
    expect(qids).not.toContain('qpn-s1-go-13');
    expect(qids).not.toContain('qpn-s1-go-19');
    const overlay = QUALITY_APPLIED_REPLACEMENTS.find((o) => o.quality_id === 'qpn-tyt-sy-07')?.row;
    expect(overlay?.q).toContain('kare karolar');
    expect(overlay?.q).not.toContain('dikdörtgen');
  });
});
