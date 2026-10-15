import { getPersonDisplayName, looksLikeEmail } from './displayName';
import { readLocal, writeLocal } from './util';

export const LIBRARY_ROOM_ID = '00000000-0000-0000-0000-000000000001';
export const LIBRARY_HEARTBEAT_MS = 30_000;

export type LibraryNameMode = 'real' | 'alias';

function consentKey(userId: string) {
  return `yks_lib_name_${userId}`;
}

function joinedKey(userId: string) {
  return `yks_lib_joined_${userId}`;
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
  const tail = (id.slice(-4) || 'X').toUpperCase();
  return `Öğrenci ${tail}`;
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
