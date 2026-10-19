import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from './site';
import { publicAuthError } from './authUi';
import {
  applyGoogleSignupPendingToData,
  authOAuthRedirectTo,
  beginGoogleSignIn,
  beginGoogleSignUp,
  clearGoogleSignupPending,
  googleAuthorizeFailureMessage,
  googleOAuthOptions,
  googleSignInBlockedReason,
  shouldAutoLinkIdentities,
  stashGoogleSignupPending,
  takeGoogleSignupPending,
} from './googleOAuth';
import { AUTH_RECOVERY_HASH } from './authRedirect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Google OAuth', () => {
  it('PKCE dönüşü origin köküne gider; hash token çakışması yok; otomatik birleştirme kapalı', () => {
    expect(authOAuthRedirectTo('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/');
    expect(authOAuthRedirectTo('http://localhost:5173')).toBe('http://localhost:5173/');
    expect(authOAuthRedirectTo('https://evil.example')).toBe(`${SITE_ORIGIN}/`);
    expect(authOAuthRedirectTo('https://zorbey1967.github.io/YKS-KO-LUK')).toBe(`${SITE_ORIGIN}/`);
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
    const href = 'https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F&code_challenge=abc&code_challenge_method=s256&skip_http_redirect=true';
    const client = {
      auth: {
        signInWithOAuth: async (args: unknown) => {
          called = args;
          return { data: { url: href }, error: null };
        },
      },
    };
    await beginGoogleSignIn(client, 'https://e-kocluk.vercel.app');
    expect(called).toMatchObject({
      provider: 'google',
      options: { redirectTo: 'https://e-kocluk.vercel.app/', skipBrowserRedirect: true },
    });
    const assigned = called as { options: { redirectTo: string } };
    expect(assigned.options.redirectTo).toBe('https://e-kocluk.vercel.app/');
  });

  it('claimGoogleSignupPrefs RPC imzası koç intent taşır', async () => {
    const { claimGoogleSignupPrefs } = await import('./googleOAuth');
    const calls: unknown[] = [];
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: { ok: true, signup_intent: 'coach' }, error: null };
      },
    };
    const res = await claimGoogleSignupPrefs(client, {
      firstName: 'Ali',
      lastName: 'Veli',
      intent: 'coach',
      grade: '',
      track: '',
      exam: '',
      at: Date.now(),
    });
    expect(res.ok).toBe(true);
    expect(calls[0]).toMatchObject({
      fn: 'claim_signup_prefs',
      args: { p_intent: 'coach', p_first_name: 'Ali', p_last_name: 'Veli' },
    });
  });

  it('Google ile Kayıt Ol aynı PKCE yolunu kullanır; pending seed boş alan ezmez', async () => {
    let calls = 0;
    const href = 'https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F&code_challenge=abc&code_challenge_method=s256&skip_http_redirect=true';
    const client = {
      auth: {
        signInWithOAuth: async () => {
          calls += 1;
          return { data: { url: href }, error: null };
        },
      },
    };
    await beginGoogleSignUp(client, 'https://e-kocluk.vercel.app');
    expect(calls).toBe(1);

    const mem = new Map<string, string>();
    const store = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    };
    stashGoogleSignupPending({
      firstName: 'Ali',
      lastName: 'Veli',
      intent: 'student',
      grade: '12. Sınıf',
      track: 'Sayısal',
      exam: 'YKS',
    }, store);
    const pending = takeGoogleSignupPending(store);
    expect(pending?.grade).toBe('12. Sınıf');
    expect(takeGoogleSignupPending(store)).toBeNull();
    expect(applyGoogleSignupPendingToData({ grade: '', track: 'EA', examDate: '' }, pending)).toEqual({
      grade: '12. Sınıf',
      track: 'EA',
      examDate: 'YKS',
    });
    expect(applyGoogleSignupPendingToData({ grade: '11. Sınıf', track: 'EA', examDate: 'LGS' }, pending)).toEqual({
      grade: '11. Sınıf',
      track: 'EA',
      examDate: 'LGS',
    });
    clearGoogleSignupPending(store);

    const page = readFileSync(join(process.cwd(), 'src/pages/AccountPage.tsx'), 'utf8');
    expect(page).toContain('Google ile Kayıt Ol');
    expect(page).toContain('Google ile devam et');
    expect(page).toContain('beginGoogleSignUp');
    expect(page).toContain('beginGoogleSignIn');
    expect(page).not.toContain('service_role');
  });
});
