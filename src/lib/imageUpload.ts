/** Koç fotoğrafı: MIME iddiası değil, sihirli bayt + tehlikeli işaret. */

const MAX_BYTES = 8 * 1024 * 1024;

function headText(bytes: Uint8Array, n = 256) {
  const slice = bytes.subarray(0, Math.min(n, bytes.length));
  return new TextDecoder('utf-8', { fatal: false }).decode(slice).replace(/^\uFEFF/, '').trimStart();
}

export function sniffRasterImage(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return 'webp';
  return null;
}

export function imageUploadError(claimedMime: string, bytes: Uint8Array): string {
  if (!bytes.length) return 'Fotoğraf boş.';
  if (bytes.length > MAX_BYTES) return 'Fotoğraf 8 MB’den küçük olsun.';
  const mime = claimedMime.toLowerCase().split(';')[0].trim();
  if (mime === 'image/svg+xml' || mime === 'text/html' || mime === 'application/xhtml+xml') {
    return 'SVG veya HTML yüklenemez.';
  }
  const text = headText(bytes);
  if (/^<(\?xml|!doctype|svg|html|script|iframe)\b/i.test(text) || text.startsWith('<svg')) {
    return 'SVG veya HTML yüklenemez.';
  }
  const kind = sniffRasterImage(bytes);
  if (!kind) return 'Yalnızca JPEG, PNG veya WebP.';
  if (mime && mime.startsWith('image/') && mime !== `image/${kind}` && !(kind === 'jpeg' && mime === 'image/jpg')) {
    return 'Dosya türü ile içerik uyuşmuyor.';
  }
  return '';
}
