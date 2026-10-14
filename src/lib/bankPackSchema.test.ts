import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANK, bundledManifest } from '../data/bankData';
import { isBankPackQuestion, parseBankPack, questionsForPackLevel, BANK_PACK_SCHEMA } from '../../supabase/functions/_shared/bankPackSchema.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const packFile = join(root, 'supabase/functions/bank-pack/pack.json');
const metaFile = join(root, 'supabase/functions/bank-pack/pack.meta.json');

describe('bank-pack şeması', () => {
  it('kaynak sorular pack sözleşmesine uyar; müfredat anahtarı level|ders|konu', () => {
    const man = bundledManifest();
    expect(man.version).toBe(7);
    expect(man.questionCount).toBeGreaterThan(100);
    expect(man.levels.length).toBeGreaterThan(5);
    let n = 0;
    for (const [key, list] of Object.entries(BANK)) {
      expect(key.split('|').length).toBeGreaterThanOrEqual(3);
      for (const row of list) {
        expect(isBankPackQuestion(row), key + ':' + row.id).toBe(true);
        n += 1;
      }
    }
    expect(n).toBe(man.questionCount);
    const orig = Object.values(BANK).flat().find((q) => q.id === 'orig-tyt-eq-1');
    expect(orig?.a).toBe(1);
    expect(orig?.o[1]).toContain('5');
  });

  it('bozuk JSON / yanlış şema pack sayılmaz', () => {
    expect(parseBankPack(null)).toBeNull();
    expect(parseBankPack({ schema: 'wrong', version: 7, manifest: {}, levels: {} })).toBeNull();
    expect(parseBankPack('{"schema":"x"}')).toBeNull();
  });

  it('edge paket yokken 503 söyler; boş manifesti başarı saymaz', () => {
    const edge = readFileSync(join(root, 'supabase/functions/bank-pack/index.ts'), 'utf8');
    expect(edge).toContain('503');
    expect(edge).toContain('npm run pack:bank');
    expect(edge).toContain('parseBankPack');
    expect(edge).not.toContain('questionCount: 0');
  });

  it('pack.json varsa kaynakla aynı sayı ve orig-tyt-eq-1 taşır', () => {
    if (!existsSync(packFile) || !existsSync(metaFile)) {
      expect.soft(existsSync(packFile), 'pack.json yok; npm run pack:bank gerekli, 503 beklenir').toBe(true);
      return;
    }
    const pack = parseBankPack(JSON.parse(readFileSync(packFile, 'utf8')));
    expect(pack?.schema).toBe(BANK_PACK_SCHEMA);
    expect(pack?.manifest.questionCount).toBe(bundledManifest().questionCount);
    const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as { questionCount: number; bytes: number };
    expect(meta.questionCount).toBe(pack?.manifest.questionCount);
    expect(meta.bytes).toBeGreaterThan(1000);
    const slug = pack?.manifest.levels.find((l) => l.name.includes('TYT') || l.name.includes('YKS'))?.slug || '';
    const qs = pack ? questionsForPackLevel(pack, slug, pack.manifest.levels.find((l) => l.slug === slug)?.name || '') : null;
    const found = qs ? Object.values(qs).flat().find((q) => q.id === 'orig-tyt-eq-1') : null;
    expect(found || Object.values(pack?.levels || {}).some((lv) =>
      Object.values(lv.questions).flat().some((q) => q.id === 'orig-tyt-eq-1'))).toBeTruthy();
  });
});
