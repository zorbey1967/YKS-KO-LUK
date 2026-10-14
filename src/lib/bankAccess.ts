/** Soru bankası sunucu kapısı. İstemci gizleme yetki değildir. */

export type BankAccessInput = {
  signedIn: boolean;
  role: string;
  accountActive: boolean;
  entitled: boolean;
  isAdmin: boolean;
  isOwner: boolean;
};

export function canLoadBankPack(input: BankAccessInput) {
  if (!input.signedIn) return false;
  if (!input.accountActive) return false;
  if (input.isOwner || input.isAdmin) return true;
  if (input.role === 'coach') return false;
  if (input.role !== 'student') return false;
  return input.entitled;
}
