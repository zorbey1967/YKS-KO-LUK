import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pagesAllowedForGate } from './accessGate';
import {
  LIBRARY_HEARTBEAT_MS,
  LIBRARY_ROOMS,
  formatStudyClock,
  libraryAlias,
  libraryDisplayName,
  libraryTextLeaksEmail,
  sanitizeLibraryPeers,
} from './libraryPresence';

describe('sessiz kütüphane görünür ad ve katılım', () => {
  it('alias e-posta içermez; gerçek ad profil adını kullanır', () => {
    const uid = 'aa9226a5-f728-4e1d-9d82-e8bf0c363c0e';
    expect(libraryAlias(uid)).toMatch(/^Öğrenci \d{4}$/);
    expect(libraryTextLeaksEmail(libraryAlias(uid))).toBe(false);
    expect(libraryDisplayName({ mode: 'alias', profileName: 'Ali Veli', userId: uid })).toBe(libraryAlias(uid));
    expect(libraryDisplayName({ mode: 'real', profileName: 'Ali Veli', userId: uid })).toBe('Ali Veli');
    expect(libraryDisplayName({ mode: 'real', profileName: 'ali@mail.com', userId: uid })).toBe(libraryAlias(uid));
    expect(libraryTextLeaksEmail('ali@mail.com')).toBe(true);
  });

  it('heartbeat 30sn ve cleanup; guest kütüphane sayfasını açabilir', () => {
    expect(LIBRARY_HEARTBEAT_MS).toBe(30_000);
    const page = readFileSync(join(process.cwd(), 'src/pages/LibraryPage.tsx'), 'utf8');
    expect(page).toContain('window.clearInterval(id)');
    expect(page).toContain('Odaya Katıl');
    expect(page).toContain('Ayrıl');
    expect(page).toContain('Adınız ve soyadınız kütüphanede görünsün mü?');
    expect(page).toContain('document.hidden');
    expect(page).toContain('visibilitychange');
    expect(page).not.toMatch(/setInterval\(\(\) => void tick\(\), 15000\)/);
    expect(pagesAllowedForGate('guest')).toContain('library');
    expect(LIBRARY_ROOMS[0].name).toBe('Genel Çalışma Salonu');
    expect(formatStudyClock(2538000)).toBe('00:42:18');
    expect(sanitizeLibraryPeers([
      { display_name: 'Ali', minutes: 12 },
      { display_name: 'x@y.com', minutes: 3 },
      { user_id: 'secret', display_name: 'Ayşe', minutes: 1 },
    ]).map((p) => p.display_name)).toEqual(['Ali', 'Ayşe']);
  });
});
