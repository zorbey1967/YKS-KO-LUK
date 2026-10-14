import { authEmailRedirectTo, isAllowedAuthOrigin } from './authRedirect';
import { authorizeUrlForNavigation, inspectAuthorizeUrl, writeOAuthDebug, yesNo } from './oauthDebug';
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

/** PKCE verifier tarayıcıda kalır; authorize sayfası fetch edilmez, yalnızca location.assign. */
export async function beginGoogleSignIn(client: GoogleOAuthClient, origin?: string) {
  writeOAuthDebug({ step: 'signin_start' });
  const spec = googleOAuthOptions(origin);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: spec.provider,
    options: { ...spec.options, skipBrowserRedirect: true },
  });
  if (error) {
    writeOAuthDebug({ step: 'signin_error', exchangeError: error.message, exchange: 'ERROR' });
    throw new Error(error.message);
  }
  const raw = data?.url;
  if (!raw) {
    writeOAuthDebug({ step: 'signin_error', exchangeError: 'Authorize URL yok', exchange: 'ERROR' });
    throw new Error('Google yönlendirme adresi oluşmadı.');
  }
  const href = authorizeUrlForNavigation(raw);
  const info = inspectAuthorizeUrl(href);
  writeOAuthDebug({
    step: 'authorize_ready',
    provider: info.provider,
    redirectTo: info.redirectTo,
    codeChallenge: yesNo(info.codeChallenge),
    authorizeState: yesNo(info.authorizeState),
  });
  if (!info.ok) {
    throw new Error('Google authorize URL eksik (provider/redirect_to/code_challenge).');
  }
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    writeOAuthDebug({ step: 'redirecting' });
    window.location.assign(href);
  }
}

export { authEmailRedirectTo };
