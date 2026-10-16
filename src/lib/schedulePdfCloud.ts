import { supabase, withTimeout } from './supabase';
import { assertPdfFile } from './pdfStore';

export const SCHEDULE_PDF_BUCKET = 'schedule-pdfs';

export type SchedulePdfSubmission = {
  id: string;
  student_id: string;
  coach_id: string;
  student_name: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  status: 'sent';
  created_at: string;
};

function asRow(r: Record<string, unknown>): SchedulePdfSubmission {
  return {
    id: String(r.id),
    student_id: String(r.student_id || ''),
    coach_id: String(r.coach_id || ''),
    student_name: String(r.student_name || ''),
    storage_path: String(r.storage_path || ''),
    file_name: String(r.file_name || ''),
    file_size: Number(r.file_size) || 0,
    status: 'sent',
    created_at: String(r.created_at || ''),
  };
}

/** Öğrenci A satırını B asla client filtreyle görmemeli. */
export function filterOwnSchedulePdfs<T extends { student_id: string }>(rows: T[], authUid: string | null): T[] {
  if (!authUid) return [];
  return rows.filter((r) => r.student_id === authUid);
}

export function filterCoachSchedulePdfsForStudents<T extends { student_id: string }>(
  rows: T[],
  allowedStudentIds: string[],
): T[] {
  const allow = new Set(allowedStudentIds);
  return rows.filter((r) => allow.has(r.student_id));
}

export async function fetchLinkedCoachId(): Promise<string | null> {
  if (!supabase) return null;
  const q = await withTimeout(supabase.rpc('student_linked_coach_id'));
  if (q.error || !q.data) return null;
  return String(q.data);
}

export async function listMySchedulePdfSubmissions(): Promise<
  { ok: true; rows: SchedulePdfSubmission[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: 'Giriş gerekli.' };
  const q = await withTimeout(
    supabase
      .from('schedule_pdf_submissions')
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,status,created_at')
      .eq('student_id', uid)
      .order('created_at', { ascending: false })
      .limit(20),
  );
  if (q.error) return { ok: false, error: 'Gönderimler yüklenemedi.' };
  const raw = Array.isArray(q.data) ? q.data.map((r) => asRow(r as Record<string, unknown>)) : [];
  return { ok: true, rows: filterOwnSchedulePdfs(raw, uid) };
}

export async function listCoachSchedulePdfSubmissions(): Promise<
  { ok: true; rows: SchedulePdfSubmission[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  const q = await withTimeout(
    supabase
      .from('schedule_pdf_submissions')
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,status,created_at')
      .order('created_at', { ascending: false })
      .limit(80),
  );
  if (q.error) return { ok: false, error: 'Öğrenci programları yüklenemedi.' };
  const rows = Array.isArray(q.data) ? q.data.map((r) => asRow(r as Record<string, unknown>)) : [];
  return { ok: true, rows };
}

export async function sendSchedulePdfToCoach(file: File): Promise<
  { ok: true; row: SchedulePdfSubmission } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  try {
    assertPdfFile(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'PDF geçersiz.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: 'Giriş gerekli.' };
  const coachId = await fetchLinkedCoachId();
  if (!coachId) return { ok: false, error: 'Bağlı koç yok. Önce koç eşleşmesi veya onaylı randevu gerekir.' };

  const id = crypto.randomUUID();
  const path = `${uid}/${id}.pdf`;
  const up = await withTimeout(
    supabase.storage.from(SCHEDULE_PDF_BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    }),
  );
  if (up.error) return { ok: false, error: 'PDF yüklenemedi.' };

  const ins = await withTimeout(
    supabase
      .from('schedule_pdf_submissions')
      .insert({
        id,
        student_id: uid,
        coach_id: coachId,
        storage_path: path,
        file_name: file.name.slice(0, 260) || 'program.pdf',
        file_size: file.size,
        status: 'sent',
      })
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,status,created_at')
      .single(),
  );
  if (ins.error || !ins.data) {
    try {
      await supabase.storage.from(SCHEDULE_PDF_BUCKET).remove([path]);
    } catch { /* ignore */ }
    return { ok: false, error: 'Koça gönderilemedi.' };
  }
  const row = asRow(ins.data as Record<string, unknown>);
  if (row.student_id !== uid) return { ok: false, error: 'Koça gönderilemedi.' };
  return { ok: true, row };
}

export async function createSchedulePdfSignedUrl(storagePath: string): Promise<string | null> {
  if (!supabase || !storagePath) return null;
  const q = await withTimeout(
    supabase.storage.from(SCHEDULE_PDF_BUCKET).createSignedUrl(storagePath, 120),
  );
  if (q.error || !q.data?.signedUrl) return null;
  return q.data.signedUrl;
}
