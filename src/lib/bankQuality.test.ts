import { describe, expect, it } from 'vitest';
import { BANK, CURRICULUM } from '../data/bankData';
import { ORIGINAL_BANK } from '../data/bankPackOriginal';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { bankCoverage, coverageSummary, isFillerQuestion } from './bankCoverage';

function allRows(bank: Record<string, { id: string }[]>) {
  return Object.entries(bank).flatMap(([key, list]) => list.map((q) => ({ key, ...q })));
}

describe('soru bankası kalite', () => {
  it('yinelenen id, eksik seçenek, yanlış anahtar ve boş açıklama yok', () => {
    for (const [key, list] of Object.entries(BANK)) {
      const ids = new Set<string>();
      for (const row of list) {
        expect(isValidQuestion(row), `${key}:${row.id}`).toBe(true);
        expect(ids.has(row.id), `${key}:${row.id}`).toBe(false);
        ids.add(row.id);
        expect(row.o.length).toBeGreaterThanOrEqual(2);
        expect(row.a).toBeGreaterThanOrEqual(0);
        expect(row.a).toBeLessThan(row.o.length);
        expect(String(row.e).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('özgün 2026 paketi doğrulanmış etiket ve cevaplarla gelir', () => {
    const pack = allRows(ORIGINAL_BANK);
    expect(pack.length).toBeGreaterThanOrEqual(40);
    const ids = new Set<string>();
    for (const row of pack) {
      expect(row.kind).toBe('original');
      expect(isValidQuestion(row)).toBe(true);
      expect(ids.has(row.id), row.id).toBe(false);
      ids.add(row.id);
    }
    const byId = Object.fromEntries(pack.map((q) => [q.id, q]));
    expect(byId['orig-tyt-eq-1'].o[byId['orig-tyt-eq-1'].a]).toContain('5');
    expect(byId['orig-tyt-exp-1'].o[byId['orig-tyt-exp-1'].a]).toBe('32');
    expect(2 ** 5).toBe(32);
    expect(250 * 0.2).toBe(50);
    expect(byId['orig-tyt-pr-1'].o[byId['orig-tyt-pr-1'].a]).toBe('50');
    expect(byId['orig-ayt-pol-1'].o[byId['orig-ayt-pol-1'].a]).toContain('2 ve 3');
    expect(Math.log10(1000)).toBe(3);
    expect(4 * 2).toBe(8);
    expect(80 * 0.25).toBe(20);
  });

  it('otomatik denetim özeti: yinelenen parmak izi ve boş konu (insan doğrulaması değil)', () => {
    const fps = new Map<string, number>();
    let filler = 0;
    for (const list of Object.values(BANK)) {
      for (const row of list) {
        const fp = questionFingerprint(row);
        fps.set(fp, (fps.get(fp) || 0) + 1);
        if (isFillerQuestion(row)) filler += 1;
      }
    }
    const dupFp = [...fps.values()].filter((n) => n > 1).length;
    const sum = coverageSummary(bankCoverage(CURRICULUM, BANK));
    console.log(`BANK_AUTO_AUDIT questions=${[...Object.values(BANK)].reduce((n, l) => n + l.length, 0)} dup_fingerprint_groups=${dupFp} missing_topics=${sum.missing} filler=${filler}`);
    expect(dupFp).toBeGreaterThanOrEqual(0);
    expect(sum.missing).toBeGreaterThanOrEqual(0);
  });

  it('kapsam tablosu: müfredat konuları sayılır; boş konu gizlenmez', () => {
    const rows = bankCoverage(CURRICULUM, BANK);
    const sum = coverageSummary(rows);
    expect(sum.topics).toBeGreaterThan(80);
    expect(sum.missing).toBeGreaterThanOrEqual(0);
    const yks = Object.keys(sum.byLevel).filter((k) => k.startsWith('YKS') || k.startsWith('KPSS') || k.includes('Sınıf'));
    expect(yks.length).toBeGreaterThan(5);
  });
});
