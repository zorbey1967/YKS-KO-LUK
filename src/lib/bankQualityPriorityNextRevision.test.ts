import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_PRIORITY_ITEMS } from '../data/bankQualityPriorityItems';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';
import {
  QUALITY_PRIORITY_NEXT_REVISION_ITEMS,
  QPN_REVISE_IDS,
  resolvedQualityPriorityNextItems,
} from '../data/bankQualityPriorityNextRevisionItems';
import { QUALITY_PRIORITY_NEXT_REVISION_META } from '../data/bankQualityPriorityNextRevisionPack';
import { auditPriorityNextRevision, independentRevisionMath } from './bankQualityPriorityNextRevisionAudit';
import { auditQualityPack } from './bankQualityGateAudit';
import { MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { isFillerQuestion } from './bankCoverage';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('QPN revision overlay (orijinal QPN yazılmaz)', () => {
  it('orijinal 28’i ve diğer paketleri korur; BANK’a yazılmaz', () => {
    expect(QUALITY_PRIORITY_NEXT_ITEMS).toHaveLength(28);
    expect(QUALITY_PRIORITY_NEXT_REVISION_ITEMS).toHaveLength(6);
    expect(QUALITY_FIX_ITEMS).toHaveLength(120);
    expect(QUALITY_PRIORITY_ITEMS).toHaveLength(31);
    expect(QUALITY_PRIORITY_NEXT_REVISION_META.mergedIntoBank).toBe(false);
    expect(QUALITY_PRIORITY_NEXT_REVISION_META.originalQpnItemsUntouched).toBe(true);
    expect(QUALITY_PRIORITY_NEXT_REVISION_META.mainPackSha256).toBe(MAIN_PACK_SHA256);
    const gate = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    expect(gate.mappingSafe).toBe(83);
    expect(gate.mappingUnsafe).toHaveLength(37);
    const orig = readFileSync(join(root, 'src/data/bankQualityPriorityNextItems.ts'), 'utf8');
    expect(orig).toContain('en küçük kareye boşluksuz');
    expect(orig).toContain('Grafikten f(4)');
    expect(orig).toContain("'25'");
    expect(orig).toContain("'30'");
    expect(orig).toContain('Resim: Bir çocuk');
    expect(orig).toContain('Yeşil ışıkta geçileceğini');
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('Revision');
    expect(bankSrc).not.toContain('bankQualityPriorityNext');
    expect(Object.values(BANK_PRE_QUALITY_MERGE).flat().some((q) => String(q.id).startsWith('qpn-'))).toBe(false);
  });

  it('çözümlenmiş 28: altı revise düzelir, 22 keep aynı nesnedir', () => {
    const resolved = resolvedQualityPriorityNextItems();
    expect(resolved).toHaveLength(28);
    expect([...QPN_REVISE_IDS]).toHaveLength(6);
    const p = auditPriorityNextRevision(BANK_PRE_QUALITY_MERGE);
    expect(p.structuralFail).toEqual([]);
    expect(p.mathFail).toEqual([]);
    expect(p.exactBank).toEqual([]);
    expect(p.exactOld).toEqual([]);
    expect(p.exactQfp).toEqual([]);
    expect(p.exactKeepQpn).toEqual([]);
    expect(p.keepSame).toBe(true);
    expect(p.pretendVisual).toBe(false);
    expect(p.go13Status).toBe('needs_source_verification');
    expect(p.go19Status).toBe('needs_source_verification');
    expect(resolved.every((x) => x.row.kind !== 'osym')).toBe(true);
    expect(resolved.every((x) => !isFillerQuestion(x.row))).toBe(true);
    expect(resolved.every((x) => x.status !== 'source_verified')).toBe(true);
    for (const item of QUALITY_PRIORITY_NEXT_REVISION_ITEMS) {
      expect(independentRevisionMath(item).ok, item.row.id).toBe(true);
      expect(item.row.o).toHaveLength(5);
    }
    const sy07 = resolved.find((x) => x.row.id === 'qpn-tyt-sy-07')!;
    expect(sy07.row.o[sy07.row.a]).toBe('24');
    expect(sy07.row.q).toContain('kare karolar');
    expect(sy07.row.q).toContain('kare zemin');
    const fn01 = resolved.find((x) => x.row.id === 'qpn-tyt-fn-01')!;
    expect(fn01.row.o[fn01.row.a]).toBe('−6');
    expect(fn01.row.q.toLocaleLowerCase('tr-TR')).not.toContain('grafik');
    expect(fn01.row.q).toContain('tablo');
    const r5 = resolved.find((x) => x.row.id === 'qpn-s1-sy-r5')!;
    expect(r5.row.o[r5.row.a]).toBe('20');
    expect(r5.row.o).not.toContain('25');
    const r10 = resolved.find((x) => x.row.id === 'qpn-s1-sy-r10')!;
    expect(r10.row.o[r10.row.a]).toBe('20');
    expect(r10.row.o).not.toContain('30');
    const keep = QUALITY_PRIORITY_NEXT_ITEMS.filter((x) => !QPN_REVISE_IDS.includes(x.row.id as (typeof QPN_REVISE_IDS)[number]));
    expect(keep).toHaveLength(22);
    console.log('QPN_REVISION', JSON.stringify({ count: resolved.length, revise: 6, keep: 22, mathFail: p.mathFail }));
  });
});
