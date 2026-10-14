import { describe, expect, it } from 'vitest';
import { publicAuthError } from './authUi';
import { isAllowedAuthOrigin } from './authRedirect';
import { readOAuthCallback } from './authCallback';
import { authOAuthRedirectTo } from './googleOAuth';

describe('Google OAuth dönüşü', () => {
  it('code query’de kalır; hash rotasına taşınmaz', () => {
    expect(readOAuthCallback('?code=abc&state=1', '#/home')).toEqual({
      code: 'abc',
      error: null,
      errorDescription: null,
    });
    expect(readOAuthCallback('', '#/account?error=access_denied')).toMatchObject({ error: 'access_denied' });
  });

  it('proje vercel önizlemesine yönlendirir; yabancı origin’i düşürür', () => {
    expect(isAllowedAuthOrigin('https://e-kocluk-git-main.vercel.app')).toBe(true);
    expect(authOAuthRedirectTo('https://e-kocluk.vercel.app')).toBe('https://e-kocluk.vercel.app/');
    expect(authOAuthRedirectTo('https://evil.vercel.app')).toBe('https://e-kocluk.vercel.app/');
  });

  it('iptal ve pkce hatalarını kullanıcıya sızdırmaz', () => {
    expect(publicAuthError(new Error('access_denied'))).toMatch(/iptal/i);
    expect(publicAuthError(new Error('invalid flow state pkce'))).toMatch(/yeniden dene/i);
    expect(publicAuthError(new Error('redirect_uri_mismatch'))).toMatch(/yönlendirme/i);
  });
});
