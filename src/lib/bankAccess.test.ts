import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canLoadBankPack } from './bankAccess';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('soru bankası erişim', () => {
  it('koç, askı ve üyeliksiz öğrenci paketi alamaz; sahip/yönetici ve üyeli öğrenci alır', () => {
    const base = {
      signedIn: true,
      role: 'student',
      accountActive: true,
      entitled: true,
      isAdmin: false,
      isOwner: false,
    };
    expect(canLoadBankPack(base)).toBe(true);
    expect(canLoadBankPack({ ...base, role: 'coach' })).toBe(false);
    expect(canLoadBankPack({ ...base, accountActive: false })).toBe(false);
    expect(canLoadBankPack({ ...base, entitled: false })).toBe(false);
    expect(canLoadBankPack({ ...base, signedIn: false })).toBe(false);
    expect(canLoadBankPack({ ...base, role: 'admin', entitled: false, isAdmin: true })).toBe(true);
    expect(canLoadBankPack({ ...base, entitled: false, isOwner: true })).toBe(true);
  });

  it('üretim istemcisi bankData’yı bağlamaz (yalnız DEV); edge kapısı vardır, paket yoksa boş döner', () => {
    const bank = readFileSync(join(root, 'src/lib/bank.ts'), 'utf8');
    expect(bank).not.toMatch(/^import .*from ['"]\.\.\/data\/bankData['"]/m);
    expect(bank).toContain('import.meta.env.DEV');
    expect(bank).toContain('bank-pack');
    expect(bank).toContain('bundledManifestData');
    expect(bank).toContain('bundledLevelData');
    // Dinamik import yalnızca DEV dalında: üretim paketinde cevaplı soru parçası oluşmaz.
    expect(bank).toMatch(/if \(import\.meta\.env\.DEV\) return import\('\.\.\/data\/bankData'\);\s+return null;/);
    const edge = readFileSync(join(root, 'supabase/functions/bank-pack/index.ts'), 'utf8');
    expect(edge).toContain('studentFeatureOk');
    expect(edge).toContain('Bu özellik öğrenci hesabına özel.');
    expect(edge).toContain(', 503');
  });
});

describe('soru bankası gizli (silinmedi)', () => {
  it('banka verisi durur ama öneri, ZORRO ve menüde görünmez', async () => {
    const { QUESTION_BANK_ENABLED } = await import('./features');
    const { weakBankTopics, lastBankTopic } = await import('./practice');
    const { workingModeChips } = await import('./zorroSuggest');
    const { coachContext } = await import('./coach');
    const { emptyData } = await import('./types');
    expect(QUESTION_BANK_ENABLED).toBe(false);
    const d = { ...emptyData(), qb: { 'YKS TYT|Matematik|Türev': { key: 'YKS TYT|Matematik|Türev', answered: 10, correct: 3, wrong: 7, index: 10, completed: false, answeredIds: [], updatedAt: '2026-10-19' } } };
    expect(weakBankTopics(d)).toEqual([]);
    expect(lastBankTopic(d)).toBeNull();
    const chips = JSON.stringify(workingModeChips(d as never, true, true));
    expect(chips).not.toMatch(/banka/i);
    expect(coachContext(d as never)).not.toMatch(/soru bankas/i);
    // Veri silinmedi: paketli sorular ve sayfa kodu depoda duruyor.
    expect(readFileSync(join(root, 'src/data/bankData.ts'), 'utf8')).toContain('export const CURRICULUM');
    expect(readFileSync(join(root, 'src/pages/QuestionBankPage.tsx'), 'utf8')).toContain('Soru Bankası');
  });
});
