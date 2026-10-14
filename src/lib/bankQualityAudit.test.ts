import { describe, expect, it } from 'vitest';
import { BANK } from '../data/bankData';
import { auditSummary, crossTopicDupExamples, pickAuditSample } from './bankQualityAudit';

describe('soru bankası otomatik kalite örneklemesi', () => {
  it('bankayı değiştirmeden özet ve 20 çeşitli örnek üretir', () => {
    const before = Object.values(BANK).reduce((n, l) => n + l.length, 0);
    const sum = auditSummary(BANK);
    const sample = pickAuditSample(BANK, 20);
    const after = Object.values(BANK).reduce((n, l) => n + l.length, 0);
    expect(after).toBe(before);
    expect(sum.questions).toBe(7007);
    expect(sum.invalid).toBe(0);
    expect(sample).toHaveLength(20);
    const topics = new Set(sample.map((r) => r.topic));
    expect(topics.size).toBeGreaterThanOrEqual(12);
    expect(sample.some((r) => r.filler)).toBe(true);
    expect(sample.some((r) => !r.filler)).toBe(true);
    expect(sample.every((r) => r.needsHuman)).toBe(true);
    expect(sample.every((r) => r.id && r.stemPrefix)).toBe(true);
    expect(sum.filler).toBe(5537);
    const dups = crossTopicDupExamples(BANK, 5);
    expect(dups.length).toBeGreaterThan(0);
    console.log('BANK_AUDIT_SUMMARY', JSON.stringify(sum));
    console.log('BANK_CROSS_TOPIC_DUP', JSON.stringify(dups.map((d) => ({ size: d.size, filler: d.filler, topics: d.topics, ids: d.ids, stem: d.stemPrefix }))));
    for (const r of sample) {
      console.log(`BANK_AUDIT_ROW id=${r.id} topic=${r.topic} kind=${r.kind || '-'} filler=${r.filler} dup=${r.dupGroupSize} auto=${r.auto} human=yes suspicion=${r.suspicion} stem=${r.stemPrefix}`);
    }
  });
});
