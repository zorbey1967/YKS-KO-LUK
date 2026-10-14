import { examScanFileError, examScanPathOwned } from './examScanQuota';

export function examUploadGate(input: {
  bearer: string;
  accountActive: boolean | null;
  userId: string;
  claimedMime: string;
  bytes: Uint8Array;
  pathUserId?: string;
}) {
  if (!input.bearer) return { ok: false as const, status: 401, error: 'Oturum gerekli' };
  if (!input.userId) return { ok: false as const, status: 401, error: 'Geçersiz oturum' };
  if (input.accountActive !== true) {
    return { ok: false as const, status: 403, error: 'Hesap askıda veya doğrulanamadı.' };
  }
  if (!input.bytes.length) return { ok: false as const, status: 400, error: 'Dosya boş.' };
  const kindErr = examScanFileError(input.claimedMime, input.bytes);
  if (kindErr) {
    const status = /8 MB/i.test(kindErr) ? 413 : 415;
    return { ok: false as const, status, error: kindErr };
  }
  if (input.pathUserId && input.pathUserId !== input.userId) {
    return { ok: false as const, status: 403, error: 'Dosya yolu geçersiz' };
  }
  const ext = input.claimedMime.includes('png')
    ? 'png'
    : input.claimedMime.includes('webp')
      ? 'webp'
      : input.claimedMime.includes('pdf')
        ? 'pdf'
        : 'jpg';
  const path = `${input.userId}/gate.${ext}`;
  if (!examScanPathOwned(input.userId, path)) {
    return { ok: false as const, status: 400, error: 'Dosya yolu geçersiz' };
  }
  return { ok: true as const, status: 200, path, error: '' };
}
