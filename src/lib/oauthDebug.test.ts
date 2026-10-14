import { describe, expect, it } from 'vitest';
import { authorizeUrlForNavigation, inspectAuthorizeUrl } from './oauthDebug';

describe('Google authorize URL', () => {
  it('authorize URL provider/redirect_to/code_challenge doğrular; skip_http_redirect temizler', () => {
    const raw = 'https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F&code_challenge=x&code_challenge_method=s256&skip_http_redirect=true';
    const href = authorizeUrlForNavigation(raw);
    const info = inspectAuthorizeUrl(href);
    expect(info.ok).toBe(true);
    expect(info.provider).toBe('google');
    expect(info.redirectTo).toBe('https://e-kocluk.vercel.app/');
    expect(info.codeChallenge).toBe(true);
    expect(href).not.toContain('skip_http_redirect');
  });

  it('göreli authorize URL uygulamanın origin’ine çözülmez', () => {
    const href = authorizeUrlForNavigation(
      '/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F&code_challenge=x&code_challenge_method=s256',
      'https://naiakscryafhvcghjmzx.supabase.co',
    );
    expect(href.startsWith('https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize')).toBe(true);
    expect(href).not.toContain('e-kocluk.vercel.app/auth');
    expect(inspectAuthorizeUrl(href, 'https://naiakscryafhvcghjmzx.supabase.co').ok).toBe(true);
    const fromGh = authorizeUrlForNavigation(
      'https://naiakscryafhvcghjmzx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fzorbey1967.github.io%2FYKS-KO-LUK%2F&code_challenge=x&code_challenge_method=s256',
      'https://naiakscryafhvcghjmzx.supabase.co',
    );
    expect(fromGh).toContain('redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F');
    expect(fromGh).not.toContain('github.io');
    expect(inspectAuthorizeUrl('https://e-kocluk.vercel.app/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fe-kocluk.vercel.app%2F&code_challenge=x', 'https://naiakscryafhvcghjmzx.supabase.co').host).toBe('naiakscryafhvcghjmzx.supabase.co');
  });
});
