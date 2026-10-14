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

  it('üretim istemcisi bankData’yı statik bağlamaz; edge kapısı vardır, paket yoksa yerel yedek kullanılır', () => {
    const bank = readFileSync(join(root, 'src/lib/bank.ts'), 'utf8');
    expect(bank).not.toMatch(/^import .*from ['"]\.\.\/data\/bankData['"]/m);
    expect(bank).toContain('import.meta.env.DEV');
    expect(bank).toContain('bank-pack');
    expect(bank).toContain('bundledManifestData');
    expect(bank).toContain('bundledLevelData');
    const edge = readFileSync(join(root, 'supabase/functions/bank-pack/index.ts'), 'utf8');
    expect(edge).toContain('studentFeatureOk');
    expect(edge).toContain('Bu özellik öğrenci hesabına özel.');
    expect(edge).toContain(', 503');
  });
});
