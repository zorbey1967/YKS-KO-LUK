import { splitPersonName, getPersonDisplayName } from './displayName';

export type SupportStatus = 'new' | 'reviewing' | 'replied';
export type SupportSenderRole = 'student' | 'coach';
export type SupportNameConsent = 'yes' | 'no' | null;
export type SupportAdminFilter = 'all' | 'new' | 'unread' | 'replied' | 'nudged';

/** Öğrenci/koç “Hatırlat” — yönetici panelinde alarm; sohbet metni olarak gösterilmez. */
export const SUPPORT_NUDGE_MARKER = '[[HATIRLAT]]';

export type SupportPrefs = { nameConsent: SupportNameConsent };

export function emptySupportPrefs(): SupportPrefs {
  return { nameConsent: null };
}

export function supportStatusLabel(status: string) {
  if (status === 'reviewing') return 'İnceleniyor';
  if (status === 'replied') return 'Yanıtlandı';
  return 'Yeni';
}

export function parseSupportStatus(raw: unknown): SupportStatus {
  const s = String(raw || '');
  if (s === 'reviewing' || s === 'replied' || s === 'new') return s;
  return 'new';
}

export function parseSenderRole(raw: unknown): SupportSenderRole {
  return String(raw || '') === 'coach' ? 'coach' : 'student';
}

export function supportSenderRoleLabel(role: SupportSenderRole | string) {
  return role === 'coach' ? 'Koç' : 'Öğrenci';
}

export function supportReplyRoleLabel(role: string) {
  if (role === 'admin') return 'Yönetici';
  if (role === 'coach') return 'Koç';
  return 'Öğrenci';
}

export function filterAdminSupportTickets<T extends { status: SupportStatus; id: string }>(
  rows: T[],
  filter: SupportAdminFilter,
  nudged: Record<string, boolean>,
): T[] {
  if (filter === 'all') return rows;
  if (filter === 'new' || filter === 'unread') return rows.filter((r) => r.status === 'new');
  if (filter === 'replied') return rows.filter((r) => r.status === 'replied');
  if (filter === 'nudged') return rows.filter((r) => Boolean(nudged[r.id]));
  return rows;
}

export function namesFromProfile(profileName: string | null | undefined) {
  const display = getPersonDisplayName(profileName, '');
  if (!display) return { firstName: '', lastName: '', hasName: false };
  const parts = splitPersonName(display);
  return {
    firstName: parts.firstName,
    lastName: parts.lastName,
    hasName: Boolean(parts.firstName || parts.lastName),
  };
}

export function needsSupportNameConsent(profileName: string | null | undefined, consent: SupportNameConsent) {
  if (consent === 'yes' || consent === 'no') return false;
  return !namesFromProfile(profileName).hasName;
}

export function supportNamesForTicket(input: {
  profileName: string | null | undefined;
  consent: SupportNameConsent;
}) {
  const n = namesFromProfile(input.profileName);
  if (n.hasName) return { firstName: n.firstName, lastName: n.lastName };
  if (input.consent === 'yes') return { firstName: n.firstName, lastName: n.lastName };
  return { firstName: '', lastName: '' };
}

export function supportTicketVisible(opts: {
  authUid: string | null;
  isAdmin: boolean;
  ticketUserId: string;
}) {
  if (!opts.authUid) return false;
  if (opts.isAdmin) return true;
  return opts.authUid === opts.ticketUserId;
}

/** Öğrenci listesi: başka user_id satırlarını asla ekrana taşıma (defense-in-depth). */
export function filterOwnSupportTickets<T extends { user_id: string }>(
  rows: T[],
  authUid: string | null,
): T[] {
  if (!authUid) return [];
  return rows.filter((r) => r.user_id === authUid);
}

/** A/B senaryosu: A yalnızca A, B yalnızca B; admin her ikisini görebilir. */
export function supportIsolationScenario(opts: {
  tickets: Array<{ id: string; user_id: string; subject: string }>;
  studentA: string;
  studentB: string;
}) {
  const forA = filterOwnSupportTickets(opts.tickets, opts.studentA);
  const forB = filterOwnSupportTickets(opts.tickets, opts.studentB);
  const adminSees = opts.tickets;
  return {
    aSeesOnlyOwn: forA.every((t) => t.user_id === opts.studentA)
      && !forA.some((t) => t.subject === 'TEST B')
      && forA.some((t) => t.subject === 'TEST A'),
    bSeesOnlyOwn: forB.every((t) => t.user_id === opts.studentB)
      && !forB.some((t) => t.subject === 'TEST A')
      && forB.some((t) => t.subject === 'TEST B'),
    adminSeesBoth: adminSees.some((t) => t.subject === 'TEST A')
      && adminSees.some((t) => t.subject === 'TEST B'),
    aSubjects: forA.map((t) => t.subject),
    bSubjects: forB.map((t) => t.subject),
  };
}

export function supportTicketInsertAllowed(opts: { authUid: string | null; ticketUserId: string }) {
  return Boolean(opts.authUid) && opts.authUid === opts.ticketUserId;
}

export function supportNextStatus(current: SupportStatus, next: string): SupportStatus {
  return parseSupportStatus(next) || current;
}
