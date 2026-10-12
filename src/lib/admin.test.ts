import { describe, expect, it } from 'vitest';
import { canAccessAdminPanel, isPlatformOwner } from './admin';

describe('canAccessAdminPanel', () => {
  it('yalnızca sunucu is_admin=true ile paneli açar', () => {
    expect(canAccessAdminPanel({ email: 'owner@example.com' }, true)).toBe(true);
    expect(canAccessAdminPanel({ email: 'anyone@mail.com' }, true)).toBe(true);
  });

  it('e-posta veya istemci iddiası paneli açmaz', () => {
    expect(canAccessAdminPanel({ email: 'yusufbesiroglu357@gmail.com' }, false)).toBe(false);
    expect(canAccessAdminPanel({ email: 'yusufbesiroglu357@gmail.com' }, null)).toBe(false);
    expect(canAccessAdminPanel({ email: 'admin@example.com' }, null)).toBe(false);
    expect(canAccessAdminPanel(null, false)).toBe(false);
  });

  it('isPlatformOwner e-posta eşlemesi paneli yetkilendirmez', () => {
    expect(isPlatformOwner({ email: 'yusufbesiroglu357@gmail.com' })).toBe(true);
    expect(canAccessAdminPanel({ email: 'yusufbesiroglu357@gmail.com' }, false)).toBe(false);
  });

  it('istemci role=admin veya localStorage iddiası paneli açmaz', () => {
    expect(canAccessAdminPanel({ email: 'x@y.z', role: 'admin' } as { email: string }, false)).toBe(false);
    expect(canAccessAdminPanel({ email: '' }, null)).toBe(false);
  });
});
