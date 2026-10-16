import type { PageId } from './types';

/** Tek yerden aç/kapa. Kod ve veri silinmez; menü ve kartlar bu bayrağa bakar. */
export const QUESTION_BANK_ENABLED = false;

export function isNavPageVisible(id: PageId): boolean {
  if (id === 'questionbank') return QUESTION_BANK_ENABLED;
  return true;
}
