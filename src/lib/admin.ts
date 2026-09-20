import type { User } from '@supabase/supabase-js';
import {
  loadAllDesks,
  loadCoachAccounts,
  loadCoachDesk,
  saveCoachDesk,
  type AppointmentStatus,
  type CoachAppointment,
  type CoachDesk,
} from './coaches';
import { supabase, withTimeout } from './supabase';
import { uid } from './util';

const FIN_KEY = 'yks_admin_finance_v1';
const SET_KEY = 'yks_admin_settings_v1';

export type FinanceKind = 'odeme' | 'iade';
export type FinanceStatus = 'bekliyor' | 'odendi' | 'iade';

export type FinanceEntry = {
  id: string;
  date: string;
  coachId: string;
  coachName: string;
  amount: number;
  commission: number;
  kind: FinanceKind;
  status: FinanceStatus;
  note: string;
};

export type AdminSettings = {
  commissionPct: number;
};

export type AdminLink = {
  coachId: string;
  coachName: string;
  studentName: string;
  grade: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Yönetici e-postası yalnızca `.env` içindeki VITE_ADMIN_EMAIL. Kaynakta sabit yok. */
export function platformOwnerEmail() {
  return normalizeEmail(String(import.meta.env.VITE_ADMIN_EMAIL || ''));
}

/** Supabase oturum e-postası ortam değişkenindeki yönetici ile birebir eşleşmeli. İstemci `role` alanına güvenilmez. */
export function isPlatformOwner(user: User | { email?: string | null } | null | undefined) {
  const owner = platformOwnerEmail();
  const email = normalizeEmail(user?.email || '');
  return Boolean(owner && email && owner === email);
}

/** `true`/`false` = RLS cevabı. `null` = fonksiyon henüz yok veya ağ hatası. */
export async function fetchServerAdmin(): Promise<boolean | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('is_admin'));
    if (error) return null;
    return Boolean(data);
  } catch {
    return null;
  }
}

/** SQL uygulandıysa `is_admin()` tek kaynaktır. Uygulanmadıysa geçici e-posta kapısı. */
export function canAccessAdminPanel(
  user: User | { email?: string | null } | null | undefined,
  serverAdmin: boolean | null,
) {
  if (serverAdmin === true) return true;
  if (serverAdmin === false) return false;
  return isPlatformOwner(user);
}

export function maskEmail(email: string) {
  const e = email.trim();
  const at = e.indexOf('@');
  if (at < 2) return '***';
  return `${e.slice(0, 2)}***${e.slice(at)}`;
}

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

export function loadAdminSettings(): AdminSettings {
  const raw = readJson<Partial<AdminSettings>>(SET_KEY, {});
  const pct = Number(raw.commissionPct);
  return { commissionPct: Number.isFinite(pct) ? Math.max(0, Math.min(50, pct)) : 15 };
}

export function saveAdminSettings(s: AdminSettings) {
  writeJson(SET_KEY, s);
}

export function loadFinance(): FinanceEntry[] {
  const raw = readJson<unknown>(FIN_KEY, []);
  return Array.isArray(raw) ? raw.filter((x): x is FinanceEntry => Boolean(x && typeof x === 'object' && (x as FinanceEntry).id)) : [];
}

export function saveFinance(list: FinanceEntry[]) {
  writeJson(FIN_KEY, list);
}

export function addFinance(entry: Omit<FinanceEntry, 'id'>): FinanceEntry {
  const item: FinanceEntry = { ...entry, id: uid('fn_') };
  saveFinance([item, ...loadFinance()]);
  return item;
}

export function allAppointments(): (CoachAppointment & { coachName: string })[] {
  const accounts = loadCoachAccounts();
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name || id;
  const desks = loadAllDesks();
  const rows: (CoachAppointment & { coachName: string })[] = [];
  for (const [coachId, desk] of Object.entries(desks)) {
    for (const a of desk.appointments || []) {
      rows.push({ ...a, coachName: nameOf(coachId) });
    }
  }
  return rows.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
}

export function coachStudentLinks(): AdminLink[] {
  const accounts = loadCoachAccounts();
  const desks = loadAllDesks();
  const rows: AdminLink[] = [];
  for (const acc of accounts) {
    const desk = desks[acc.id] || { students: [] as CoachDesk['students'] };
    for (const s of desk.students || []) {
      rows.push({ coachId: acc.id, coachName: acc.name, studentName: s.name, grade: s.grade });
    }
  }
  return rows;
}

export function deskPaymentsTotal(desk: CoachDesk) {
  return desk.payments.reduce((a, p) => a + Number(p.amount || 0), 0);
}

export function adminSnapshot(current?: { name: string; email: string; plan: string; grade: string }) {
  const coaches = loadCoachAccounts();
  const desks = loadAllDesks();
  const appts = allAppointments();
  const finance = loadFinance();
  const settings = loadAdminSettings();
  const links = coachStudentLinks();
  const coachStudents = links.length;
  const paid = finance.filter((f) => f.status === 'odendi' && f.kind === 'odeme');
  const gross = paid.reduce((a, f) => a + f.amount, 0);
  const commission = paid.reduce((a, f) => a + f.commission, 0);
  const deskGross = Object.values(desks).reduce((a, d) => a + deskPaymentsTotal(d), 0);
  return {
    coaches,
    desks,
    appts,
    finance,
    settings,
    links,
    demoCoaches: 0,
    studentCount: coachStudents + (current?.email ? 1 : 0),
    coachCount: coaches.length,
    activeCoaches: coaches.filter((a) => a.status === 'active').length,
    pendingCoaches: coaches.filter((a) => a.status === 'pending').length,
    pendingAppts: appts.filter((a) => a.status === 'bekliyor').length,
    gross: gross || deskGross,
    commission,
    current,
  };
}

export function addAdminNote(coachId: string, text: string) {
  const list = readJson<{ id: string; coachId: string; text: string; at: string }[]>( 'yks_admin_notes_v1', []);
  const arr = Array.isArray(list) ? list : [];
  writeJson('yks_admin_notes_v1', [{ id: uid('nt_'), coachId, text, at: new Date().toISOString() }, ...arr].slice(0, 80));
}

export function loadAdminNotes() {
  const list = readJson<{ id: string; coachId: string; text: string; at: string }[]>( 'yks_admin_notes_v1', []);
  return Array.isArray(list) ? list : [];
}

export function setApptStatus(coachId: string, apptId: string, status: AppointmentStatus) {
  const desk = loadCoachDesk(coachId);
  saveCoachDesk(coachId, {
    ...desk,
    appointments: desk.appointments.map((a) => (a.id === apptId ? { ...a, status } : a)),
  });
}
