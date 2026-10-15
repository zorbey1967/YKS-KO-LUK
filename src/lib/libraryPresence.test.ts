import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pagesAllowedForGate } from './accessGate';
import {
  LIBRARY_HEARTBEAT_MS,
  libraryAlias,
  libraryDisplayName,
  libraryTextLeaksEmail,
} from './libraryPresence';

describe('sessiz kütüphane görünür ad ve katılım', () => {
  it('alias e-posta içermez; gerçek ad profil adını kullanır', () => {
    const uid = 'aa9226a5-f728-4e1d-9d82-e8bf0c363c0e';
    expect(libraryAlias(uid)).toBe('Öğrenci 3C0E');
    expect(libraryTextLeaksEmail(libraryAlias(uid))).toBe(false);
    expect(libraryDisplayName({ mode: 'alias', profileName: 'Ali Veli', userId: uid })).toBe('Öğrenci 3C0E');
    expect(libraryDisplayName({ mode: 'real', profileName: 'Ali Veli', userId: uid })).toBe('Ali Veli');
    expect(libraryDisplayName({ mode: 'real', profileName: 'ali@mail.com', userId: uid })).toBe('Öğrenci 3C0E');
    expect(libraryTextLeaksEmail('ali@mail.com')).toBe(true);
  });

  it('heartbeat 30sn ve cleanup; guest kütüphane sayfasını açabilir', () => {
    expect(LIBRARY_HEARTBEAT_MS).toBe(30_000);
    const page = readFileSync(join(process.cwd(), 'src/pages/LibraryPage.tsx'), 'utf8');
    expect(page).toContain('window.clearInterval(id)');
    expect(page).toContain('Katıl');
    expect(page).toContain('Ayrıl');
    expect(page).toContain('Adınızı ve soyadınızı kütüphanede kullanalım mı?');
    expect(page).not.toMatch(/setInterval\(\(\) => void tick\(\), 15000\)/);
    expect(pagesAllowedForGate('guest')).toContain('library');
  });
});
