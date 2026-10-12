import type { PageId, Profile } from './types';

export type AccessGate =
  | 'ok'
  | 'guest'
  | 'unverified'
  | 'pending'
  | 'rejected'
  | 'coach_pending'
  | 'coach_rejected';

export function isEmailConfirmed(user: { email_confirmed_at?: string | null } | null | undefined) {
  return Boolean(user?.email_confirmed_at);
}

export function resolveAccessGate(input: {
  user: { email_confirmed_at?: string | null } | null | undefined;
  profile: Profile | null;
  isAdmin: boolean;
}): AccessGate {
  const { user, profile, isAdmin } = input;
  if (!user) return 'guest';
  if (isAdmin) return 'ok';
  if (profile?.role === 'coach' && profile.account_status !== 'pending' && profile.account_status !== 'rejected') {
    if (profile.account_status === 'pasif') return 'rejected';
    return 'ok';
  }
  if (!isEmailConfirmed(user)) return 'unverified';
  if (profile?.signup_intent === 'coach') {
    const cs = profile.coach_status;
    if (cs === 'active' || profile.role === 'coach') return 'ok';
    if (cs === 'rejected') return 'coach_rejected';
    return 'coach_pending';
  }
  const st = profile?.account_status;
  if (st === 'rejected') return 'rejected';
  if (st === 'pending') return 'pending';
  return 'ok';
}

export function accessMessage(gate: AccessGate) {
  if (gate === 'unverified') {
    return 'E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzdaki bağlantıya tıklayın.';
  }
  if (gate === 'pending') {
    return 'E-posta adresiniz doğrulandı. Başvurunuz yönetici onayı bekliyor.';
  }
  if (gate === 'rejected') {
    return 'Başvurunuz kabul edilmedi. Yeni bir hesap için yöneticiyle iletişime geçin.';
  }
  if (gate === 'coach_pending') {
    return 'Koç başvurunuz alındı. Yönetici onayından sonra koç paneli açılır.';
  }
  if (gate === 'coach_rejected') {
    return 'Koç başvurunuz kabul edilmedi.';
  }
  return '';
}

export function pagesAllowedForGate(gate: AccessGate): PageId[] | null {
  if (gate === 'ok' || gate === 'guest') return null;
  if (gate === 'coach_pending' || gate === 'coach_rejected') return ['account', 'settings', 'coaches'];
  return ['account', 'settings'];
}

export function coercePageForAccess(page: PageId, gate: AccessGate): PageId {
  const allowed = pagesAllowedForGate(gate);
  if (!allowed) return page;
  return allowed.includes(page) ? page : 'account';
}

export function landingPageForGate(gate: AccessGate, role?: string | null): PageId {
  if (gate === 'ok') return role === 'coach' ? 'coaches' : 'home';
  if (gate === 'coach_pending' || gate === 'coach_rejected') return 'coaches';
  return 'account';
}
