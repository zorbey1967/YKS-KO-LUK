import { splitPersonName, getPersonDisplayName } from './displayName';

export type SupportStatus = 'new' | 'reviewing' | 'replied';
export type SupportNameConsent = 'yes' | 'no' | null;

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

export function supportTicketInsertAllowed(opts: { authUid: string | null; ticketUserId: string }) {
  return Boolean(opts.authUid) && opts.authUid === opts.ticketUserId;
}

export function supportNextStatus(current: SupportStatus, next: string): SupportStatus {
  return parseSupportStatus(next) || current;
}
