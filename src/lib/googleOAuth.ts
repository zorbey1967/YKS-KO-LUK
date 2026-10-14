import { authEmailRedirectTo, isAllowedAuthOrigin } from './authRedirect';
import { SITE_ORIGIN } from './site';

/** PKCE: kod query’de kalır; hash rota ile çakışmaz. */
export function authOAuthRedirectTo(candidateOrigin?: string) {
  const raw = String(candidateOrigin || SITE_ORIGIN).trim().replace(/\/$/, '');
  const origin = isAllowedAuthOrigin(raw) ? raw : SITE_ORIGIN;
  return `${origin}/`;
}

export function googleOAuthOptions(origin?: string) {
  return {
    provider: 'google' as const,
    options: {
      redirectTo: authOAuthRedirectTo(origin),
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: false,
    },
  };
}

/** Mevcut e-posta hesabına otomatik link yok; Supabase Dashboard’da Automatic linking kapalı olmalı. */
export function shouldAutoLinkIdentities() {
  return false;
}

export function googleSignInBlockedReason() {
  return 'Google girişi bu ortamda yapılandırılmamış. E-posta ile devam et. Otomatik hesap birleştirme kapalıdır.';
}

export { authEmailRedirectTo };
