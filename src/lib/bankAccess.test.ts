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

  it('istemci bankData’yı hiç bağlamaz (statik/dinamik); sorular yalnızca bank-pack edge’inden, yerel yedek yok', () => {
    const bank = readFileSync(join(root, 'src/lib/bank.ts'), 'utf8');
    expect(bank).not.toMatch(/data\/bankData/);
    expect(bank).not.toMatch(/import\(\s*['"][^'"]*bankData/);
    expect(bank).not.toContain('bundledManifestData');
    expect(bank).not.toContain('bundledLevelData');
    expect(bank).not.toContain('/bank/manifest.json');
    expect(bank).toContain('bank-pack');
    expect(bank).toContain("throw new Error(remote.error || 'Soru paketi alınamadı.')");
    const appSrc = ['src/App.tsx', 'src/pages/QuestionBankPage.tsx', 'src/pages/SettingsPage.tsx', 'src/lib/coachAi.ts']
      .map((p) => readFileSync(join(root, p), 'utf8'))
      .join('\n');
    expect(appSrc).not.toMatch(/data\/bankData/);
    const edge = readFileSync(join(root, 'supabase/functions/bank-pack/index.ts'), 'utf8');
    expect(edge).toContain('studentFeatureOk');
    expect(edge).toContain('Bu özellik öğrenci hesabına özel.');
    expect(edge).toContain(', 503');
  });

  it('bayrak kapalıyken manifest/seviye/arama boş döner; Ayarlar paketi istemez', async () => {
    const { QUESTION_BANK_ENABLED } = await import('./features');
    expect(QUESTION_BANK_ENABLED).toBe(false);
    const { loadManifest, loadLevel, findBankQuestions } = await import('./bank');
    const man = await loadManifest();
    expect(man.questionCount).toBe(0);
    expect(man.levels).toEqual([]);
    expect(await loadLevel('lise', 'Lise')).toEqual({});
    expect(findBankQuestions({ topic: 'türev', limit: 3 })).toEqual([]);
    const settings = readFileSync(join(root, 'src/pages/SettingsPage.tsx'), 'utf8');
    expect(settings).toMatch(/if \(!QUESTION_BANK_ENABLED\) return;\s*void loadManifest\(\)/);
    expect(settings).toContain('{QUESTION_BANK_ENABLED ? (');
  });
});
