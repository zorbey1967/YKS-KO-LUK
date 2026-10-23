import { supabase, withTimeout } from './supabase';
import {
  filterOwnSupportTickets,
  parseSenderRole,
  parseSupportStatus,
  type SupportSenderRole,
  type SupportStatus,
} from './supportAccess';

const SAFE_FAIL = 'Mesaj gönderilemedi. Lütfen tekrar deneyin.';

export type SupportTicket = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  body: string;
  status: SupportStatus;
  sender_role: SupportSenderRole;
  created_at: string;
  updated_at: string;
};

export type SupportReply = {
  id: string;
  ticket_id: string;
  role: 'student' | 'coach' | 'admin';
  body: string;
  created_at: string;
};

function asTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    user_id: String(row.user_id || ''),
    first_name: String(row.first_name || ''),
    last_name: String(row.last_name || ''),
    email: String(row.email || ''),
    subject: String(row.subject || ''),
    body: String(row.body || ''),
    status: parseSupportStatus(row.status),
    sender_role: parseSenderRole(row.sender_role),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function asReply(row: Record<string, unknown>): SupportReply {
  const roleRaw = String(row.role || '');
  const role = roleRaw === 'admin' ? 'admin' as const : roleRaw === 'coach' ? 'coach' as const : 'student' as const;
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    role,
    body: String(row.body || ''),
    created_at: String(row.created_at || ''),
  };
}

async function sessionUid(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user?.id || null;
}

const TICKET_COLS = 'id,user_id,first_name,last_name,email,subject,body,status,sender_role,created_at,updated_at';

/** Öğrenci/koç: yalnızca kendi ticket’ları (RLS + istemci user_id filtresi). */
export async function listMySupportTickets(): Promise<{ ok: true; rows: SupportTicket[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: SAFE_FAIL };
  const uid = await sessionUid();
  if (!uid) return { ok: false, error: 'Destek için giriş gerekli.' };
  const q = await withTimeout(
    supabase
      .from('support_tickets')
      .select(TICKET_COLS)
      .eq('user_id', uid)
      .order('created_at', { ascending: false }),
  );
  if (q.error) return { ok: false, error: 'Destek mesajları yüklenemedi.' };
  const raw = Array.isArray(q.data) ? q.data.map((r) => asTicket(r as Record<string, unknown>)) : [];
  return { ok: true, rows: filterOwnSupportTickets(raw, uid) };
}

/** Yönetici: is_admin RLS ile tüm ticket’lar; öğrenci uid filtresi yok. */
export async function listAdminSupportTickets(): Promise<{ ok: true; rows: SupportTicket[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: SAFE_FAIL };
  const uid = await sessionUid();
  if (!uid) return { ok: false, error: 'Destek için giriş gerekli.' };
  const q = await withTimeout(
    supabase
      .from('support_tickets')
      .select(TICKET_COLS)
      .order('created_at', { ascending: false }),
  );
  if (q.error) return { ok: false, error: 'Destek mesajları yüklenemedi.' };
  const rows = Array.isArray(q.data) ? q.data.map((r) => asTicket(r as Record<string, unknown>)) : [];
  return { ok: true, rows };
}

async function notifyAdminSupportTicket(ticketId: string): Promise<void> {
  if (!supabase) return;
  try {
    await withTimeout(
      supabase.functions.invoke('support-notify', { body: { ticket_id: ticketId } }),
      12000,
    );
  } catch {
    /* e-posta best-effort; ticket zaten yazıldı */
  }
}

export async function createSupportTicket(input: {
  firstName: string;
  lastName: string;
  subject: string;
  body: string;
  /** Koç modundan yazılıyorsa 'coach'; sunucu yalnız onaylı koçta kabul eder (063). */
  senderRole?: SupportSenderRole;
}): Promise<{ ok: true; row: SupportTicket } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: SAFE_FAIL };
  const uid = await sessionUid();
  if (!uid) return { ok: false, error: 'Destek için giriş gerekli.' };
  const q = await withTimeout(
    supabase.from('support_tickets').insert({
      user_id: uid,
      first_name: input.firstName,
      last_name: input.lastName,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: 'new',
      sender_role: input.senderRole === 'coach' ? 'coach' : 'student',
    }).select(TICKET_COLS).single(),
  );
  if (q.error || !q.data) return { ok: false, error: SAFE_FAIL };
  const row = asTicket(q.data as Record<string, unknown>);
  if (row.user_id !== uid) return { ok: false, error: SAFE_FAIL };
  void notifyAdminSupportTicket(row.id);
  return { ok: true, row };
}

export async function listSupportReplies(ticketId: string): Promise<SupportReply[]> {
  if (!supabase) return [];
  const q = await withTimeout(
    supabase.from('support_replies').select('id,ticket_id,role,body,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
  );
  if (q.error || !Array.isArray(q.data)) return [];
  return q.data.map((r) => asReply(r as Record<string, unknown>));
}

export async function addSupportReply(ticketId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: SAFE_FAIL };
  const uid = await sessionUid();
  if (!uid) return { ok: false, error: 'Giriş gerekli.' };
  const q = await withTimeout(
    supabase.from('support_replies').insert({ ticket_id: ticketId, author_id: uid, body: body.trim() }),
  );
  if (q.error) return { ok: false, error: SAFE_FAIL };
  return { ok: true };
}

export async function adminSetSupportStatus(ticketId: string, status: SupportStatus): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Durum güncellenemedi.' };
  const q = await withTimeout(
    supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId),
  );
  if (q.error) return { ok: false, error: 'Durum güncellenemedi.' };
  return { ok: true };
}
