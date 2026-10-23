import { imageUploadError } from './imageUpload';

export type CoachTrack = 'YKS Sayısal' | 'YKS Eşit Ağırlık' | 'YKS Sözel' | 'KPSS' | 'Okul';

export type AppointmentStatus = 'bekliyor' | 'onay' | 'iptal' | 'tamamlandi';
export type CoachStatus = 'pending' | 'active' | 'rejected' | 'pasif';

export type HumanCoach = {
  id: string;
  name: string;
  track: CoachTrack;
  focus: string;
  weeklyHours: number;
  approach: string;
  photo: string;
  studentCount: number;
};

export type CoachAccount = {
  id: string;
  name: string;
  email: string;
  passHash: string;
  track: CoachTrack;
  focus: string;
  photo: string;
  studentCount: number;
  status: CoachStatus;
  score?: number;
};

export type CoachSession = {
  coachId: string;
  name: string;
  email: string;
  track: CoachTrack;
};

export type CoachStudent = {
  id: string;
  name: string;
  grade: string;
  note: string;
};

export type CoachHomework = {
  id: string;
  studentId: string;
  title: string;
  due: string;
  done: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CoachPayment = {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  note: string;
};

export type AppointmentCancelReason =
  | 'student_no_show'
  | 'sibling_accepted'
  | 'coach_rejected'
  | 'expired'
  | 'approved_cancel_request'
  | 'approved_cancel_accepted';

export type AppointmentCancelDecision = 'pending' | 'accepted' | 'denied';

export type CoachAppointment = {
  id: string;
  coachId: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  minutes: number;
  status: AppointmentStatus;
  cancelReason?: AppointmentCancelReason | null;
  cancelRequestedAt?: string | null;
  cancelRequestedBy?: string | null;
  cancelDecision?: AppointmentCancelDecision | null;
  startsAt?: string | null;
};

export function asCancelReason(v: unknown): AppointmentCancelReason | null {
  return v === 'student_no_show'
    || v === 'sibling_accepted'
    || v === 'coach_rejected'
    || v === 'expired'
    || v === 'approved_cancel_request'
    || v === 'approved_cancel_accepted'
    ? v
    : null;
}

export function asCancelDecision(v: unknown): AppointmentCancelDecision | null {
  return v === 'pending' || v === 'accepted' || v === 'denied' ? v : null;
}

export function appointmentStatusLabel(a: Pick<CoachAppointment, 'status' | 'cancelReason' | 'cancelDecision'>, party: 'student' | 'coach' = 'student') {
  if (a.status === 'bekliyor') return party === 'coach' ? 'Onay bekliyor' : 'Bekliyor — koç onayı yok, kesin değil';
  if (a.status === 'onay' && a.cancelReason === 'approved_cancel_request' && a.cancelDecision !== 'denied') {
    return 'Onaylı — iptal talebi açık (talebi açmayan taraf veya yönetici karar verir)';
  }
  if (a.status === 'onay') return 'Onaylı — randevu kesin';
  if (a.status === 'tamamlandi') return 'Tamamlandı';
  if (a.cancelReason === 'student_no_show') {
    return party === 'student'
      ? 'İptal (no-show): 10 dk içinde katılmadın.'
      : 'İptal: öğrenci 10 dk içinde katılmadı (no-show).';
  }
  if (a.cancelReason === 'sibling_accepted') {
    return party === 'student'
      ? 'İptal: aynı saatte başka koç kabul etti'
      : 'İptal: öğrenci başka koçta kesinleşti';
  }
  if (a.cancelReason === 'coach_rejected') return party === 'coach' ? 'Reddettin' : 'İptal: koç reddetti';
  if (a.cancelReason === 'expired') return 'İptal: onay süresi doldu';
  if (a.cancelReason === 'approved_cancel_accepted') return 'İptal: onaylı randevu taleple kapatıldı';
  return 'İptal';
}

export type CoachDesk = {
  students: CoachStudent[];
  homeworks: CoachHomework[];
  payments: CoachPayment[];
  appointments: CoachAppointment[];
};

export const COACH_TRACKS: CoachTrack[] = [
  'YKS Sayısal',
  'YKS Eşit Ağırlık',
  'YKS Sözel',
  'KPSS',
  'Okul',
];

const ACC_KEY = 'yks_coach_accounts_v1';
const SES_KEY = 'yks_coach_session_v1';
const DESK_KEY = 'yks_coach_desk_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

function asCoachStatus(s: unknown): CoachStatus {
  return s === 'pending' || s === 'rejected' || s === 'pasif' || s === 'active' ? s : 'pending';
}

export function loadCoachAccounts(): CoachAccount[] {
  const raw = readJson<unknown>(ACC_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is CoachAccount => Boolean(x && typeof x === 'object' && (x as CoachAccount).email && (x as CoachAccount).passHash)).map((a) => ({
    ...a,
    photo: typeof a.photo === 'string' ? a.photo : '',
    studentCount: Number.isFinite(Number(a.studentCount)) ? Math.max(0, Math.round(Number(a.studentCount))) : 0,
    status: asCoachStatus((a as CoachAccount).status),
  }));
}

export async function compressCoachPhoto(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const err = imageUploadError(file.type, buf);
  if (err) throw new Error(err);
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 240;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Fotoğraf işlenemedi.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Fotoğraf okunamadı.'));
    };
    img.src = url;
  });
}

export function loadCoachSession(): CoachSession | null {
  const s = readJson<CoachSession | null>(SES_KEY, null);
  if (!s?.coachId || !s.email) return null;
  return s;
}

export function saveCoachSession(session: CoachSession) {
  writeJson(SES_KEY, session);
}

/** Çıkışta koç oturumu ve koç masası (öğrenci adları, ödevler) cihazda kalmaz. */
export function clearCoachSession() {
  try {
    localStorage.removeItem(SES_KEY);
    localStorage.removeItem(DESK_KEY);
  } catch { /* ignore */ }
}

function desks(): Record<string, CoachDesk> {
  const raw = readJson<Record<string, CoachDesk>>(DESK_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function emptyDesk(): CoachDesk {
  return { students: [], homeworks: [], payments: [], appointments: [] };
}

export function loadCoachDesk(coachId: string): CoachDesk {
  const d = desks()[coachId];
  if (!d) return emptyDesk();
  return {
    students: Array.isArray(d.students) ? d.students : [],
    homeworks: Array.isArray(d.homeworks) ? d.homeworks : [],
    payments: Array.isArray(d.payments) ? d.payments : [],
    appointments: Array.isArray(d.appointments) ? d.appointments : [],
  };
}

export function saveCoachDesk(coachId: string, desk: CoachDesk) {
  writeJson(DESK_KEY, { ...desks(), [coachId]: desk });
}

export function loadAllDesks(): Record<string, CoachDesk> {
  return desks();
}

export function patchCoachAccount(id: string, patch: Partial<Pick<CoachAccount, 'name' | 'track' | 'focus' | 'studentCount' | 'status'>>): boolean {
  const list = loadCoachAccounts();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return false;
  const next = { ...list[i], ...patch };
  if (patch.studentCount != null) next.studentCount = Math.max(0, Math.min(500, Math.round(Number(patch.studentCount) || 0)));
  list[i] = next;
  writeJson(ACC_KEY, list);
  return true;
}

export function formatTry(n: number) {
  return `${n.toLocaleString('tr-TR')} ₺`;
}

export function monthPayments(desk: CoachDesk, now = new Date()) {
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return desk.payments.filter((p) => p.date.startsWith(prefix)).reduce((a, p) => a + Number(p.amount || 0), 0);
}
