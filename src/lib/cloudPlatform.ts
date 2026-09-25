import type { AppointmentStatus, CoachAccount, CoachAppointment, CoachDesk, CoachStatus, CoachStudent, CoachTrack, HumanCoach } from './coaches';
import { asCancelReason, COACH_TRACKS, emptyDesk } from './coaches';
import { SUPABASE_UNAVAILABLE, publicCloudError, supabase, withTimeout } from './supabase';

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
export type AccountStatus = 'active' | 'pasif';

export type CloudProfile = {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: ProfileRole;
  account_status: AccountStatus;
  target_department?: string;
  target_rank?: number;
};

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
  return /schema cache|does not exist|Could not find the table/i.test(msg);
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
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message || '') : e instanceof Error ? e.message : '';
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
  ];
  const hit = known.find((k) => msg.toLowerCase().includes(k));
  if (hit) return hit.charAt(0).toUpperCase() + hit.slice(1) + '.';
  return publicCloudError(e);
}

function mapCoach(row: Record<string, unknown>): CloudCoach {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    name: String(row.name || ''),
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
    name: String(row.name || ''),
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
    return { ok: false, error: e instanceof Error ? e.message : 'Başvuru yazılamadı.', missing: isMissingRelation(e) };
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
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.student_name || r.name || ''),
    grade: String(r.grade || ''),
    note: String(r.note || ''),
  }));
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
      studentName: String(r.student_name || ''),
      date: String(r.date || ''),
      time: String(r.time || ''),
      minutes: Number(r.minutes) || 40,
      status: asAppt(r.status),
      cancelReason: asCancelReason(r.cancel_reason),
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

export async function adminSetAccountStatus(id: string, status: AccountStatus): Promise<boolean> {
  if (!supabase || !isUuid(id)) return false;
  try {
    const { error } = await withTimeout(supabase.from('profiles').update({ account_status: status }).eq('id', id));
    if (error) throw error;
    return true;
  } catch {
    return false;
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
    const nameOf = (id: string) => coachRows.find((c) => c.id === id)?.name || id;
    const desks: Record<string, CoachDesk> = {};
    for (const c of coachRows) desks[c.id] = emptyDesk();
    for (const r of matchRows) {
      const cid = String(r.coach_id);
      if (!desks[cid]) desks[cid] = emptyDesk();
      desks[cid].students.push({
        id: String(r.id),
        name: String(r.student_name || r.name || ''),
        grade: String(r.grade || ''),
        note: String(r.note || ''),
      });
    }
    const cloudAppts: CloudAppointment[] = apptRows.map((r) => ({
      id: String(r.id),
      coachId: String(r.coach_id),
      studentId: String(r.student_id || ''),
      studentName: String(r.student_name || ''),
      date: String(r.date || ''),
      time: String(r.time || ''),
      minutes: Number(r.minutes) || 40,
      status: asAppt(r.status),
      coachName: nameOf(String(r.coach_id)),
      cancelReason: asCancelReason(r.cancel_reason),
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
      coachName: String(r.coach_name || ''),
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
    const profileRows: CloudProfile[] = (profileRes.data || []).map((r) => ({
      id: String(r.id),
      name: String(r.name || ''),
      email: String(r.email || ''),
      plan: String(r.plan || 'Ücretsiz'),
      role: r.role === 'admin' || r.role === 'coach' ? r.role : 'student',
      account_status: r.account_status === 'pasif' ? 'pasif' : 'active',
      target_department: r.target_department || undefined,
      target_rank: r.target_rank == null ? undefined : Number(r.target_rank),
    }));
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
