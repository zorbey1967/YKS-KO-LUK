/** exam-scan kota ve dosya sınırı: kova, istemci ve Edge ile aynı eşik. */

import { imageUploadError } from './imageUpload';

export const EXAM_SCAN_MAX_BYTES = 8 * 1024 * 1024;
export const EXAM_SCAN_HOUR_LIMIT = 8;
export const EXAM_SCAN_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const EXAM_SCAN_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

export function examScanPathOwned(userId: string, path: string) {
  if (!userId || path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  const parts = path.split('/');
  if (parts.length < 2 || parts[0] !== userId || !parts[1]) return false;
  const ext = parts[parts.length - 1].split('.').pop()?.toLowerCase() || '';
  return (EXAM_SCAN_EXTENSIONS as readonly string[]).includes(ext);
}

export function examScanFileError(claimedMime: string, bytes: Uint8Array): string {
  if (!bytes.length) return 'Dosya boş.';
  if (bytes.length > EXAM_SCAN_MAX_BYTES) return 'Dosya 8 MB’den küçük olsun.';
  const mime = claimedMime.toLowerCase().split(';')[0].trim();
  const pdfMagic = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mime === 'application/pdf' || pdfMagic) {
    if (!pdfMagic) return 'PDF içeriği doğrulanamadı.';
    if (mime && mime !== 'application/pdf') return 'Dosya türü ile içerik uyuşmuyor.';
    return '';
  }
  return imageUploadError(claimedMime, bytes);
}

export function clientExamReportRow<T extends { verified_key?: boolean }>(row: T) {
  return { ...row, verified_key: false as const };
}

/** PG `WHERE n < limit` ile aynı atomik artırım modeli. */
export function takeQuotaSlot(store: Map<string, number>, key: string, limit: number) {
  if (!key || limit < 1) return false;
  const n = store.get(key) ?? 0;
  if (n >= limit) return false;
  store.set(key, n + 1);
  return true;
}

export function takeQuotaSlotRow(row: { n: number }, limit: number) {
  if (row.n >= limit) return null;
  row.n += 1;
  return row.n;
}
