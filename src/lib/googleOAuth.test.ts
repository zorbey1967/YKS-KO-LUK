import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from './site';
import { publicAuthError } from './authUi';
import { authOAuthRedirectTo, googleOAuthOptions, googleSignInBlockedReason, shouldAutoLinkIdentities } from './googleOAuth';
import { AUTH_RECOVERY_HASH } from './authRedirect';

describe('Google OAuth', () => {
  it('PKCE dönüşü origin köküne gider; hash token çakışması yok; otomatik birleştirme kapalı', () => {
    expect(authOAuthRedirectTo('http://127.0.0.1:4176')).toBe('http://127.0.0.1:4176/');
    expect(authOAuthRedirectTo('https://evil.example')).toBe(`${SITE_ORIGIN}/`);
    expect(googleOAuthOptions('http://localhost:5173').provider).toBe('google');
    expect(googleOAuthOptions('http://localhost:5173').options.redirectTo).toBe('http://localhost:5173/');
    expect(googleOAuthOptions().options.redirectTo).not.toContain(AUTH_RECOVERY_HASH);
    expect(shouldAutoLinkIdentities()).toBe(false);
    expect(googleSignInBlockedReason()).toMatch(/yapılandırılmamış/i);
    expect(publicAuthError(new Error('Unsupported provider: provider is not enabled'))).toMatch(/Google girişi/);
    expect(publicAuthError(new Error('Unsupported provider: provider is not enabled'))).toMatch(/birleştirme kapalı/);
  });
});
