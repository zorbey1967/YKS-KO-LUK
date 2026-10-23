import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createIsolatedAuthClient, withTimeout } from './supabase';
import { getPersonDisplayName } from './displayName';
import { setMyCoachPhoto } from './cloudPlatform';

/**
 * "Koç olarak gir": koç kaydı uygulamaya girmeden, geçici (kaydedilmeyen) oturumla denetlenir.
 * Yalnız onaylı koçun oturumu uygulamaya aktarılır; başvuru ve "onay bekliyor" giriş ekranında kalır.
 */
export type CoachGate =
  | { kind: 'enter'; session: Session }
  | { kind: 'pending' }
  | { kind: 'suspended' }
  | { kind: 'apply'; reapply: boolean; client: SupabaseClient; userId: string; email: string; name: string }
  | { kind: 'error'; error: unknown };

export const PENDING_COACH_KEY = 'yks_pending_coach_app';
const PENDING_COACH_TTL_MS = 7 * 86_400_000;

export const COACH_GATE_PENDING_MSG =
  'Koç başvurun yönetici onayı bekliyor. Onaylanınca "Koç olarak gir" ile girebilirsin. Öğrenci tarafı için "Öğrenci olarak gir" seç.';
export const COACH_GATE_SUSPENDED_MSG =
  'Koç kaydın pasife alındı. Yönetici yeniden açana kadar koç olarak girilemez. Öğrenci tarafı için "Öğrenci olarak gir" seç.';
export const COACH_GATE_APPLIED_MSG =
  'Koç başvurun alındı. Yönetici onaylayınca "Koç olarak gir" ile girebilirsin. Öğrenci tarafı için "Öğrenci olarak gir" seç.';

export async function endIsolatedSession(client: SupabaseClient) {
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
}

/** Kayıtta bu cihazda seçilen fotoğraf, başvuru fotoğrafsızsa eklenir (yalnız aynı e-postalı hesap). */
export async function fillPendingCoachPhoto(client: SupabaseClient, userId: string, email: string) {
  let raw = '';
  try { raw = localStorage.getItem(PENDING_COACH_KEY) || ''; } catch { return; }
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as { email?: string; photo?: string; savedAt?: number };
    if (!(Number(p.savedAt) > Date.now() - PENDING_COACH_TTL_MS)) {
      localStorage.removeItem(PENDING_COACH_KEY);
      return;
    }
    if (String(p.email || '').trim().toLowerCase() !== email.trim().toLowerCase()) return;
    if (p.photo) await setMyCoachPhoto(userId, p.photo, client);
    localStorage.removeItem(PENDING_COACH_KEY);
  } catch { /* ignore */ }
}

export async function checkCoachLogin(email: string, password: string): Promise<CoachGate> {
  const client = createIsolatedAuthClient();
  if (!client) return { kind: 'error', error: new Error('Supabase yapılandırılmadı.') };
  const { data, error } = await withTimeout(client.auth.signInWithPassword({ email, password }));
  if (error || !data.session || !data.user) return { kind: 'error', error: error || new Error('Giriş yapılamadı.') };
  const uid = data.user.id;
  try {
    const [prof, coach] = await Promise.all([
      withTimeout(client.from('profiles').select('name, role, account_status').eq('id', uid).maybeSingle()),
      withTimeout(client.from('coaches').select('status, photo').eq('user_id', uid).maybeSingle()),
    ]);
    if (prof.error) throw prof.error;
    if (coach.error) throw coach.error;
    const role = String(prof.data?.role || 'student');
    // Yönetici ve askıdaki hesap normal girişten geçer (uygulama kendi kapısını uygular).
    if (role === 'admin' || prof.data?.account_status === 'pasif') return { kind: 'enter', session: data.session };
    const status = coach.data?.status ? String(coach.data.status) : '';
    if (status === 'active') return { kind: 'enter', session: data.session };
    if (status === 'pending') {
      if (!coach.data?.photo) await fillPendingCoachPhoto(client, uid, data.user.email || email);
      await endIsolatedSession(client);
      return { kind: 'pending' };
    }
    if (status === 'pasif') {
      await endIsolatedSession(client);
      return { kind: 'suspended' };
    }
    return {
      kind: 'apply',
      reapply: status === 'rejected',
      client,
      userId: uid,
      email: data.user.email || email,
      name: getPersonDisplayName(String(prof.data?.name || ''), ''),
    };
  } catch (e) {
    await endIsolatedSession(client);
    return { kind: 'error', error: e };
  }
}
