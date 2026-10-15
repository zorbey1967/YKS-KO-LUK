import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coachDirectoryGuestEmpty } from './cloudPlatform';
import { SESSION_REQUIRED } from './supabase';

const page = () => readFileSync(join(process.cwd(), 'src/pages/CoachesPage.tsx'), 'utf8');

describe('koç dizini misafir empty state', () => {
  it('misafir 42501 / JWT → boş liste; oturumlu auth hatası gizlenmez', () => {
    expect(coachDirectoryGuestEmpty({ signedIn: false, code: '42501' })).toBe(true);
    expect(coachDirectoryGuestEmpty({ signedIn: false, code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(coachDirectoryGuestEmpty({ signedIn: false, message: 'invalid jwt' })).toBe(true);
    expect(coachDirectoryGuestEmpty({ signedIn: true, code: '42501' })).toBe(false);
    expect(coachDirectoryGuestEmpty({ signedIn: true, message: 'JWT expired' })).toBe(false);
    expect(coachDirectoryGuestEmpty({ signedIn: false, code: 'PGRST205', message: 'schema cache' })).toBe(false);
    expect(coachDirectoryGuestEmpty({ signedIn: false, message: 'İstek zaman aşımına uğradı.' })).toBe(false);
  });

  it('CoachesPage misafir dizinini signedIn:false ile çeker; SESSION_REQUIRED metni empty değil', () => {
    const src = page();
    expect(src).toContain('fetchActiveCoaches({ signedIn: Boolean(user) })');
    expect(src).toContain('Onaylı koç yok.');
    expect(SESSION_REQUIRED).toMatch(/Oturumunuz geçerli değil/);
  });
});
