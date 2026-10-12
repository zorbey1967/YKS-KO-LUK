import type { BankQuestion } from '../lib/types';

export function q(
  id: string,
  text: string,
  options: [string, string, string, string, string],
  answer: number,
  explain: string,
  difficulty = 'Orta',
  kind?: string,
): BankQuestion {
  return { id, q: text, o: options, a: answer, e: explain, difficulty, kind };
}
