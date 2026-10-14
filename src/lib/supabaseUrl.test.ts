import { describe, expect, it } from 'vitest';
import { supabaseUrlOk } from './supabase';

describe('supabaseUrlOk', () => {
  it('yerel döngü adresini kabul eder; canlı hostname dışında reddeder', () => {
    expect(supabaseUrlOk('http://127.0.0.1:54321')).toBe(true);
    expect(supabaseUrlOk('http://localhost:54321')).toBe(true);
    expect(supabaseUrlOk('https://abcd.supabase.co')).toBe(true);
    expect(supabaseUrlOk('https://naiakscryafhvcghjmzx.supabase.co')).toBe(true);
    expect(supabaseUrlOk('http://example.com')).toBe(false);
    expect(supabaseUrlOk('https://evil.example')).toBe(false);
    expect(supabaseUrlOk('')).toBe(false);
  });
});
