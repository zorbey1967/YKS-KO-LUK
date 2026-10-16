/** PostgREST / Supabase hata nesnesi Error olmayabilir; String(e) = [object Object]. */
export function postgrestErrorText(e: unknown) {
  if (e == null) return '';
  if (typeof e === 'string') return e.replace(/\s+/g, ' ').trim();
  if (e instanceof Error) {
    const extra = e as Error & { code?: unknown; details?: unknown; hint?: unknown };
    return [extra.code, extra.message, extra.details, extra.hint].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    return [o.code, o.message, o.details, o.hint].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  return String(e).replace(/\s+/g, ' ').trim();
}

export function isMissingRelation(e: unknown) {
  const msg = postgrestErrorText(e);
  return /schema cache|does not exist|Could not find the table|Could not find the function|PGRST202|PGRST205/i.test(msg);
}

export function isUniqueViolation(e: unknown) {
  const msg = postgrestErrorText(e);
  return /23505|duplicate key/i.test(msg);
}

export function formatCloudQueryError(e: unknown) {
  const text = postgrestErrorText(e).slice(0, 220);
  return text || 'bilinmeyen sorgu hatası';
}

export function userFacingCloudError(e: unknown, fallback = 'İşlem şu an tamamlanamadı.') {
  const text = postgrestErrorText(e);
  if (!text) return fallback;
  if (isMissingRelation(e) || /PGRST|schema cache|SQLSTATE|postgres|RPC|stack|42501|JWT|service_role|migration|debug|internal error|fetchActiveCoaches/i.test(text)) return fallback;
  if (text.length > 140) return fallback;
  return text;
}
