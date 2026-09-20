import type { BankManifest, BankQuestion } from '../lib/types';
import { SCHOOL_CURRICULUM } from '../lib/curriculum';
import { SCHOOL_BANK } from './bankSchool';
import { SCHOOL_BANK_MORE } from './bankSchoolMore';
import { KPSS_BANK, KPSS_CURRICULUM } from './bankKpss';
import { KPSS_BANK_MORE } from './bankKpssMore';
import { YKS_BANK, YKS_CURRICULUM } from './bankYks';
import { YKS_BANK_MORE } from './bankYksMore';
import { YKS_BANK_ELITE } from './bankYksElite';
import { YKS_BANK_GAP } from './bankYksGap';
import { coverCurriculum } from './bankMake';

type Q = BankQuestion;

function mergeBanks(...parts: Record<string, Q[]>[]): Record<string, Q[]> {
  const out: Record<string, Q[]> = {};
  for (const part of parts) {
    for (const [key, list] of Object.entries(part)) {
      out[key] = [...(out[key] || []), ...list];
    }
  }
  return out;
}

export const CURRICULUM: Record<string, Record<string, string[]>> = {
  ...Object.fromEntries(Object.entries(SCHOOL_CURRICULUM).filter(([k]) => k !== 'KPSS Adayı' && k !== 'Mezun / YKS')),
  ...YKS_CURRICULUM,
  ...KPSS_CURRICULUM,
};

export const BANK: Record<string, Q[]> = coverCurriculum(
  CURRICULUM,
  mergeBanks(
    SCHOOL_BANK,
    SCHOOL_BANK_MORE,
    KPSS_BANK,
    KPSS_BANK_MORE,
    YKS_BANK,
    YKS_BANK_MORE,
    YKS_BANK_ELITE,
    YKS_BANK_GAP,
  ),
);

export function bundledManifest(): BankManifest {
  const slugify = (name: string) => name
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i').replaceAll('ğ', 'g').replaceAll('ü', 'u')
    .replaceAll('ş', 's').replaceAll('ö', 'o').replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const levels = Object.keys(CURRICULUM).map((name) => {
    const subjects = Object.keys(CURRICULUM[name]);
    return {
      name,
      slug: slugify(name),
      subjects: subjects.length,
      topics: subjects.reduce((n, s) => n + CURRICULUM[name][s].length, 0),
    };
  });
  return {
    version: 4,
    generatedAt: new Date().toISOString(),
    questionCount: Object.values(BANK).reduce((n, list) => n + list.length, 0),
    levels,
    curriculum: CURRICULUM,
  };
}

export function questionsForLevel(level: string): Record<string, Q[]> {
  const out: Record<string, Q[]> = {};
  for (const [key, list] of Object.entries(BANK)) {
    if (key.startsWith(`${level}|`)) out[key] = list;
  }
  return out;
}
