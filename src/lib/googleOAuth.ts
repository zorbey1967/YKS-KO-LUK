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

export function googleAuthorizeFailureMessage(status: number, bodyText: string) {
  if (status === 400 && /provider is not enabled|Unsupported provider/i.test(bodyText)) {
    return googleSignInBlockedReason();
  }
  return null;
}

type GoogleOAuthClient = {
  auth: {
    signInWithOAuth: (args: {
      provider: 'google';
      options: {
        redirectTo: string;
        queryParams?: { prompt: string };
        skipBrowserRedirect: boolean;
      };
    }) => PromiseLike<{ data: { url?: string | null } | null; error: { message: string } | null }>;
  };
};

/** Authorize URL’si önceden fetch edilmez (PKCE verifier tarayıcıda kalır). */
export async function beginGoogleSignIn(client: GoogleOAuthClient, origin?: string) {
  const spec = googleOAuthOptions(origin);
  const { error } = await client.auth.signInWithOAuth({
    provider: spec.provider,
    options: spec.options,
  });
  if (error) throw new Error(error.message);
}

export { authEmailRedirectTo };
