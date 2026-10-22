import { describe, expect, it } from 'vitest';
import { coerceAppPage, landingPageForRole, postLoginPageForRole } from './roleNav';
import { landingPageForGate, pagesAllowedForGate, resolveAccessGate } from './accessGate';

describe('giriş kapısı', () => {
  it('oturum yokken yalnız giriş ekranı açılır', () => {
    expect(pagesAllowedForGate('guest')).toEqual(['account']);
    expect(landingPageForGate('guest')).toBe('account');
    for (const p of ['home', 'meetings', 'library', 'coaches', 'membership'] as const) {
      expect(coerceAppPage(p, undefined, 'guest')).toBe('account');
    }
  });

  it('giriş anında öğrenci Üyelik sayfasına, koç koçluğa, yönetici ana sayfaya', () => {
    expect(postLoginPageForRole('student')).toBe('membership');
    expect(postLoginPageForRole(undefined)).toBe('membership');
    expect(postLoginPageForRole('coach')).toBe('coaches');
    expect(postLoginPageForRole('admin')).toBe('home');
    // Görüşmeden dönüş gibi giriş dışı yönlendirmeler eskisi gibi ana sayfaya
    expect(landingPageForRole('student')).toBe('home');
  });

  it('boot sırasında yönlendirme yapmaz (oturum yüklenirken giriş ekranı dayatılmaz)', () => {
    expect(resolveAccessGate({ user: null, profile: null, isAdmin: false, authReady: false })).toBe('boot');
    expect(pagesAllowedForGate('boot')).toBeNull();
    expect(coerceAppPage('home', undefined, 'boot')).toBe('home');
  });

  it('öğrenci ve yönetici giriş sonrası ana sayfaya, koç koçluğa gider', () => {
    expect(landingPageForRole('student')).toBe('home');
    expect(landingPageForRole('admin')).toBe('home');
    expect(landingPageForRole('coach')).toBe('coaches');
    expect(landingPageForGate('ok', 'student')).toBe('home');
  });
});
