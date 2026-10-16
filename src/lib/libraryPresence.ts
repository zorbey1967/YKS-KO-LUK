import { getPersonDisplayName, looksLikeEmail } from './displayName';
import type { LibraryPrefs } from './types';
import { readLocal, writeLocal } from './util';

export const LIBRARY_ROOM_ID = '00000000-0000-0000-0000-000000000001';
export const LIBRARY_HEARTBEAT_MS = 30_000;
export const LIBRARY_CLOCK_MS = 1_000;

export const LIBRARY_ROOMS = [
  { id: LIBRARY_ROOM_ID, name: 'Genel Çalışma Salonu' },
] as const;

export type LibraryNameMode = 'real' | 'alias';
export type LibraryPeer = { display_name: string; minutes: number; share_exams?: boolean };

function consentKey(userId: string) {
  return `yks_lib_name_${userId}`;
}

function joinedKey(userId: string) {
  return `yks_lib_joined_${userId}`;
}

export function emptyLibraryPrefs(): LibraryPrefs {
  return { nameMode: null, joinedRoomId: null, joinedAt: null };
}

export function readLibraryNameMode(userId: string): LibraryNameMode | null {
  const raw = readLocal(consentKey(userId));
  return raw === 'real' || raw === 'alias' ? raw : null;
}

export function writeLibraryNameMode(userId: string, mode: LibraryNameMode) {
  writeLocal(consentKey(userId), mode);
}

export function readLibraryJoined(userId: string) {
  return readLocal(joinedKey(userId)) === '1';
}

export function writeLibraryJoined(userId: string, joined: boolean) {
  writeLocal(joinedKey(userId), joined ? '1' : '');
}

export function libraryAlias(userId: string) {
  const id = String(userId || '').replace(/-/g, '');
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return `Öğrenci ${String((n % 9000) + 1000)}`;
}

export function libraryDisplayName(input: {
  mode: LibraryNameMode | null;
  profileName: string;
  userId: string;
}) {
  if (input.mode === 'real') {
    const n = getPersonDisplayName(input.profileName, '');
    if (n) return n.slice(0, 40);
  }
  return libraryAlias(input.userId);
}

export function libraryTextLeaksEmail(text: string) {
  return looksLikeEmail(text) || /@/.test(String(text || ''));
}

export function formatStudyClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function sanitizeLibraryPeers(raw: unknown): LibraryPeer[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryPeer[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.display_name || '').trim();
    if (!name || libraryTextLeaksEmail(name)) continue;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(name)) continue;
    out.push({
      display_name: name.slice(0, 40),
      minutes: Math.max(0, Number(r.minutes) || 0),
      share_exams: Boolean(r.share_exams),
    });
  }
  return out;
}

export function resolveLibraryPrefs(cloud: LibraryPrefs | undefined, userId: string): LibraryPrefs {
  const localMode = readLibraryNameMode(userId);
  const localJoined = readLibraryJoined(userId);
  const nameMode = cloud?.nameMode || localMode;
  const joinedRoomId = cloud?.joinedRoomId || (localJoined ? LIBRARY_ROOM_ID : null);
  const joinedAt = cloud?.joinedAt || (joinedRoomId ? new Date().toISOString() : null);
  return {
    nameMode,
    joinedRoomId,
    joinedAt: joinedRoomId ? joinedAt : null,
  };
}

export function roomLabel(roomId: string | null) {
  return LIBRARY_ROOMS.find((r) => r.id === roomId)?.name || null;
}
