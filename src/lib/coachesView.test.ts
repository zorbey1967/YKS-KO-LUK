import { describe, expect, it } from 'vitest';
import { coachesAudience, coachesView } from './coachesView';
import { coerceAppPage, coercePageForRole } from './roleNav';
import { sidebarNav } from './types';

describe('coachesView', () => {
  it('ziyaretçi ve öğrenci dizini görür, paneli görmez; sıra book sonra myAppointments', () => {
    const guest = coachesView(coachesAudience({ signedIn: false }));
    expect(guest.showCoachPanel).toBe(false);
    expect(guest.showCoachLoginHint).toBe(true);
    expect(guest.showDirectory).toBe(true);
    expect(guest.appointmentSections).toEqual(['book', 'myAppointments']);

    const student = coachesView(coachesAudience({ signedIn: true, role: 'student' }));
    expect(student.showCoachPanel).toBe(false);
    expect(student.showCoachLoginHint).toBe(false);
    expect(student.showDirectory).toBe(true);
    expect(student.appointmentSections).toEqual(['book', 'myAppointments']);
  });

  it('koç paneli görür, herkese açık giriş formu/dizin almaz', () => {
    const coach = coachesView(coachesAudience({ signedIn: true, role: 'coach' }));
    expect(coach.showCoachPanel).toBe(true);
    expect(coach.showCoachLoginHint).toBe(false);
    expect(coach.showDirectory).toBe(false);
    expect(coach.appointmentSections).toEqual(['myAppointments']);
  });

  it('sunucu yöneticisi koç paneli ve öğrenci keşfini birlikte görür; koç rolüne düşmez', () => {
    const owner = coachesView(coachesAudience({ signedIn: true, role: 'admin', isAdmin: true }));
    expect(owner.showCoachPanel).toBe(true);
    expect(owner.showDirectory).toBe(true);
    expect(owner.showCoachLoginHint).toBe(false);
    expect(owner.appointmentSections).toEqual(['book', 'myAppointments']);
    expect(coercePageForRole('questionbank', 'admin', true)).toBe('questionbank');
    expect(coercePageForRole('admin', 'admin', true)).toBe('admin');
    expect(coercePageForRole('coaches', 'admin', true)).toBe('coaches');
    expect(sidebarNav('admin', true).map((x) => x.id)).toEqual(expect.arrayContaining([
      'home', 'coaches', 'library', 'analytics', 'admin',
    ]));
    expect(sidebarNav('admin', true).map((x) => x.id)).not.toContain('questionbank');
    const coachStill = coachesView(coachesAudience({ signedIn: true, role: 'coach', isAdmin: false }));
    expect(coachStill.showDirectory).toBe(false);
    expect(coercePageForRole('questionbank', 'coach', false)).toBe('coaches');
  });
});

describe('analiz route ve menü', () => {
  it('koç analiz hash’ini koçluk sayfasına düşürür', () => {
    expect(coercePageForRole('analytics', 'coach')).toBe('coaches');
    expect(coerceAppPage('analytics', 'coach', 'ok', false)).toBe('coaches');
  });

  it('öğrenci analize gidebilir (üyelik kilidi ayrı); yönetici is_admin ile kalır', () => {
    expect(coerceAppPage('analytics', 'student', 'ok', false)).toBe('analytics');
    expect(coerceAppPage('analytics', 'admin', 'ok', true)).toBe('analytics');
    expect(coerceAppPage('analytics', 'student', 'ok', true)).toBe('analytics');
  });

  it('misafir analize, yöneticiye ve koçlara hash ile giremez (yalnız giriş)', () => {
    expect(coerceAppPage('analytics', undefined, 'guest', false)).toBe('account');
    expect(coerceAppPage('admin', undefined, 'guest', false)).toBe('account');
    expect(coerceAppPage('coaches', undefined, 'guest', false)).toBe('account');
  });

  it('yönetici menüsünde Analiz ve Yönetici vardır; koç menüsünde Analiz yoktur', () => {
    const adminIds = sidebarNav('admin', true).map((x) => x.id);
    expect(adminIds).toContain('analytics');
    expect(adminIds).toContain('admin');
    expect(sidebarNav('coach', false).map((x) => x.id)).not.toContain('analytics');
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('admin');
    expect(adminIds).not.toContain('questionbank');
    expect(adminIds).toContain('schedule');
    expect(adminIds).toContain('tasks');
    expect(coerceAppPage('analytics', 'coach', 'ok', false)).toBe('coaches');
    expect(coerceAppPage('coaches', 'student', 'ok', false)).not.toBe('analytics');
  });
});
