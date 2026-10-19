import { authEmailRedirectTo, isLegacyGithubPagesUrl, isLocalAuthOrigin } from './authRedirect';
import { authorizeUrlForNavigation, inspectAuthorizeUrl } from './oauthDebug';
import { SITE_ORIGIN } from './site';
import { supabaseUrl } from './supabase';

/** Kayıt formu → Google OAuth sonrası yerel seed (PKCE/redirect değişmez). */
export const GOOGLE_SIGNUP_PENDING_KEY = 'yks_google_signup_pending_v1';

export type GoogleSignupPending = {
  firstName: string;
  lastName: string;
  intent: 'student' | 'coach';
  grade: string;
  track: string;
  exam: string;
  at: number;
};

export function stashGoogleSignupPending(prefs: Omit<GoogleSignupPending, 'at'>, store: Pick<Storage, 'setItem'> = sessionStorage) {
  const pack: GoogleSignupPending = {
    firstName: String(prefs.firstName || '').trim().slice(0, 80),
    lastName: String(prefs.lastName || '').trim().slice(0, 80),
    intent: prefs.intent === 'coach' ? 'coach' : 'student',
    grade: String(prefs.grade || '').trim().slice(0, 40),
    track: String(prefs.track || '').trim().slice(0, 40),
    exam: String(prefs.exam || '').trim().slice(0, 40),
    at: Date.now(),
  };
  store.setItem(GOOGLE_SIGNUP_PENDING_KEY, JSON.stringify(pack));
}

export function clearGoogleSignupPending(store: Pick<Storage, 'removeItem'> = sessionStorage) {
  try {
    store.removeItem(GOOGLE_SIGNUP_PENDING_KEY);
  } catch { /* ignore */ }
}

/** Tek seferlik oku; eski/stale paketi at. */
export function takeGoogleSignupPending(
  store: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage,
  now = Date.now(),
  maxAgeMs = 30 * 60 * 1000,
): GoogleSignupPending | null {
  try {
    const raw = store.getItem(GOOGLE_SIGNUP_PENDING_KEY);
    store.removeItem(GOOGLE_SIGNUP_PENDING_KEY);
    if (!raw) return null;
    const pack = JSON.parse(raw) as GoogleSignupPending;
    if (!pack || typeof pack !== 'object') return null;
    if (!Number.isFinite(pack.at) || now - pack.at > maxAgeMs) return null;
    return {
      firstName: String(pack.firstName || '').trim().slice(0, 80),
      lastName: String(pack.lastName || '').trim().slice(0, 80),
      intent: pack.intent === 'coach' ? 'coach' : 'student',
      grade: String(pack.grade || '').trim().slice(0, 40),
      track: String(pack.track || '').trim().slice(0, 40),
      exam: String(pack.exam || '').trim().slice(0, 40),
      at: Number(pack.at) || 0,
    };
  } catch {
    clearGoogleSignupPending(store);
    return null;
  }
}

/** Boş alanları ezmez; mevcut hesapta ikinci kayıt / veri taşıma yok. */
export function applyGoogleSignupPendingToData<T extends {
  grade?: string;
  track?: string;
  examDate?: string;
}>(data: T, pending: GoogleSignupPending | null): T {
  if (!pending) return data;
  return {
    ...data,
    grade: data.grade || pending.grade || data.grade,
    track: data.track || pending.track || data.track,
    examDate: data.examDate || pending.exam || data.examDate,
  };
}

/** OAuth dönüşünde profiles.signup_intent (052 claim_signup_prefs). Admin olamaz. */
export async function claimGoogleSignupPrefs(
  client: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
  pending: GoogleSignupPending,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await client.rpc('claim_signup_prefs', {
      p_intent: pending.intent,
      p_grade: pending.grade,
      p_track: pending.track,
      p_exam: pending.exam,
      p_first_name: pending.firstName,
      p_last_name: pending.lastName,
    });
    if (error) return { ok: false, error: error.message };
    const rec = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    if (rec.ok === false) return { ok: false, error: String(rec.error || 'intent yazılamadı') };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'intent yazılamadı' };
  }
}

/** Production Google callback yalnızca Vercel; GitHub Pages / yabancı origin yok. */
export function authOAuthRedirectTo(candidateOrigin?: string) {
  const raw = String(candidateOrigin || SITE_ORIGIN).trim().replace(/\/$/, '');
  if (isLegacyGithubPagesUrl(raw) || !isLocalAuthOrigin(raw)) return `${SITE_ORIGIN}/`;
  return `${raw}/`;
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
  const spec = googleOAuthOptions(origin);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: spec.provider,
    options: { ...spec.options, skipBrowserRedirect: true },
  });
  if (error) {
    throw new Error(error.message);
  }
  const raw = data?.url;
  if (!raw) {
    throw new Error('Google yönlendirme adresi oluşmadı.');
  }
  const href = authorizeUrlForNavigation(raw, supabaseUrl);
  const info = inspectAuthorizeUrl(href, supabaseUrl);
  if (!info.ok) {
    throw new Error('Google authorize URL eksik (provider/redirect_to/code_challenge).');
  }
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign(href);
  }
}

/** Aynı PKCE/OAuth; Supabase yeni Google kimliğinde hesap açar, mevcutta giriş yapar. */
export async function beginGoogleSignUp(client: GoogleOAuthClient, origin?: string) {
  return beginGoogleSignIn(client, origin);
}

export { authEmailRedirectTo };
