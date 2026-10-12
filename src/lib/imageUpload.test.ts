import { describe, expect, it } from 'vitest';
import { imageUploadError, sniffRasterImage } from './imageUpload';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const html = new TextEncoder().encode('<!doctype html><img src=x onerror=alert(1)>');

describe('imageUploadError', () => {
  it('JPEG/PNG sihirli baytı kabul eder', () => {
    expect(sniffRasterImage(jpeg)).toBe('jpeg');
    expect(sniffRasterImage(png)).toBe('png');
    expect(imageUploadError('image/jpeg', jpeg)).toBe('');
    expect(imageUploadError('image/png', png)).toBe('');
  });

  it('SVG/HTML ve yanlış MIME’i reddeder', () => {
    expect(imageUploadError('image/svg+xml', svg)).toMatch(/SVG veya HTML/);
    expect(imageUploadError('image/jpeg', svg)).toMatch(/SVG veya HTML/);
    expect(imageUploadError('image/png', html)).toMatch(/SVG veya HTML/);
    expect(imageUploadError('image/png', jpeg)).toMatch(/uyuşmuyor/);
  });
});
