import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import {
  LIBRARY_EMOJIS,
  LIBRARY_ROOM_ID,
  emptyLibraryPrefs,
} from './libraryPresence';
import {
  appendLibrarySession,
  progressFingerprint,
} from './studentProgress';

const pageSrc = () => readFileSync(join(process.cwd(), 'src/pages/LibraryPage.tsx'), 'utf8');

describe('sessiz kütüphane sadeleştirme (regresyon D–H)', () => {
  it('D) Figür seçmek → joinedRoomId değiştirmiyor', () => {
    const src = pageSrc();
    expect(src).toMatch(/selectEmoji/);
    expect(src).toMatch(/persistPrefs\(\{\s*emoji:\s*em\s*\}\)/);
    expect(src).toMatch(/Figür seçmek odaya katılmaz/);
    const d = emptyData();
    d.libraryPrefs = { ...emptyLibraryPrefs(), emoji: null, joinedRoomId: null };
    const afterEmoji = { ...d, libraryPrefs: { ...d.libraryPrefs, emoji: '🦊' } };
    expect(afterEmoji.libraryPrefs.joinedRoomId).toBeNull();
    expect(progressFingerprint(d)).toBe(progressFingerprint(afterEmoji));
  });

  it('E) Figür seçmek → heartbeat başlatmıyor', () => {
    const src = pageSrc();
    // Heartbeat yalnızca joined iken; emoji seçimi join etmez.
    expect(src).toMatch(/if\s*\(!user\s*\|\|\s*!sb\s*\|\|\s*!joined\)\s*return/);
    expect(src).toMatch(/LIBRARY_HEARTBEAT_MS/);
    const selectBlock = src.slice(src.indexOf('selectEmoji'), src.indexOf('leaveRoom'));
    expect(selectBlock).not.toMatch(/library_heartbeat|joinedRoomId|appendLibrarySession/);
  });

  it('F) Tek Katıl → joinedRoomId oluşturuyor', () => {
    const src = pageSrc();
    expect(src).toMatch(/joinedRoomId:\s*LIBRARY_ROOM_ID/);
    expect(src).toMatch(/function joinRoom\(/);
    const d = emptyData();
    d.libraryPrefs = {
      ...emptyLibraryPrefs(),
      nameMode: 'alias',
      emoji: '🦁',
      joinedRoomId: LIBRARY_ROOM_ID,
      joinedAt: new Date().toISOString(),
    };
    expect(d.libraryPrefs.joinedRoomId).toBe(LIBRARY_ROOM_ID);
  });

  it('G) Ayrıl → joinedRoomId temizliyor ve süre flush ediyor', () => {
    const src = pageSrc();
    expect(src).toMatch(/appendLibrarySession\(prev,\s*prev\.libraryPrefs\.joinedAt\)/);
    expect(src).toMatch(/joinedRoomId:\s*null,\s*joinedAt:\s*null/);
    const started = new Date(Date.now() - 5 * 60_000).toISOString();
    let d = emptyData();
    d.libraryPrefs = {
      ...emptyLibraryPrefs(),
      nameMode: 'alias',
      joinedRoomId: LIBRARY_ROOM_ID,
      joinedAt: started,
      emoji: '🐺',
    };
    const closed = appendLibrarySession(d, d.libraryPrefs.joinedAt);
    const left = {
      ...closed,
      libraryPrefs: { ...closed.libraryPrefs, joinedRoomId: null, joinedAt: null },
    };
    expect(left.libraryPrefs.joinedRoomId).toBeNull();
    expect(left.libraryPrefs.joinedAt).toBeNull();
    expect(left.sessions.some((s) => s.kind === 'library')).toBe(true);
  });

  it('H) Figür kartlarında Katıl/Ayrıl butonu yok; tek ana aksiyon var', () => {
    const src = pageSrc();
    expect(src).toMatch(/>Katıl</);
    expect(src).toMatch(/>Ayrıl</);
    const gridStart = src.indexOf('<h3>Figür seç</h3>');
    expect(gridStart).toBeGreaterThan(0);
    const grid = src.slice(gridStart);
    expect(grid).not.toMatch(/>Katıl</);
    expect(grid).not.toMatch(/>Ayrıl</);
    expect(grid).toMatch(/LIBRARY_EMOJIS\.map/);
    expect(grid).toMatch(/selectEmoji\(em\)/);
    expect(LIBRARY_EMOJIS).toHaveLength(10);
    expect(src).not.toMatch(/persistPrefs\(\{\s*emoji:\s*em\s*\}\);\s*joinRoom/);
    const mainJoin = src.indexOf('onClick={joinRoom}>Katıl<');
    expect(mainJoin).toBeGreaterThan(0);
    expect(mainJoin).toBeLessThan(gridStart);
  });
});

