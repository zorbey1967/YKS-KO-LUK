/**
 * ZORRO tek asistan: diğer ekranlar ayrı AI penceresi açmaz, ZORRO'yu (isteğe bağlı bir soruyla) açar.
 * Dinleyen: components/CoachChat.tsx.
 */
export const ZORRO_OPEN_EVENT = 'yks-open-zorro';

export function openZorro(prompt?: string) {
  window.dispatchEvent(new CustomEvent(ZORRO_OPEN_EVENT, { detail: prompt ? { prompt: prompt.slice(0, 600) } : {} }));
}
