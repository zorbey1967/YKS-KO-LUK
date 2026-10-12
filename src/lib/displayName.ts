/** Görünen ad. E-posta asla isim fallback’i değildir. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string | null | undefined) {
  const s = String(value || '').trim();
  return s.length >= 6 && EMAIL_RE.test(s);
}

export function joinCoachName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').trim();
}

export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const t = String(full || '').trim();
  if (!t || looksLikeEmail(t)) return { firstName: '', lastName: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function getCoachDisplayName(
  input?: { name?: string | null; firstName?: string | null; lastName?: string | null } | string | null,
): string {
  if (input == null) return 'Koç';
  if (typeof input === 'string') {
    const t = input.trim();
    if (!t || looksLikeEmail(t)) return 'Koç';
    return t;
  }
  const joined = joinCoachName(input.firstName || '', input.lastName || '');
  if (joined && !looksLikeEmail(joined)) return joined;
  const t = String(input.name || '').trim();
  if (!t || looksLikeEmail(t)) return 'Koç';
  return t;
}

export function getPersonDisplayName(
  name: string | null | undefined,
  fallback: string,
): string {
  const t = String(name || '').trim();
  if (!t || looksLikeEmail(t)) return fallback;
  return t;
}
