import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from './site';
import { publicAuthError } from './authUi';
import { authOAuthRedirectTo, beginGoogleSignIn, googleAuthorizeFailureMessage, googleOAuthOptions, googleSignInBlockedReason, shouldAutoLinkIdentities } from './googleOAuth';
import { AUTH_RECOVERY_HASH } from './authRedirect';

describe('Google OAuth', () => {
  it('PKCE dönüşü origin köküne gider; hash token çakışması yok; otomatik birleştirme kapalı', () => {
    expect(authOAuthRedirectTo('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/');
    expect(authOAuthRedirectTo('http://localhost:5173')).toBe('http://localhost:5173/');
    expect(authOAuthRedirectTo('https://evil.example')).toBe(`${SITE_ORIGIN}/`);
    expect(googleOAuthOptions('http://localhost:5173').provider).toBe('google');
    expect(googleOAuthOptions('http://localhost:5173').options.redirectTo).toBe('http://localhost:5173/');
    expect(authOAuthRedirectTo('https://e-kocluk.vercel.app')).toBe('https://e-kocluk.vercel.app/');
    expect(authOAuthRedirectTo()).toBe('https://e-kocluk.vercel.app/');
    expect(googleOAuthOptions().options.redirectTo).toBe('https://e-kocluk.vercel.app/');
    expect(googleOAuthOptions().options.skipBrowserRedirect).toBe(false);
    expect(googleOAuthOptions().options.redirectTo).not.toContain(AUTH_RECOVERY_HASH);
    expect(shouldAutoLinkIdentities()).toBe(false);
    expect(googleSignInBlockedReason()).toMatch(/yapılandırılmamış/i);
    expect(publicAuthError(new Error('Unsupported provider: provider is not enabled'))).toMatch(/Google girişi/);
    expect(googleAuthorizeFailureMessage(400, '{"msg":"Unsupported provider: provider is not enabled"}')).toMatch(/yapılandırılmamış/);
  });

  it('signInWithOAuth google ve production redirectTo kullanır', async () => {
    let called: unknown;
    const client = {
      auth: {
        signInWithOAuth: async (args: unknown) => {
          called = args;
          return { data: { url: 'https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize?provider=google' }, error: null };
        },
      },
    };
    await beginGoogleSignIn(client, 'https://e-kocluk.vercel.app');
    expect(called).toMatchObject({
      provider: 'google',
      options: { redirectTo: 'https://e-kocluk.vercel.app/', skipBrowserRedirect: false },
    });
  });
});
