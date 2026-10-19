import { supabase, withTimeout } from './supabase';
import { userFacingCloudError } from './postgrestError';
import {
  moderationKindLabel,
  moderationStatusLabel,
  type ModerationKind,
  type ModerationStatus,
} from './contentModeration';

export type ModerationViolationRow = {
  id: string;
  user_id: string;
  kind: ModerationKind;
  category: string;
  confidence: number;
  status: ModerationStatus;
  appointment_id: string | null;
  evidence_label: string;
  admin_notes: string;
  admin_actor_id: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
};

const SAFE = 'İşlem şu an tamamlanamadı.';

export async function fetchModerationConfig(): Promise<{
  configured: boolean;
  lexicon: boolean;
  gemini: boolean;
  voiceStt: boolean;
  voiceEnforcement: boolean;
  authBan: boolean;
  note: string;
}> {
  if (!supabase) {
    return {
      configured: false,
      lexicon: false,
      gemini: false,
      voiceStt: false,
      voiceEnforcement: false,
      authBan: false,
      note: 'Sunucu yok.',
    };
  }
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('content-moderate', { body: { action: 'status' } }),
      12000,
    );
    if (error) {
      return {
        configured: false,
        lexicon: true,
        gemini: false,
        voiceStt: false,
        voiceEnforcement: false,
        authBan: false,
        note: 'content-moderate henüz yayınlanmamış olabilir.',
      };
    }
    const b = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    return {
      configured: b.configured === true,
      lexicon: b.lexicon === true,
      gemini: b.gemini === true,
      voiceStt: b.voice_stt === true,
      voiceEnforcement: b.voice_enforcement === true,
      authBan: b.auth_ban === true,
      note: String(b.note || ''),
    };
  } catch {
    return {
      configured: false,
      lexicon: true,
      gemini: false,
      voiceStt: false,
      voiceEnforcement: false,
      authBan: false,
      note: SAFE,
    };
  }
}

export async function moderateDisplayNameRemote(firstName: string, lastName: string): Promise<{
  ok: boolean;
  blocked: boolean;
  message: string;
  suspended: boolean;
}> {
  if (!supabase) return { ok: false, blocked: false, message: 'Sunucu bağlantısı yok.', suspended: false };
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('content-moderate', {
        body: { action: 'check_name', first_name: firstName, last_name: lastName },
      }),
      15000,
    );
    if (error) {
      return { ok: false, blocked: false, message: userFacingCloudError(error, SAFE), suspended: false };
    }
    const b = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    return {
      ok: b.ok !== false,
      blocked: b.blocked === true,
      message: String(b.message || ''),
      suspended: b.suspended === true,
    };
  } catch (e) {
    return { ok: false, blocked: false, message: userFacingCloudError(e, SAFE), suspended: false };
  }
}

/**
 * @deprecated İstemci transcript yolu sunucuda 403 ile reddedilir.
 * Ses denetimi yalnızca imzalı meeting-stt-webhook ile yapılır.
 */
export async function submitVoiceModeration(_appointmentId: string, _transcript: string): Promise<{
  ok: boolean;
  blocked: boolean;
  suspended: boolean;
  message: string;
  configured: boolean;
  rejected: boolean;
}> {
  return {
    ok: false,
    blocked: false,
    suspended: false,
    message: 'İstemci konuşma metni kabul edilmez. Ses denetimi sunucu STT webhook ile yapılır.',
    configured: false,
    rejected: true,
  };
}

function asViolation(r: Record<string, unknown>): ModerationViolationRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    kind: (r.kind === 'voice_meeting' ? 'voice_meeting' : 'display_name'),
    category: String(r.category || ''),
    confidence: Number(r.confidence) || 0,
    status: (['reviewing', 'suspended', 'appealed', 'restored'].includes(String(r.status))
      ? String(r.status) as ModerationStatus
      : 'reviewing'),
    appointment_id: r.appointment_id ? String(r.appointment_id) : null,
    evidence_label: String(r.evidence_label || ''),
    admin_notes: String(r.admin_notes || ''),
    admin_actor_id: r.admin_actor_id ? String(r.admin_actor_id) : null,
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  };
}

export async function adminListModerationViolations(): Promise<{ ok: boolean; rows: ModerationViolationRow[]; error?: string }> {
  if (!supabase) return { ok: false, rows: [], error: 'Sunucu yok.' };
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('admin_list_moderation_violations', { p_limit: 100 }),
    );
    if (error) {
      if (/does not exist|schema cache|42883/i.test(error.message || '')) {
        return { ok: false, rows: [], error: 'İhlal tablosu bu ortamda yok (050 uygulanmalı).' };
      }
      return { ok: false, rows: [], error: userFacingCloudError(error, SAFE) };
    }
    const rows = (Array.isArray(data) ? data : []).map((r) => asViolation(r as Record<string, unknown>));
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, rows: [], error: userFacingCloudError(e, SAFE) };
  }
}

export async function adminReviewModerationViolation(input: {
  id: string;
  status: ModerationStatus;
  notes: string;
  reactivate: boolean;
}): Promise<{ ok: boolean; error?: string; userId?: string; authSyncStatus?: string }> {
  if (!supabase) return { ok: false, error: 'Sunucu yok.' };
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('admin_review_moderation_violation', {
        p_id: input.id,
        p_status: input.status,
        p_notes: input.notes,
        p_reactivate: input.reactivate,
      }),
    );
    if (error) return { ok: false, error: userFacingCloudError(error, SAFE) };
    const rec = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    if (rec.ok === false) return { ok: false, error: String(rec.error || SAFE) };
    return {
      ok: true,
      userId: rec.user_id ? String(rec.user_id) : undefined,
      authSyncStatus: rec.auth_sync_status ? String(rec.auth_sync_status) : undefined,
    };
  } catch (e) {
    return { ok: false, error: userFacingCloudError(e, SAFE) };
  }
}

/** İhlal durumu ile profil account_status uyumsuz mu? */
export function moderationAccountMismatch(
  violationStatus: ModerationStatus,
  accountStatus: string | undefined,
): 'ok' | 'viol_suspended_acct_active' | 'viol_restored_acct_pasif' | 'unknown' {
  if (!accountStatus) return 'unknown';
  if (violationStatus === 'suspended' && accountStatus === 'active') return 'viol_suspended_acct_active';
  if ((violationStatus === 'restored' || violationStatus === 'reviewing') && accountStatus === 'pasif') {
    return 'viol_restored_acct_pasif';
  }
  return 'ok';
}

export { moderationKindLabel, moderationStatusLabel };
