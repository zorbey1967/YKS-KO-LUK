export async function compressQuestionImage(file: File): Promise<{ mime: string; b64: string; preview: string }> {
  const rawType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  if (!file.type.startsWith('image/')) throw new Error('Yalnızca görsel yükle (JPEG/PNG/WebP).');
  if (file.size > 8 * 1024 * 1024) throw new Error('Görsel en fazla 8 MB olsun.');

  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Görsel işlenemedi.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const mime = rawType === 'image/png' ? 'image/jpeg' : rawType === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel sıkıştırılamadı.'))), mime, 0.72);
  });
  if (blob.size > 1_100_000) throw new Error('Görsel hâlâ büyük. Daha net ve kırpılmış bir kare dene.');
  const preview = URL.createObjectURL(blob);
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return { mime, b64, preview };
}
