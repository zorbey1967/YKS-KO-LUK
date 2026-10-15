import { describe, expect, it } from 'vitest';
import { coerceAppPage, landingPageForRole } from './roleNav';
import { landingPageForGate, pagesAllowedForGate, resolveAccessGate } from './accessGate';

describe('giriş kapısı', () => {
  it('oturum yokken ilk açılış hesabadır; koçlar kamu', () => {
    expect(pagesAllowedForGate('guest')).toEqual(['account', 'coaches', 'library']);
    expect(landingPageForGate('guest')).toBe('account');
    expect(coerceAppPage('home', undefined, 'guest')).toBe('account');
    expect(coerceAppPage('meetings', undefined, 'guest')).toBe('account');
    expect(coerceAppPage('library', undefined, 'guest')).toBe('library');
    expect(coerceAppPage('coaches', undefined, 'guest')).toBe('coaches');
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
