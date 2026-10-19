/**
 * Türkçe küfür / hakaret taraması (yüksek güven).
 * Kısa/belirsiz eşleşmeler ceza üretmez; masum isimler için exact+token sınırlıdır.
 * Asıl sunucu: 050_content_moderation + content-moderate edge.
 */

import { compactPersonKey, personNameBlocked } from './personName';

export type ModerationKind = 'display_name' | 'voice_meeting';
export type ModerationStatus = 'reviewing' | 'suspended' | 'appealed' | 'restored';

export type ProfanityScan = {
  blocked: boolean;
  severe: boolean;
  confidence: number;
  category: 'none' | 'profanity' | 'insult';
  /** Eşleşen kategori etiketi; ham küfür metni UI’ye yazılmaz. */
  label: string;
};

/** Exact token (sıkıştırılmış). Kısa olanlar yalnızca tam token. */
const EXACT_SEVERE = new Set([
  'amk', 'amq', 'orospu', 'orospucocugu', 'orospuevladi', 'orospuevladı',
  'sikerim', 'siktir', 'siktigim', 'aminakoyim', 'aminakoyayim',
  'yarrak', 'yarak', 'amcik', 'amcık', 'pezevenk', 'serefsiz', 'şerefsiz',
  'ibne', 'gotveren', 'götveren', 'fuck', 'bitch', 'asshole',
]);

const EXACT_MILD = new Set(['aq', 'mk', 'mq', 'oc', 'oç', 'pic', 'piç', 'got', 'göt', 'shit']);

const LONG_SEVERE = [
  'aminakoy', 'amınakoy', 'orospucocuk', 'orospuevlad', 'siktigimin', 'siktirgit',
  'gotveren', 'götveren', 'yarragi', 'yarrağı',
];

/** Masum / belirsiz — otomatik ceza yok. */
const SAFE_ALLOW = new Set([
  'ali', 'veli', 'ayse', 'ayşe', 'fatma', 'mehmet', 'ahmet', 'can', 'cem',
  'asik', 'aşık', 'klasik', 'psikoloji', 'nasil', 'nasıl', 'sikayet', 'şikayet',
]);

export function scanProfanityText(raw: string): ProfanityScan {
  const text = String(raw || '').trim();
  if (!text || text.length < 2) {
    return { blocked: false, severe: false, confidence: 0, category: 'none', label: '' };
  }
  const compact = compactPersonKey(text);
  if (SAFE_ALLOW.has(compact)) {
    return { blocked: false, severe: false, confidence: 0, category: 'none', label: '' };
  }

  const tokens = text
    .toLocaleLowerCase('tr-TR')
    .split(/[\s,.;:!?'"()\-_]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const tok of tokens) {
    const c = compactPersonKey(tok);
    if (!c || SAFE_ALLOW.has(c)) continue;
    if (EXACT_SEVERE.has(c) || EXACT_SEVERE.has(tok)) {
      return { blocked: true, severe: true, confidence: 0.97, category: 'profanity', label: 'ağır küfür' };
    }
    if (EXACT_MILD.has(c) || EXACT_MILD.has(tok)) {
      return { blocked: true, severe: false, confidence: 0.85, category: 'profanity', label: 'uygunsuz ifade' };
    }
  }

  for (const w of LONG_SEVERE) {
    const cw = compactPersonKey(w);
    if (cw.length >= 5 && compact.includes(cw)) {
      return { blocked: true, severe: true, confidence: 0.94, category: 'profanity', label: 'ağır küfür' };
    }
  }

  return { blocked: false, severe: false, confidence: 0, category: 'none', label: '' };
}

/** Profil adı: mevcut personName kapısı + scan. */
export function scanDisplayName(firstName: string, lastName: string): ProfanityScan {
  if (personNameBlocked(firstName, lastName)) {
    const joined = `${firstName} ${lastName}`.trim();
    const scan = scanProfanityText(joined);
    if (scan.blocked) return scan;
    return { blocked: true, severe: true, confidence: 0.95, category: 'profanity', label: 'uygunsuz ad' };
  }
  return scanProfanityText(`${firstName} ${lastName}`);
}

export function shouldAutoSuspend(scan: ProfanityScan): boolean {
  return scan.blocked && scan.severe && scan.confidence >= 0.92;
}

export function moderationStatusLabel(s: ModerationStatus): string {
  if (s === 'reviewing') return 'İnceleniyor';
  if (s === 'suspended') return 'Askıya Alındı';
  if (s === 'appealed') return 'İtiraz Edildi';
  if (s === 'restored') return 'Geri Açıldı';
  return s;
}

export function moderationKindLabel(k: ModerationKind): string {
  return k === 'display_name' ? 'Kullanıcı adı' : 'Sesli görüşme';
}
