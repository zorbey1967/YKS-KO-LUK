import { describe, expect, it } from 'vitest';
import { accountEventAction, authBanDuration, suspendGuard } from './accountSuspend';
import { coerceAppPage } from './roleNav';
import { pagesAllowedForGate, resolveAccessGate } from './accessGate';
import { sidebarNav } from './types';

describe('suspendGuard', () => {
  it('kendi hesabını ve son yöneticiyi askıya almayı reddeder', () => {
    const self = suspendGuard({
      actorId: 'a1',
      targetId: 'a1',
      targetRole: 'student',
      nextStatus: 'pasif',
      activeAdminCount: 2,
    });
    expect(self.ok).toBe(false);

    const lastAdmin = suspendGuard({
      actorId: 'a1',
      targetId: 'a2',
      targetRole: 'admin',
      nextStatus: 'pasif',
      activeAdminCount: 1,
    });
    expect(lastAdmin.ok).toBe(false);

    const owner = suspendGuard({
      actorId: 'a1',
      targetId: 'own1',
      targetRole: 'admin',
      nextStatus: 'pasif',
      activeAdminCount: 3,
      targetIsPlatformOwner: true,
    });
    expect(owner.ok).toBe(false);
  });

  it('öğrenciyi askıya almayı ve yeniden etkinleştirmeyi kabul eder', () => {
    expect(suspendGuard({
      actorId: 'a1',
      targetId: 's1',
      targetRole: 'student',
      nextStatus: 'pasif',
      activeAdminCount: 1,
    }).ok).toBe(true);
    expect(suspendGuard({
      actorId: 'a1',
      targetId: 'a1',
      targetRole: 'admin',
      nextStatus: 'active',
      activeAdminCount: 1,
    }).ok).toBe(true);
  });

  it('Auth ban süresi JWT’yi anında düşürmez; pasif uzun ban, aktif none', () => {
    expect(authBanDuration('pasif')).toBe('876000h');
    expect(authBanDuration('active')).toBe('none');
    expect(accountEventAction('pasif')).toBe('suspend');
    expect(accountEventAction('active')).toBe('reactivate');
  });
});

describe('askıya alınan hesap kapıları', () => {
  it('pasif öğrenci korunan sayfaya giremez; yönetici listesinde kalır varsayımı istemci rolüne bağlı değildir', () => {
    const gate = resolveAccessGate({
      user: { email_confirmed_at: '2026-01-01' },
      profile: { name: 'A', email: '', plan: '', role: 'student', account_status: 'pasif' },
      isAdmin: false,
      authReady: true,
    });
    expect(gate).toBe('suspended');
    expect(pagesAllowedForGate(gate)).toEqual(['account', 'settings']);
    expect(coerceAppPage('questionbank', 'student', gate, false)).toBe('account');
    expect(coerceAppPage('home', 'student', gate, false)).toBe('account');
  });

  it('ziyaretçi yalnız giriş ekranını görür; her URL girişe düşer', () => {
    expect(pagesAllowedForGate('guest')).toEqual(['account']);
    for (const p of ['admin', 'analytics', 'coaches', 'library', 'membership', 'home'] as const) {
      expect(coerceAppPage(p, undefined, 'guest', false)).toBe('account');
    }
    expect(sidebarNav('student', false, pagesAllowedForGate('guest')).map((x) => x.id)).toEqual(['account']);
  });
});
