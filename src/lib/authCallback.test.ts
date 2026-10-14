import { describe, expect, it } from 'vitest';
import { publicAuthError } from './authUi';
import { isAllowedAuthOrigin } from './authRedirect';
import { completeOAuthCode, consumeOAuthParams, formatOAuthExchangeError, readOAuthCallback, resetOAuthConsumeForTests, urlHasOAuthCallback } from './authCallback';
import { authOAuthRedirectTo } from './googleOAuth';

describe('Google OAuth dönüşü', () => {
  it('code query’de kalır; hash rotasına taşınmaz', () => {
    expect(readOAuthCallback('?code=abc&state=1', '#/home')).toEqual({
      code: 'abc',
      error: null,
      errorDescription: null,
    });
    expect(readOAuthCallback('', '#/account?error=access_denied')).toMatchObject({ error: 'access_denied' });
    expect(readOAuthCallback('', '#/account?code=from-hash')).toMatchObject({ code: 'from-hash' });
    expect(urlHasOAuthCallback('?code=abc', '#/home')).toBe(true);
    expect(urlHasOAuthCallback('', '#/account')).toBe(false);
  });

  it('proje vercel önizlemesine yönlendirir; yabancı origin’i düşürür', () => {
    expect(isAllowedAuthOrigin('https://e-kocluk-git-main.vercel.app')).toBe(true);
    expect(authOAuthRedirectTo('https://e-kocluk.vercel.app')).toBe('https://e-kocluk.vercel.app/');
    expect(authOAuthRedirectTo('https://evil.vercel.app')).toBe('https://e-kocluk.vercel.app/');
  });

  it('iptal ve pkce hatalarını kullanıcıya sızdırmaz; exchange gerçek hatayı ekler', () => {
    expect(publicAuthError(new Error('access_denied'))).toMatch(/iptal/i);
    expect(publicAuthError(new Error('invalid flow state pkce'))).toMatch(/yeniden dene/i);
    expect(publicAuthError(new Error('redirect_uri_mismatch'))).toMatch(/yönlendirme/i);
    expect(formatOAuthExchangeError(new Error('invalid flow state pkce'))).toMatch(/invalid flow state pkce/);
  });

  it('exchangeCodeForSession session yoksa veya error varsa handled döner', async () => {
    const ok = await completeOAuthCode({
      auth: {
        exchangeCodeForSession: async () => ({
          data: { session: { user: { id: 'u1' } } as never },
          error: null,
        }),
      },
    }, { code: 'pkce-code', error: null, errorDescription: null });
    expect(ok.handled).toBe(true);
    expect(ok.message).toMatch(/başarılı/);
    expect(ok.message).toMatch(/exchange\.session=var/);
    expect(ok.message).toMatch(/code=var/);
    expect(ok.debug.exchangeStarted).toBe(true);
    expect(ok.session?.user).toBeTruthy();

    const fail = await completeOAuthCode({
      auth: {
        exchangeCodeForSession: async () => ({
          data: { session: null },
          error: { message: 'invalid request: both auth code and code verifier should be non-empty' },
        }),
      },
    }, { code: 'pkce-code', error: null, errorDescription: null });
    expect(fail.session).toBeNull();
    expect(fail.message).toMatch(/both auth code and code verifier/);
    expect(fail.debug.exchangeError).toMatch(/code verifier/);
  });

  it('aynı code ikinci consume’da exchange tekrarlanmaz', async () => {
    resetOAuthConsumeForTests();
    let n = 0;
    const client = {
      auth: {
        exchangeCodeForSession: async () => {
          n += 1;
          return { data: { session: { user: { id: 'u1' } } as never, user: { id: 'u1' } }, error: null };
        },
        getSession: async () => ({ data: { session: { user: { id: 'u1' } } as never } }),
      },
    };
    const [first, second] = await Promise.all([
      consumeOAuthParams(client, { code: 'once', error: null, errorDescription: null }),
      consumeOAuthParams(client, { code: 'once', error: null, errorDescription: null }),
    ]);
    expect(first.debug.getSession).toBe(true);
    expect(second.debug.reused || first.debug.reused).toBe(true);
    expect(n).toBe(1);
  });
});


