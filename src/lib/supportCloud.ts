import { supabase, withTimeout } from './supabase';
import { parseSupportStatus, type SupportStatus } from './supportAccess';

export type SupportTicket = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  body: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
};

export type SupportReply = {
  id: string;
  ticket_id: string;
  role: 'student' | 'admin';
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
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export async function listMySupportTickets(): Promise<{ ok: true; rows: SupportTicket[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Destek kaydı yazılamadı.' };
  const q = await withTimeout(
    supabase.from('support_tickets').select('id,user_id,first_name,last_name,email,subject,body,status,created_at,updated_at').order('created_at', { ascending: false }),
  );
  if (q.error) return { ok: false, error: 'Destek mesajları yüklenemedi.' };
  const rows = Array.isArray(q.data) ? q.data.map((r) => asTicket(r as Record<string, unknown>)) : [];
  return { ok: true, rows };
}

export async function createSupportTicket(input: {
  firstName: string;
  lastName: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; row: SupportTicket } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Destek kaydı yazılamadı.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: 'Destek için giriş gerekli.' };
  const q = await withTimeout(
    supabase.from('support_tickets').insert({
      user_id: uid,
      first_name: input.firstName,
      last_name: input.lastName,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: 'new',
    }).select('id,user_id,first_name,last_name,email,subject,body,status,created_at,updated_at').single(),
  );
  if (q.error || !q.data) return { ok: false, error: 'Mesaj gönderilemedi. Üyelik ve hesap değişmedi.' };
  return { ok: true, row: asTicket(q.data as Record<string, unknown>) };
}

export async function listSupportReplies(ticketId: string): Promise<SupportReply[]> {
  if (!supabase) return [];
  const q = await withTimeout(
    supabase.from('support_replies').select('id,ticket_id,role,body,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
  );
  if (q.error || !Array.isArray(q.data)) return [];
  return q.data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      ticket_id: String(row.ticket_id),
      role: row.role === 'admin' ? 'admin' as const : 'student' as const,
      body: String(row.body || ''),
      created_at: String(row.created_at || ''),
    };
  });
}

export async function addSupportReply(ticketId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Yanıt yazılamadı.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: 'Giriş gerekli.' };
  const q = await withTimeout(
    supabase.from('support_replies').insert({ ticket_id: ticketId, author_id: uid, role: 'student', body: body.trim() }),
  );
  if (q.error) return { ok: false, error: 'Yanıt gönderilemedi.' };
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
