import { supabase, withTimeout } from './supabase';
import { assertPdfFile } from './pdfStore';

export const COACH_PROGRAM_PDF_BUCKET = 'coach-program-pdfs';

export type CoachProgramPdf = {
  id: string;
  student_id: string;
  coach_id: string;
  student_name: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

function asRow(r: Record<string, unknown>): CoachProgramPdf {
  return {
    id: String(r.id),
    student_id: String(r.student_id || ''),
    coach_id: String(r.coach_id || ''),
    student_name: String(r.student_name || ''),
    storage_path: String(r.storage_path || ''),
    file_name: String(r.file_name || ''),
    file_size: Number(r.file_size) || 0,
    created_at: String(r.created_at || ''),
  };
}

export function filterOwnCoachProgramPdfs<T extends { student_id: string }>(
  rows: T[],
  authUid: string | null,
): T[] {
  if (!authUid) return [];
  return rows.filter((r) => r.student_id === authUid);
}

export function filterCoachProgramPdfsForStudents<T extends { student_id: string }>(
  rows: T[],
  allowedStudentIds: string[],
): T[] {
  const allow = new Set(allowedStudentIds);
  return rows.filter((r) => allow.has(r.student_id));
}

export async function listMyCoachProgramPdfs(): Promise<
  { ok: true; rows: CoachProgramPdf[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: 'Giriş gerekli.' };
  const q = await withTimeout(
    supabase
      .from('coach_program_pdfs')
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,created_at')
      .eq('student_id', uid)
      .order('created_at', { ascending: false })
      .limit(20),
  );
  if (q.error) return { ok: false, error: 'Koç programı yüklenemedi.' };
  const raw = Array.isArray(q.data) ? q.data.map((r) => asRow(r as Record<string, unknown>)) : [];
  return { ok: true, rows: filterOwnCoachProgramPdfs(raw, uid) };
}

export async function listCoachUploadedProgramPdfs(): Promise<
  { ok: true; rows: CoachProgramPdf[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  const q = await withTimeout(
    supabase
      .from('coach_program_pdfs')
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,created_at')
      .order('created_at', { ascending: false })
      .limit(80),
  );
  if (q.error) return { ok: false, error: 'Program listesi yüklenemedi.' };
  const rows = Array.isArray(q.data) ? q.data.map((r) => asRow(r as Record<string, unknown>)) : [];
  return { ok: true, rows };
}

export async function uploadCoachProgramPdf(studentId: string, file: File): Promise<
  { ok: true; row: CoachProgramPdf } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Bulut yapılandırılmadı.' };
  try {
    assertPdfFile(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'PDF geçersiz.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { ok: false, error: 'Giriş gerekli.' };

  const coachQ = await withTimeout(
    supabase.from('coaches').select('id').eq('user_id', sessionData.session.user.id).eq('status', 'active').maybeSingle(),
  );
  const coachId = coachQ.data ? String((coachQ.data as { id: string }).id) : '';
  if (!coachId) return { ok: false, error: 'Aktif koç hesabı gerekli.' };

  const id = crypto.randomUUID();
  const path = `${studentId}/${id}.pdf`;
  const up = await withTimeout(
    supabase.storage.from(COACH_PROGRAM_PDF_BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    }),
  );
  if (up.error) return { ok: false, error: 'PDF yüklenemedi.' };

  const ins = await withTimeout(
    supabase
      .from('coach_program_pdfs')
      .insert({
        id,
        student_id: studentId,
        coach_id: coachId,
        storage_path: path,
        file_name: file.name.slice(0, 260) || 'koc-program.pdf',
        file_size: file.size,
      })
      .select('id,student_id,coach_id,student_name,storage_path,file_name,file_size,created_at')
      .single(),
  );
  if (ins.error || !ins.data) {
    try {
      await supabase.storage.from(COACH_PROGRAM_PDF_BUCKET).remove([path]);
    } catch { /* ignore */ }
    return { ok: false, error: 'Program kaydı yazılamadı.' };
  }
  return { ok: true, row: asRow(ins.data as Record<string, unknown>) };
}

export async function createCoachProgramPdfSignedUrl(storagePath: string): Promise<string | null> {
  if (!supabase || !storagePath) return null;
  const q = await withTimeout(
    supabase.storage.from(COACH_PROGRAM_PDF_BUCKET).createSignedUrl(storagePath, 120),
  );
  if (q.error || !q.data?.signedUrl) return null;
  return q.data.signedUrl;
}
