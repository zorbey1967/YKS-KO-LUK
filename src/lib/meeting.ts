import { fetchMyCoach } from './cloudPlatform';
import type { AppointmentStatus, CoachAppointment } from './coaches';
import { publicCloudError, supabase, supabaseAnonKey, supabaseUrl, withTimeout } from './supabase';

export const JOIN_BEFORE_MIN = 10;
export const JOIN_AFTER_MIN = 15;

function istanbulParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    hour: Number(g('hour')) % 24,
    minute: Number(g('minute')),
  };
}

function addIsoDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Türkiye saati; varsayılan slot pencerede açılsın diye şimdi + 10 dk, 5 dk’ya yuvarlanır. */
export function nextBookSlot(from = new Date()) {
  const now = istanbulParts(from);
  let minutes = now.hour * 60 + now.minute + JOIN_BEFORE_MIN;
  minutes = Math.ceil(minutes / 5) * 5;
  let date = now.date;
  if (minutes >= 24 * 60) {
    minutes -= 24 * 60;
    date = addIsoDays(date, 1);
  }
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return { date, time: `${hh}:${mm}` };
}

export function istanbulToday() {
  return istanbulParts().date;
}

export type MeetingRoomStatus = 'idle' | 'waiting' | 'live' | 'ended' | 'blocked';

export type MyAppointment = CoachAppointment & {
  coachName: string;
  startsAt: string | null;
};

export type JoinBlockReason =
  | 'no-auth'
  | 'no-cloud'
  | 'missing-schema'
  | 'not-found'
  | 'forbidden'
  | 'pending'
  | 'cancelled'
  | 'done'
  | 'early'
  | 'late'
  | 'ok';

export type MeetingRoomRow = {
  id: string;
  appointmentId: string;
  status: MeetingRoomStatus;
  recordingEnabled: false;
};

/** A2: tarayıcıda secret yok; jeton yalnızca Edge Function’da üretilir. */
export type LivekitPlaceholder = {
  connected: false;
  token: null;
  url: null;
  reason: string;
};

export function livekitPlaceholder(): LivekitPlaceholder {
  return {
    connected: false,
    token: null,
    url: null,
    reason: 'Bağlan, sunucudan kısa ömürlü oda jetonu ister. Kayıt yok. Anahtar tarayıcıda değil.',
  };
}

export function appointmentIdFromHash(hash = location.hash) {
  const q = hash.split('?')[1] || '';
  return new URLSearchParams(q).get('id') || '';
}

export function meetingHref(appointmentId: string) {
  return `#/meeting?id=${encodeURIComponent(appointmentId)}`;
}

export function openMeeting(appointmentId: string) {
  location.hash = `/meeting?id=${encodeURIComponent(appointmentId)}`;
}

function asStatus(s: unknown): AppointmentStatus {
  return s === 'bekliyor' || s === 'onay' || s === 'iptal' || s === 'tamamlandi' ? s : 'bekliyor';
}

export function isAppointmentParty(
  appt: Pick<CoachAppointment, 'studentId' | 'coachId'>,
  userId: string | null | undefined,
  coachId: string | null | undefined,
) {
  if (!userId) return false;
  return appt.studentId === userId || Boolean(coachId && appt.coachId === coachId);
}

function mapAppointment(r: Record<string, unknown>, coachName: string): MyAppointment {
  return {
    id: String(r.id),
    coachId: String(r.coach_id),
    studentId: String(r.student_id || ''),
    studentName: String(r.student_name || ''),
    date: String(r.date || ''),
    time: String(r.time || ''),
    minutes: Number(r.minutes) || 40,
    status: asStatus(r.status),
    coachName,
    startsAt: null,
  };
}

export function appointmentStartMs(date: string, time: string, startsAt?: string | null) {
  if (startsAt) {
    const n = Date.parse(startsAt);
    if (!Number.isNaN(n)) return n;
  }
  const t = (time || '00:00').trim();
  const hm = /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : '00:00';
  return Date.parse(`${date}T${hm}:00+03:00`);
}

export function joinWindow(appt: Pick<CoachAppointment, 'date' | 'time' | 'minutes' | 'status'> & { startsAt?: string | null }, now = Date.now()) {
  const start = appointmentStartMs(appt.date, appt.time, appt.startsAt);
  if (Number.isNaN(start)) return { can: false, reason: 'pending' as JoinBlockReason, start: 0, end: 0 };
  const end = start + (appt.minutes + JOIN_AFTER_MIN) * 60_000;
  const open = start - JOIN_BEFORE_MIN * 60_000;
  if (appt.status === 'bekliyor') return { can: false, reason: 'pending' as JoinBlockReason, start: open, end };
  if (appt.status === 'iptal') return { can: false, reason: 'cancelled' as JoinBlockReason, start: open, end };
  if (appt.status === 'tamamlandi') return { can: false, reason: 'done' as JoinBlockReason, start: open, end };
  if (appt.status !== 'onay') return { can: false, reason: 'pending' as JoinBlockReason, start: open, end };
  if (now < open) return { can: false, reason: 'early' as JoinBlockReason, start: open, end };
  if (now > end) return { can: false, reason: 'late' as JoinBlockReason, start: open, end };
  return { can: true, reason: 'ok' as JoinBlockReason, start: open, end };
}

export function joinReasonLabel(reason: JoinBlockReason) {
  switch (reason) {
    case 'ok': return 'Pencere açık.';
    case 'no-auth': return 'Görüşme için Hesabım’dan giriş yap.';
    case 'no-cloud': return 'Bulut ayarı yok; görüşme kapalı.';
    case 'missing-schema': return 'Görüşme tablosu henüz uygulanmadı.';
    case 'not-found': return 'Randevu bulunamadı.';
    case 'forbidden': return 'Bu randevuya yetkin yok.';
    case 'pending': return 'Koç onayı bekleniyor.';
    case 'cancelled': return 'Randevu iptal.';
    case 'done': return 'Görüşme tamamlandı.';
    case 'early': return 'Görüşme saati henüz gelmedi.';
    case 'late': return 'Katılma penceresi kapandı.';
    default: return 'Görüşmeye girilemez.';
  }
}

export async function listMyAppointments(userId: string, coachId: string | null): Promise<{ ok: true; rows: MyAppointment[] } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'no-cloud' };
  if (!userId) return { ok: true, rows: [] };
  try {
    const { data, error } = await withTimeout(
      supabase.from('appointments').select('id, coach_id, student_id, student_name, date, time, minutes, status').order('date', { ascending: false }),
    );
    if (error) throw error;
    const rows = (data || []) as Record<string, unknown>[];
    let names = new Map<string, string>();
    try {
      const dir = await withTimeout(supabase.from('coach_directory').select('id, name'));
      if (!dir.error && dir.data) {
        names = new Map((dir.data as { id: string; name: string }[]).map((c) => [c.id, c.name]));
      }
    } catch { /* directory optional */ }
    return {
      ok: true,
      rows: rows
        .map((r) => mapAppointment(r, names.get(String(r.coach_id)) || 'Koç'))
        .filter((a) => isAppointmentParty(a, userId, coachId)),
    };
  } catch (e) {
    return { ok: false, error: publicCloudError(e) };
  }
}

export async function fetchAppointmentForMeeting(id: string, userId: string): Promise<{ ok: true; row: MyAppointment } | { ok: false; reason: JoinBlockReason }> {
  if (!supabase) return { ok: false, reason: 'no-cloud' };
  if (!id || !userId) return { ok: false, reason: 'not-found' };
  try {
    const { data, error } = await withTimeout(
      supabase.from('appointments').select('id, coach_id, student_id, student_name, date, time, minutes, status').eq('id', id).maybeSingle(),
    );
    if (error) throw error;
    if (!data) return { ok: false, reason: 'not-found' };
    const r = data as Record<string, unknown>;
    const mine = await fetchMyCoach(userId);
    const coachId = mine && mine.status === 'active' ? mine.id : null;
    const row = mapAppointment(r, 'Koç');
    if (!isAppointmentParty(row, userId, coachId)) return { ok: false, reason: 'not-found' };
    try {
      const dir = await withTimeout(supabase.from('coach_directory').select('name').eq('id', row.coachId).maybeSingle());
      if (!dir.error && dir.data && typeof (dir.data as { name?: string }).name === 'string') {
        row.coachName = (dir.data as { name: string }).name;
      }
    } catch { /* ignore */ }
    return { ok: true, row };
  } catch {
    return { ok: false, reason: 'not-found' };
  }
}

function isMissingRpc(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /could not find the function|schema cache|does not exist/i.test(msg);
}

export async function serverCanJoin(appointmentId: string): Promise<{ join: boolean; schema: boolean }> {
  if (!supabase) return { join: false, schema: false };
  try {
    const { data, error } = await withTimeout(supabase.rpc('can_join_meeting', { p_appointment_id: appointmentId }));
    if (error) throw error;
    return { join: Boolean(data), schema: true };
  } catch (e) {
    return { join: false, schema: !isMissingRpc(e) };
  }
}

export type MeetingToken = {
  token: string;
  url: string;
  room: string;
  expiresAt: string;
  recording: false;
};

export async function requestMeetingToken(appointmentId: string): Promise<{ ok: true; data: MeetingToken } | { ok: false; error: string; status?: number }> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) return { ok: false, error: 'Bulut ayarı yok.' };
  if (!appointmentId) return { ok: false, error: 'Randevu yok.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const access = sessionData.session?.access_token;
  if (!access) return { ok: false, error: 'Oturum gerekli.' };
  try {
    const res = await withTimeout(
      fetch(`${supabaseUrl}/functions/v1/meeting-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ appointmentId }),
      }),
    );
    const raw = await res.json().catch(() => ({})) as { token?: string; url?: string; room?: string; expiresAt?: string; error?: string };
    if (!res.ok) {
      return { ok: false, error: String(raw.error || 'Token alınamadı'), status: res.status };
    }
    const token = String(raw.token || '').trim();
    const url = String(raw.url || '').trim();
    const room = String(raw.room || '').trim();
    if (!token || !url || !room) return { ok: false, error: 'Token yanıtı eksik.' };
    if (!/^wss:\/\//i.test(url) && !/^https:\/\//i.test(url)) return { ok: false, error: 'Token yanıtı geçersiz.' };
    return {
      ok: true,
      data: {
        token,
        url,
        room,
        expiresAt: String(raw.expiresAt || ''),
        recording: false,
      },
    };
  } catch (e) {
    return { ok: false, error: publicCloudError(e) };
  }
}

export async function ensureMeetingRoom(appointmentId: string): Promise<MeetingRoomRow | { error: string; missing?: boolean }> {
  if (!supabase) return { error: 'Bulut yok.' };
  try {
    const { data, error } = await withTimeout(supabase.rpc('ensure_meeting_room', { p_appointment_id: appointmentId }));
    if (error) throw error;
    const row = data as { id?: string; appointment_id?: string; status?: string; recording_enabled?: boolean } | null;
    if (!row?.id) return { error: 'Oda oluşmadı.' };
    const status: MeetingRoomStatus = ['idle', 'waiting', 'live', 'ended', 'blocked'].includes(String(row.status))
      ? String(row.status) as MeetingRoomStatus
      : 'waiting';
    return {
      id: String(row.id),
      appointmentId: String(row.appointment_id || appointmentId),
      status,
      recordingEnabled: false,
    };
  } catch (e) {
    const missing = isMissingRpc(e);
    return { error: missing ? 'Görüşme şeması henüz uygulanmadı.' : publicCloudError(e), missing };
  }
}
