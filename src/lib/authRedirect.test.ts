import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from './site';
import { AUTH_RECOVERY_HASH, authEmailRedirectTo, isAllowedAuthOrigin } from './authRedirect';

describe('authEmailRedirectTo', () => {
  it('canlı origin ve localhost kabul eder', () => {
    expect(isAllowedAuthOrigin(SITE_ORIGIN)).toBe(true);
    expect(isAllowedAuthOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedAuthOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(authEmailRedirectTo(SITE_ORIGIN)).toBe(`${SITE_ORIGIN}/${AUTH_RECOVERY_HASH}`);
    expect(authEmailRedirectTo('http://localhost:5173')).toBe(`http://localhost:5173/${AUTH_RECOVERY_HASH}`);
  });

  it('açık yönlendirmeyi reddeder', () => {
    expect(isAllowedAuthOrigin('https://e-kocluk-git-fix.vercel.app')).toBe(true);
    expect(isAllowedAuthOrigin('https://evil.example')).toBe(false);
    expect(isAllowedAuthOrigin('https://e-kocluk.vercel.app.evil.com')).toBe(false);
    expect(isAllowedAuthOrigin('https://evil.vercel.app')).toBe(false);
    expect(isAllowedAuthOrigin('https://zorbey1967.github.io')).toBe(false);
    expect(isAllowedAuthOrigin('https://zorbey1967.github.io/YKS-KO-LUK')).toBe(false);
    expect(authEmailRedirectTo('https://evil.example/phish')).toBe(`${SITE_ORIGIN}/${AUTH_RECOVERY_HASH}`);
    expect(authEmailRedirectTo('javascript:alert(1)')).toBe(`${SITE_ORIGIN}/${AUTH_RECOVERY_HASH}`);
  });
});
