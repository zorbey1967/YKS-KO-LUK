/** Ad/soyad doğrulama. Asıl güvenlik sunucu (011) tarafındadır; bu kopya yalnızca kayıt UX’i içindir. */

export const PERSON_NAME_REJECT =
  'Bu ad veya soyad kullanılamaz. Lütfen uygun, gerçek adınızı ve soyadınızı seçin.';

const TR_MAP: Record<string, string> = {
  ı: 'i',
  i: 'i',
  İ: 'i',
  I: 'i',
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ş: 's',
  Ş: 's',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** Tam eşleşme (kısa küfür / kısaltma). Alt dizge olarak kullanılmaz. */
const EXACT = new Set([
  'amk',
  'amq',
  'aq',
  'a q',
  'mk',
  'mq',
  'oc',
  'oç',
  'pic',
  'piç',
  'amcik',
  'amcık',
  'yarak',
  'yarrak',
  'sik',
  'sikerim',
  'siktir',
  'siktigim',
  'siktirim',
  'orospu',
  'orospucocugu',
  'orospuevladı',
  'orospuevladi',
  'got',
  'göt',
  'gotveren',
  'aminakoyim',
  'aminakoyayim',
  'amına',
  'amina',
  'ibne',
  'godoş',
  'godos',
  'pezevenk',
  'serefsiz',
  'fuck',
  'shit',
  'bitch',
  'asshole',
]);

/** En az 5 harf: birleşik yazımda da yakala. */
const CONTAINS = [
  'amınakoy',
  'aminakoy',
  'orospucocuk',
  'orospuevlad',
  'siktigimin',
  'siktirgit',
  'gotunu',
  'gotveren',
  'yarragi',
  'yarragı',
];

export function compactPersonKey(raw: string) {
  const lowered = String(raw || '')
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLocaleLowerCase('tr-TR');
  return lowered.replace(/[^a-z0-9]/g, '');
}

function partLooksLikeName(part: string) {
  const t = part.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (/\d/.test(t)) return false;
  if (/@/.test(t)) return false;
  return /^[\p{L}]+(?:[\s'\-][\p{L}]+)*$/u.test(t);
}

function tokenBlocked(token: string) {
  const compact = compactPersonKey(token);
  if (!compact) return true;
  if (EXACT.has(compact) || EXACT.has(token.trim().toLocaleLowerCase('tr-TR'))) return true;
  if (CONTAINS.some((w) => compact.includes(compactPersonKey(w)))) return true;
  return false;
}

export function personNameBlocked(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  const joined = `${first} ${last}`;
  const pieces = [first, last, joined, compactPersonKey(joined)];
  for (const p of pieces) {
    if (tokenBlocked(p)) return true;
  }
  for (const word of joined.split(/[\s\-'_.]+/).filter(Boolean)) {
    if (tokenBlocked(word)) return true;
  }
  return false;
}

export function validatePersonName(firstName: string, lastName: string): string {
  if (!partLooksLikeName(firstName) || !partLooksLikeName(lastName)) {
    return 'Ad ve soyad zorunlu. Yalnızca harf kullanın.';
  }
  if (personNameBlocked(firstName, lastName)) return PERSON_NAME_REJECT;
  return '';
}

export function fullPersonName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').trim();
}
