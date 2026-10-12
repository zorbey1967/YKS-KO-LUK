import { describe, expect, it } from 'vitest';
import { originAllowed } from '../../supabase/functions/_shared/cors.ts';

describe('Edge CORS', () => {
  it('canlı origin ve localhost açar; yabancı origin kapatır', () => {
    expect(originAllowed('https://e-kocluk.vercel.app')).toBe(true);
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('https://evil.example')).toBe(false);
  });
});
