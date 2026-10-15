import type { AppData } from './types';
import { normalizeData } from './storage';
import { parsePushResult } from './syncMerge';
import { coachStudyBrief, type CoachStudyBrief } from './coachBrief';
import type { AppointmentStatus, CoachAccount, CoachAppointment, CoachDesk, CoachHomework, CoachStatus, CoachStudent, CoachTrack, HumanCoach } from './coaches';
import { asCancelDecision, asCancelReason, COACH_TRACKS, emptyDesk } from './coaches';
import { getCoachDisplayName, getPersonDisplayName } from './displayName';
import { SESSION_REQUIRED, SUPABASE_UNAVAILABLE, publicCloudError, requireUserSession, supabase, withTimeout } from './supabase';
import { interpretStartTopPlanTrialRpc } from './trialStart';

type LedgerKind = 'odeme' | 'iade';
type LedgerStatus = 'bekliyor' | 'odendi' | 'iade';

export type LedgerEntry = {
  id: string;
  date: string;
  coachId: string;
  coachName: string;
  amount: number;
  commission: number;
  kind: LedgerKind;
  status: LedgerStatus;
  note: string;
};

export type ProfileRole = 'student' | 'coach' | 'admin';
export type AccountStatus = 'active' | 'pasif' | 'pending' | 'rejected';

export type CloudProfile = {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: ProfileRole;
  account_status: AccountStatus;
  signup_intent?: 'student' | 'coach';
  signup_grade?: string;
  signup_track?: string;
  signup_exam?: string;
  approval_note?: string;
  target_department?: string;
  target_rank?: number;
};

export type StudentApplication = {
  id: string;
  name: string;
  email: string;
  registered_at: string;
  account_status: AccountStatus;
  email_confirmed: boolean;
  signup_grade: string;
  signup_track: string;
  signup_exam: string;
  approval_note: string;
};

export function parseAccountStatus(raw: unknown): AccountStatus {
  const s = String(raw || '');
  if (s === 'pasif' || s === 'pending' || s === 'rejected' || s === 'active') return s;
  return 'active';
}

export type CloudCoach = Omit<CoachAccount, 'passHash'> & { userId: string | null };

export type CloudAppointment = CoachAppointment & { coachName: string };

export type CloudLink = {
  coachId: string;
  coachName: string;
  studentName: string;
  grade: string;
};

export type CloudAdminBundle = {
  source: 'supabase' | 'local';
  profiles: CloudProfile[];
  coaches: CloudCoach[];
  desks: Record<string, CoachDesk>;
  appts: CloudAppointment[];
  links: CloudLink[];
  finance: LedgerEntry[];
  notes: { id: string; coachId: string; text: string; at: string }[];
};

function isMissingRelation(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /schema cache|does not exist|Could not find the table|Could not find the function/i.test(msg);
}

function asTrack(s: unknown): CoachTrack {
  return COACH_TRACKS.includes(s as CoachTrack) ? (s as CoachTrack) : 'Okul';
}

function asStatus(s: unknown): CoachStatus {
  return s === 'pending' || s === 'rejected' || s === 'pasif' || s === 'active' ? s : 'pending';
}

function asAppt(s: unknown): AppointmentStatus {
  return s === 'bekliyor' || s === 'onay' || s === 'iptal' || s === 'tamamlandi' ? s : 'bekliyor';
}

export function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function rpcUserMessage(e: unknown): string {
  const obj = e && typeof e === 'object' ? e as { message?: unknown; code?: unknown } : null;
  const msg = obj && 'message' in obj ? String(obj.message || '') : e instanceof Error ? e.message : '';
  const code = obj && 'code' in obj ? String(obj.code || '') : '';
  if (
    code === '42501'
    || /permission denied for function/i.test(msg)
    || /jwt expired|invalid jwt|not authenticated|session missing/i.test(msg)
  ) {
    return SESSION_REQUIRED;
  }
  const known = [
    'koç hesabı yok',
    'geçmiş saat eklenemez',
    'slot en az 30 dk sonra olmalı',
    'müsaitlik çakışıyor',
    'slot yok',
    'onaylı randevu sessiz silinemez',
    'oturum gerekli',
    'slot müsait değil',
    'koç aktif değil',
    'son talep 30 dk kala kapanır',
    'randevu yok',
    'yetkisiz',
    'talep açık değil',
    'onay penceresi kapandı',
    'bu saat başka koçta onaylı',
    'bu koçta bu saat için talebin var',
    'yalnız açık saatten talep',
    'hesap onay bekliyor',
    'üyelik gerekli',
    'e-posta doğrulanmamış',
    'öğrenci ve ödev gerekli',
    'bu öğrenci randevu veya eşleşme ile bağlı değil',
    'ödev yok',
  ];
  if (/bu ad veya soyad kullanılamaz/i.test(msg)) {
    return 'Bu ad veya soyad kullanılamaz. Lütfen gerçek adınızı ve soyadınızı girin.';
  }
  const hit = known.find((k) => msg.toLowerCase().includes(k));
  if (hit === 'oturum gerekli') return SESSION_REQUIRED;
  if (hit === 'hesap onay bekliyor') return 'Hesabınız yönetici onayı bekliyor.';
  if (hit === 'üyelik gerekli') return 'Deneme veya ücretli üyelik gerekli.';
  if (hit === 'e-posta doğrulanmamış') return 'E-posta adresiniz doğrulanmamış.';
  if (hit === 'yetkisiz') return 'Bu işlem için yetkiniz yok.';
  if (hit) return hit.charAt(0).toUpperCase() + hit.slice(1) + '.';
  return publicCloudError(e);
}

function mapCoach(row: Record<string, unknown>): CloudCoach {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    name: getCoachDisplayName(String(row.name || '')),
    email: String(row.email || ''),
    track: asTrack(row.track),
    focus: String(row.focus || ''),
    photo: String(row.photo || ''),
    studentCount: Number(row.student_count) || 0,
    status: asStatus(row.status),
    score: Math.max(0, Math.min(100, Number(row.score) || 100)),
  };
}

function directoryToHuman(row: Record<string, unknown>): HumanCoach {
  const studentCount = Number(row.student_count) || 0;
  const bio = String(row.bio || '').trim();
  const experience = String(row.experience || '').trim();
  return {
    id: String(row.id || ''),
    name: getCoachDisplayName(String(row.name || '')),
    track: asTrack(row.track),
    focus: String(row.focus || ''),
    weeklyHours: 5,
    approach: bio || experience || `${studentCount} öğrenci`,
    photo: String(row.photo || ''),
    studentCount,
  };
}

export async function fetchActiveCoaches(): Promise<{ ok: true; coaches: HumanCoach[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: SUPABASE_UNAVAILABLE };
  try {
    const { data, error } = await withTimeout(
      supabase.from('coach_directory').select('id,name,photo,track,focus,experience,bio,student_count,created_at'),
    );
    if (error) throw error;
    return { ok: true, coaches: (data || []).map((r) => directoryToHuman(r as Record<string, unknown>)) };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function submitCoachApplication(input: {
  userId: string;
  name: string;
  email: string;
  track: CoachTrack;
  focus: string;
  photo: string;
  studentCount: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; missing?: boolean }> {
  if (!supabase) return { ok: false, error: SUPABASE_UNAVAILABLE, missing: true };
  const photo = input.photo.length > 180000 ? '' : input.photo;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('coaches')
        .upsert(
          {
            user_id: input.userId,
            name: input.name,
            email: input.email,
            track: input.track,
            focus: input.focus,
            photo,
            student_count: input.studentCount,
            status: 'pending',
          },
          { onConflict: 'user_id' },
        )
        .select('id')
        .single(),
    );
    if (error) throw error;
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e), missing: isMissingRelation(e) };
  }
}

export async function fetchMyCoach(userId: string): Promise<CloudCoach | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from('coaches').select('*').eq('user_id', userId).maybeSingle(),
    );
    if (error) throw error;
    return data ? mapCoach(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function rowsFrom(table: string, coachId: string): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await withTimeout(supabase.from(table).select('*').eq('coach_id', coachId));
    if (error) return [];
    return (data || []) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function mapStudents(rows: Record<string, unknown>[]): CoachStudent[] {
  return rows.map((r) => {
    const userId = String(r.student_id || '');
    return {
      id: isUuid(userId) ? userId : String(r.id),
      name: getPersonDisplayName(String(r.student_name || r.name || ''), 'Öğrenci'),
      grade: String(r.grade || ''),
      note: String(r.note || ''),
    };
  });
}

export type LinkedStudentRow = CoachStudent & {
  dept: string;
  examDate: string;
  weekHours: number;
  openTasks: number;
};

export async function fetchLinkedStudents(): Promise<{ ok: true; rows: LinkedStudentRow[] } | { ok: false; error: string; missing?: boolean }> {
  if (!supabase) return { ok: false, error: SESSION_REQUIRED };
  try {
    const { data, error } = await withTimeout(supabase.rpc('coach_linked_students'));
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      id: String(r.student_id || ''),
      name: getPersonDisplayName(String(r.name || ''), 'Öğrenci'),
      grade: String(r.grade || ''),
      note: '',
      dept: String(r.dept || ''),
      examDate: String(r.exam_date || ''),
      weekHours: Number(r.week_hours) || 0,
      openTasks: Number(r.open_tasks) || 0,
    })).filter((s) => isUuid(s.id));
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e), missing: isMissingRelation(e) };
  }
}

export async function assignCoachHomework(studentId: string, title: string, due: string): Promise<{ ok: true; id: string } | { ok: false; error: string; missing?: boolean }> {
  if (!supabase || !isUuid(studentId)) return { ok: false, error: 'Öğrenci hesabı gerekli.' };
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('assign_coach_homework', { p_student_id: studentId, p_title: title, p_due: due || null }),
    );
    if (error) throw error;
    return { ok: true, id: String(data) };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e), missing: isMissingRelation(e) };
  }
}

export async function setCoachHomeworkDone(id: string, done: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase || !isUuid(id)) return { ok: false, error: 'Ödev yok.' };
  try {
    const { error } = await withTimeout(supabase.rpc('set_coach_homework_done', { p_id: id, p_done: done }));
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function fetchMyCoachHomework(): Promise<{ ok: true; rows: CoachHomework[] } | { ok: false; error: string; missing?: boolean }> {
  if (!supabase) return { ok: false, error: SESSION_REQUIRED };
  try {
    const { data, error } = await withTimeout(
      supabase.from('coach_homeworks').select('id, student_id, title, due, done, created_at, updated_at').order('created_at', { ascending: false }).limit(80),
    );
    if (error) throw error;
    return {
      ok: true,
      rows: (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        studentId: String(r.student_id || ''),
        title: String(r.title || ''),
        due: String(r.due || ''),
        done: Boolean(r.done),
        createdAt: r.created_at ? String(r.created_at) : undefined,
        updatedAt: r.updated_at ? String(r.updated_at) : undefined,
      })),
    };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e), missing: isMissingRelation(e) };
  }
}

export async function pushStudentData(payload: AppData): Promise<
  { ok: true; rev: number } | { ok: false; rev: number; data: AppData | null; missing?: boolean; error?: string }
> {
  if (!supabase) return { ok: false, rev: payload.syncRev || 0, data: null, missing: true, error: SUPABASE_UNAVAILABLE };
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('push_student_data', { p_expected_rev: payload.syncRev || 0, p_data: payload }),
    );
    if (error) throw error;
    const parsed = parsePushResult(data);
    if (parsed.ok) return { ok: true, rev: parsed.rev };
    return { ok: false, rev: parsed.rev, data: parsed.data };
  } catch (e) {
    return { ok: false, rev: payload.syncRev || 0, data: null, missing: isMissingRelation(e), error: rpcUserMessage(e) };
  }
}

export async function fetchCoachStudentBrief(studentId: string, today: string): Promise<
  { ok: true; brief: CoachStudyBrief } | { ok: false; error: string; missing?: boolean }
> {
  if (!supabase || !isUuid(studentId)) return { ok: false, error: 'Öğrenci hesabı gerekli.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('coach_student_brief', { p_student: studentId }));
    if (error) throw error;
    const payload = data && typeof data === 'object' && 'payload' in (data as object)
      ? (data as { payload: unknown }).payload
      : data;
    if (!payload || typeof payload !== 'object') {
      return { ok: true, brief: coachStudyBrief(normalizeData({}), today) };
    }
    return { ok: true, brief: coachStudyBrief(normalizeData(payload), today) };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e), missing: isMissingRelation(e) };
  }
}

export async function fetchCoachDesk(coachId: string): Promise<CoachDesk | null> {
  if (!supabase || !isUuid(coachId)) return null;
  const [matches, legacyStudents, hw, pay, ap] = await Promise.all([
    rowsFrom('coach_matches', coachId),
    rowsFrom('coach_students', coachId),
    rowsFrom('coach_homeworks', coachId),
    rowsFrom('coach_payments', coachId),
    rowsFrom('appointments', coachId),
  ]);
  const studentRows = matches.length ? matches : legacyStudents;
  return {
    students: mapStudents(studentRows),
    homeworks: hw.map((r) => ({
      id: String(r.id),
      studentId: String(r.student_id || ''),
      title: String(r.title || ''),
      due: String(r.due || ''),
      done: Boolean(r.done),
      createdAt: r.created_at ? String(r.created_at) : undefined,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    })),
    payments: pay.map((r) => ({
      id: String(r.id),
      studentId: String(r.student_id || ''),
      amount: Number(r.amount) || 0,
      date: String(r.date || ''),
      note: String(r.note || ''),
    })),
    appointments: ap.map((r) => ({
      id: String(r.id),
      coachId: String(r.coach_id),
      studentId: String(r.student_id || ''),
      studentName: getPersonDisplayName(String(r.student_name || ''), 'Öğrenci'),
      date: String(r.date || ''),
      time: String(r.time || ''),
      minutes: Number(r.minutes) || 40,
      status: asAppt(r.status),
      cancelReason: asCancelReason(r.cancel_reason),
      cancelRequestedAt: r.cancel_requested_at ? String(r.cancel_requested_at) : null,
      cancelDecision: asCancelDecision(r.cancel_decision),
      startsAt: r.starts_at ? String(r.starts_at) : null,
    })),
  };
}

export async function pushCoachDesk(coachId: string, desk: CoachDesk): Promise<boolean> {
  if (!supabase || !isUuid(coachId)) return false;
  try {
    await withTimeout(supabase.from('coach_matches').delete().eq('coach_id', coachId));
    if (desk.students.length) {
      const { error } = await supabase.from('coach_matches').insert(
        desk.students.map((s) => ({
          id: s.id,
          coach_id: coachId,
          student_id: isUuid(s.id) ? s.id : null,
          student_name: s.name,
          grade: s.grade,
          note: s.note,
          status: 'active',
        })),
      );
      if (error && !isMissingRelation(error)) throw error;
    }
    return true;
  } catch {
    return false;
  }
}

function asSlotRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function requestAppointment(availabilityId: string): Promise<{ ok: true; id: string; message?: string } | { ok: false; error: string }> {
  if (!supabase || !availabilityId) return { ok: false, error: 'Slot yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('request_appointment', { p_availability_id: availabilityId }));
    if (error) throw error;
    const row = data as { id?: string } | null;
    if (!row?.id) return { ok: false, error: 'Talep oluşmadı. Müsaitlik şeması yok olabilir.' };
    return { ok: true, id: String(row.id) };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function requestCancelApprovedAppointment(apptId: string): Promise<{ ok: true; duplicate: boolean; message: string } | { ok: false; error: string }> {
  if (!supabase || !apptId) return { ok: false, error: 'Randevu yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('request_cancel_approved_appointment', { p_id: apptId }));
    if (error) throw error;
    const row = data as { duplicate?: boolean; status?: string } | null;
    const duplicate = Boolean(row?.duplicate);
    return {
      ok: true,
      duplicate,
      message: duplicate ? 'İptal talebi zaten açık.' : 'İptal talebi gönderildi. Koç veya yönetici onaylamadan randevu düşmez.',
    };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function decideApprovedAppointmentCancel(apptId: string, accept: boolean): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!supabase || !apptId) return { ok: false, error: 'Randevu yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('decide_approved_appointment_cancel', { p_id: apptId, p_accept: accept }));
    if (error) throw error;
    const row = data as { status?: string; decision?: string } | null;
    return {
      ok: true,
      message: row?.status === 'iptal' ? 'Onaylı randevu iptal edildi. Kayıt silinmedi.' : 'İptal talebi reddedildi. Randevu onaylı kaldı.',
    };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function respondAppointment(apptId: string, accept: boolean): Promise<{ ok: true; cancelled: number; message: string } | { ok: false; error: string }> {
  if (!supabase || !apptId) return { ok: false, error: 'Randevu yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('respond_appointment', { p_id: apptId, p_accept: accept }));
    if (error) throw error;
    const row = data as { cancelled?: number; message?: string; status?: string } | null;
    return {
      ok: true,
      cancelled: Number(row?.cancelled) || 0,
      message: String(row?.message || (accept ? 'Randevu onaylandı.' : 'Randevu iptal.')),
    };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function listOpenSlots(coachId: string): Promise<{ ok: true; rows: { id: string; startsAt: string; date: string; time: string }[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Bulut ayarı yok.' };
  if (!coachId) return { ok: false, error: 'Koç yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('list_open_slots', { p_coach_id: coachId }));
    if (error) throw error;
    const rows = asSlotRows(data).map((r) => ({
      id: String(r.id || ''),
      startsAt: String(r.starts_at || ''),
      date: String(r.date || ''),
      time: String(r.time || ''),
    })).filter((s) => s.id);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function listMySlots(): Promise<{ ok: true; rows: { id: string; startsAt: string; date: string; time: string; status: string }[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Bulut ayarı yok.' };
  const auth = await requireUserSession();
  if (!auth.ok) return auth;
  try {
    const { data, error } = await withTimeout(supabase.rpc('list_my_slots'));
    if (error) throw error;
    const rows = asSlotRows(data).map((r) => ({
      id: String(r.id || ''),
      startsAt: String(r.starts_at || ''),
      date: String(r.date || ''),
      time: String(r.time || ''),
      status: String(r.status || ''),
    })).filter((s) => s.id);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function addCoachSlot(startsAtIso: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase || !startsAtIso) return { ok: false, error: 'Saat yok.' };
  const auth = await requireUserSession();
  if (!auth.ok) return auth;
  try {
    const { error } = await withTimeout(supabase.rpc('add_coach_slot', { p_starts_at: startsAtIso }));
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function closeCoachSlot(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase || !id) return { ok: false, error: 'Slot yok.' };
  const auth = await requireUserSession();
  if (!auth.ok) return auth;
  try {
    const { error } = await withTimeout(supabase.rpc('close_coach_slot', { p_id: id }));
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function runAppointmentJobs(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: true };
  try {
    const expire = await withTimeout(supabase.rpc('expire_my_pending_appointments'));
    if (expire.error) throw expire.error;
    const apply = await withTimeout(supabase.rpc('apply_my_lesson_outcomes'));
    if (apply.error) throw apply.error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function updateAppointmentStatus(apptId: string, status: AppointmentStatus): Promise<boolean> {
  if (!supabase || !apptId) return false;
  try {
    const { error } = await withTimeout(supabase.from('appointments').update({ status }).eq('id', apptId));
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function adminSetCoachStatus(id: string, status: CoachStatus): Promise<boolean> {
  if (!supabase || !isUuid(id)) return false;
  try {
    const { error } = await withTimeout(supabase.rpc('admin_set_coach_status', { p_id: id, p_status: status }));
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function adminPatchCoach(id: string, patch: { name?: string; track?: CoachTrack; focus?: string }): Promise<boolean> {
  if (!supabase || !isUuid(id)) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('coaches').update({
        name: patch.name,
        track: patch.track,
        focus: patch.focus,
      }).eq('id', id),
    );
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function adminSetAccountStatus(
  id: string,
  status: AccountStatus,
): Promise<{ ok: boolean; error: string }> {
  if (!supabase || !isUuid(id)) return { ok: false, error: 'Geçersiz hesap.' };
  if (status !== 'active' && status !== 'pasif') return { ok: false, error: 'Geçersiz durum.' };
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke('admin-account-status', {
      body: { user_id: id, status },
    }));
    const body = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    if (error) {
      const msg = String(error.message || '');
      if (/not found|404|failed to send/i.test(msg)) {
        return { ok: false, error: 'Askıya alma servisi henüz yayınlanmadı. 029 ve admin-account-status uygulanmalı.' };
      }
      return { ok: false, error: publicCloudError(error) };
    }
    if (body.ok === true) return { ok: true, error: '' };
    return { ok: false, error: String(body.error || 'Hesap güncellenemedi.') };
  } catch (e) {
    return { ok: false, error: publicCloudError(e) };
  }
}

export type BillingRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  subscription_status: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_ends_at: string;
  account_status: AccountStatus;
};

export type BillingOverview = {
  active: number;
  trialing: number;
  failed_payments: number;
  canceled: number;
  verified_total_try: number;
};

export async function adminBillingOverview(): Promise<BillingOverview | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('admin_billing_overview'));
    if (error) throw error;
    const rec = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    return {
      active: Number(rec.active) || 0,
      trialing: Number(rec.trialing) || 0,
      failed_payments: Number(rec.failed_payments) || 0,
      canceled: Number(rec.canceled) || 0,
      verified_total_try: Number(rec.verified_total_try) || 0,
    };
  } catch {
    return null;
  }
}

export type AdminPaymentRow = {
  id: string;
  email: string;
  amountTry: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string;
  createdAt: string;
};

export async function adminListPayments(): Promise<AdminPaymentRow[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('admin_list_payments'));
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      email: String(r.email || ''),
      amountTry: Number(r.amount_try) || 0,
      currency: String(r.currency || 'TRY'),
      status: String(r.status || ''),
      provider: String(r.provider || ''),
      providerPaymentId: String(r.provider_payment_id || ''),
      createdAt: String(r.created_at || ''),
    }));
  } catch {
    return null;
  }
}

export async function adminListBilling(): Promise<BillingRow[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('admin_list_billing'));
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: getPersonDisplayName(String(r.name || ''), 'Öğrenci'),
      email: String(r.email || ''),
      plan: String(r.plan || ''),
      subscription_status: String(r.subscription_status || ''),
      trial_started_at: String(r.trial_started_at || ''),
      trial_ends_at: String(r.trial_ends_at || ''),
      subscription_ends_at: String(r.subscription_ends_at || ''),
      account_status: parseAccountStatus(r.account_status),
    }));
  } catch {
    return null;
  }
}

export async function adminListStudentApplications(): Promise<StudentApplication[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('admin_list_student_applications'));
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: getPersonDisplayName(String(r.name || ''), 'Öğrenci'),
      email: String(r.email || ''),
      registered_at: String(r.registered_at || ''),
      account_status: parseAccountStatus(r.account_status),
      email_confirmed: Boolean(r.email_confirmed),
      signup_grade: String(r.signup_grade || ''),
      signup_track: String(r.signup_track || ''),
      signup_exam: String(r.signup_exam || ''),
      approval_note: String(r.approval_note || ''),
    }));
  } catch {
    return null;
  }
}

export async function adminReviewStudent(
  id: string,
  status: 'active' | 'rejected' | 'pending',
  note = '',
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase || !isUuid(id)) return { ok: false, error: 'Kayıt bulunamadı.' };
  try {
    const { error } = await withTimeout(
      supabase.rpc('admin_review_student', { p_id: id, p_status: status, p_note: note }),
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: rpcUserMessage(e) };
  }
}

export async function insertAdminNote(coachId: string, text: string, authorId?: string): Promise<boolean> {
  if (!supabase || !isUuid(coachId)) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('admin_notes').insert({ coach_id: coachId, text, author_id: authorId || null }),
    );
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function insertFinanceRow(entry: LedgerEntry): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('platform_finance').insert({
        date: entry.date,
        coach_id: isUuid(entry.coachId) ? entry.coachId : null,
        coach_name: entry.coachName,
        amount: entry.amount,
        commission: entry.commission,
        kind: entry.kind,
        status: entry.status,
        note: entry.note,
      }),
    );
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function markFinancePaid(id: string): Promise<boolean> {
  if (!supabase || !id) return false;
  try {
    const { error } = await withTimeout(supabase.from('platform_finance').update({ status: 'odendi' }).eq('id', id));
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

async function tableRows(table: string) {
  if (!supabase) return [] as Record<string, unknown>[];
  try {
    const { data, error } = await withTimeout(supabase.from(table).select('*'));
    if (error) return [];
    return (data || []) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

export async function fetchAdminBundle(): Promise<CloudAdminBundle | null> {
  if (!supabase) return null;
  try {
    const [profileRes, coachRes] = await Promise.all([
      withTimeout(supabase.from('profiles').select('id,name,email,plan,role,account_status,target_department,target_rank')),
      withTimeout(supabase.from('coaches').select('*')),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (coachRes.error) throw coachRes.error;
    const [matchRows, apptRows, financeRowsRaw, noteRowsRaw] = await Promise.all([
      tableRows('coach_matches'),
      tableRows('appointments'),
      tableRows('platform_finance'),
      tableRows('admin_notes'),
    ]);
    const coachRows = (coachRes.data || []).map((r) => mapCoach(r as Record<string, unknown>));
    const nameOf = (id: string) => getCoachDisplayName(coachRows.find((c) => c.id === id)?.name || '');
    const desks: Record<string, CoachDesk> = {};
    for (const c of coachRows) desks[c.id] = emptyDesk();
    for (const r of matchRows) {
      const cid = String(r.coach_id);
      if (!desks[cid]) desks[cid] = emptyDesk();
      desks[cid].students.push({
        id: String(r.id),
        name: getPersonDisplayName(String(r.student_name || r.name || ''), 'Öğrenci'),
        grade: String(r.grade || ''),
        note: String(r.note || ''),
      });
    }
    const cloudAppts: CloudAppointment[] = apptRows.map((r) => ({
      id: String(r.id),
      coachId: String(r.coach_id),
      studentId: String(r.student_id || ''),
      studentName: getPersonDisplayName(String(r.student_name || ''), 'Öğrenci'),
      date: String(r.date || ''),
      time: String(r.time || ''),
      minutes: Number(r.minutes) || 40,
      status: asAppt(r.status),
      coachName: nameOf(String(r.coach_id)),
      cancelReason: asCancelReason(r.cancel_reason),
      cancelRequestedAt: r.cancel_requested_at ? String(r.cancel_requested_at) : null,
      cancelDecision: asCancelDecision(r.cancel_decision),
      startsAt: r.starts_at ? String(r.starts_at) : null,
    }));
    for (const a of cloudAppts) {
      if (!desks[a.coachId]) desks[a.coachId] = emptyDesk();
      desks[a.coachId].appointments.push(a);
    }
    const links: CloudLink[] = [];
    for (const c of coachRows) {
      for (const s of desks[c.id]?.students || []) {
        links.push({ coachId: c.id, coachName: c.name, studentName: s.name, grade: s.grade });
      }
    }
    const financeRows: LedgerEntry[] = financeRowsRaw.map((r) => ({
      id: String(r.id),
      date: String(r.date || ''),
      coachId: String(r.coach_id || ''),
      coachName: getCoachDisplayName(String(r.coach_name || '')),
      amount: Number(r.amount) || 0,
      commission: Number(r.commission) || 0,
      kind: r.kind === 'iade' ? 'iade' : 'odeme',
      status: r.status === 'odendi' || r.status === 'iade' ? r.status : 'bekliyor',
      note: String(r.note || ''),
    }));
    const noteRows = noteRowsRaw.map((r) => ({
      id: String(r.id),
      coachId: String(r.coach_id || ''),
      text: String(r.text || ''),
      at: String(r.created_at || ''),
    }));
    const profileRows: CloudProfile[] = (profileRes.data || []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        name: getPersonDisplayName(String(r.name || ''), ''),
        email: String(r.email || ''),
        plan: String(r.plan || 'Ücretsiz'),
        role: r.role === 'admin' || r.role === 'coach' ? r.role : 'student',
        account_status: parseAccountStatus(r.account_status),
        signup_intent: r.signup_intent === 'coach' ? 'coach' : 'student',
        signup_grade: String(r.signup_grade || ''),
        signup_track: String(r.signup_track || ''),
        signup_exam: String(r.signup_exam || ''),
        approval_note: String(r.approval_note || ''),
        target_department: r.target_department ? String(r.target_department) : undefined,
        target_rank: r.target_rank == null ? undefined : Number(r.target_rank),
      };
    });
    return {
      source: 'supabase',
      profiles: profileRows,
      coaches: coachRows,
      desks,
      appts: cloudAppts.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
      links,
      finance: financeRows,
      notes: noteRows,
    };
  } catch (e) {
    if (isMissingRelation(e)) return null;
    return null;
  }
}

export type TrialStartResult = {
  ok: boolean;
  status: string;
  message: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
};

export async function startTopPlanTrial(): Promise<TrialStartResult> {
  const session = await requireUserSession();
  if (!session.ok) return { ok: false, status: 'auth', message: session.error, trialStartedAt: null, trialEndsAt: null };
  if (!supabase) return { ok: false, status: 'config', message: SUPABASE_UNAVAILABLE, trialStartedAt: null, trialEndsAt: null };
  try {
    const { data, error } = await withTimeout(supabase.rpc('start_top_plan_trial'));
    return interpretStartTopPlanTrialRpc(error, data);
  } catch (e) {
    return { ok: false, status: 'error', message: publicCloudError(e), trialStartedAt: null, trialEndsAt: null };
  }
}

export async function fetchStudentWeekPlan(studentId: string) {
  if (!supabase || !isUuid(studentId)) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from('student_week_plans').select('*').eq('student_id', studentId).maybeSingle(),
    );
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function saveStudentWeekPlan(input: {
  studentId: string;
  days: unknown;
  weekHours: number;
  notes: string;
  lock: 'self' | 'coach';
}): Promise<{ ok: boolean; error: string }> {
  const session = await requireUserSession();
  if (!session.ok) return { ok: false, error: session.error };
  if (!supabase) return { ok: false, error: SUPABASE_UNAVAILABLE };
  try {
    const { error } = await withTimeout(supabase.rpc('upsert_student_week_plan', {
      p_student: input.studentId,
      p_days: input.days,
      p_week_hours: input.weekHours,
      p_notes: input.notes,
      p_lock: input.lock,
    }));
    if (error) {
      const msg = String(error.message || '');
      if (/could not find|does not exist/i.test(msg)) {
        return { ok: false, error: 'Haftalık program buluta yazılamadı. Yerel kayıt duruyor.' };
      }
      return { ok: false, error: rpcUserMessage(error) };
    }
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: publicCloudError(e) };
  }
}

export async function saveExamReport(row: {
  examId: string;
  examName: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  topics: unknown;
  verifiedKey: boolean;
}): Promise<{ ok: boolean; error: string }> {
  const session = await requireUserSession();
  if (!session.ok) return { ok: false, error: session.error };
  if (!supabase) return { ok: false, error: SUPABASE_UNAVAILABLE };
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: SESSION_REQUIRED };
  try {
    const { error } = await withTimeout(supabase.from('exam_reports').insert({
      user_id: uid,
      exam_id: row.examId,
      exam_name: row.examName,
      correct: row.correct,
      wrong: row.wrong,
      blank: row.blank,
      net: row.net,
      topics: row.topics,
    }));
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return { ok: false, error: 'Analiz kaydı sunucuya yazılamadı. Sonuç ekranda kaldı.' };
      }
      return { ok: false, error: publicCloudError(error) };
    }
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: publicCloudError(e) };
  }
}

export async function listMyExamReports() {
  if (!supabase) return [];
  try {
    const { data, error } = await withTimeout(
      supabase.from('exam_reports').select('id,exam_id,exam_name,correct,wrong,blank,net,verified_key,created_at').order('created_at', { ascending: false }).limit(20),
    );
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function uploadExamScan(file: File): Promise<{ path: string } | { error: string }> {
  const session = await requireUserSession();
  if (!session.ok) return { error: session.error };
  if (!supabase) return { error: SUPABASE_UNAVAILABLE };
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { error: SESSION_REQUIRED };
  const buf = new Uint8Array(await file.arrayBuffer());
  const { examScanFileError, examScanPathOwned } = await import('./examScanQuota');
  const kindErr = examScanFileError(file.type, buf);
  if (kindErr) return { error: kindErr };
  const binary = Array.from(buf, (b) => String.fromCharCode(b)).join('');
  const { data, error } = await supabase.functions.invoke('exam-upload', {
    body: { contentType: file.type || 'application/octet-stream', base64: btoa(binary) },
  });
  const body = (data && typeof data === 'object') ? data as { ok?: boolean; path?: string; error?: string } : {};
  if (error) {
    const msg = String(error.message || '');
    if (/not found|404|failed to send/i.test(msg)) {
      return { error: 'Sınav yükleme servisi yayınlanmadı. Dosya kovaya yazılmadı.' };
    }
    return { error: publicCloudError(error) };
  }
  if (body.ok !== true || !body.path) {
    return { error: String(body.error || 'Yükleme reddedildi.') };
  }
  if (!examScanPathOwned(uid, body.path)) return { error: 'Dosya yolu geçersiz' };
  return { path: body.path };
}

export async function requestExamScan(path: string): Promise<{ ok: boolean; error: string; marks?: unknown; warning?: string }> {
  if (!supabase) return { ok: false, error: SUPABASE_UNAVAILABLE };
  const { data, error } = await supabase.functions.invoke('exam-scan', { body: { path } });
  const body = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  if (error) {
    const msg = String(error.message || '');
    if (/not found|404|failed to send/i.test(msg)) {
      return { ok: false, error: 'Görsel analiz servisi yayınlanmadı. İşaretler uydurulmadı.' };
    }
    return { ok: false, error: publicCloudError(error) };
  }
  if (body.ok !== true) return { ok: false, error: String(body.error || 'Görsel okunamadı.') };
  return { ok: true, error: '', marks: body.marks, warning: body.warning ? String(body.warning) : undefined };
}
