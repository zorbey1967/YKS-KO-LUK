import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { isValidQuestion, questionFingerprint } from '../data/bankDedupe';
import { flattenQualityFixPack, QUALITY_FIX_META } from '../data/bankQualityFixPack';

export type ReplacementRow = {
  topic: string;
  dropFillerId: string | null;
  addQualityId: string;
  action: 'replace_filler' | 'add_if_no_filler';
  fillerStemPrefix: string;
  qualityStemPrefix: string;
};

/** Onaysız uygulanmaz. Ana bankayı değiştirmez. */
export function proposeQualityMerge(
  bank: Record<string, BankQuestion[]>,
  packFlat = flattenQualityFixPack(),
) {
  const bankCount = Object.values(bank).reduce((n, l) => n + l.length, 0);
  const packIds = packFlat.map((x) => x.row.id);
  const bankIds = new Set(Object.values(bank).flatMap((l) => l.map((q) => q.id)));
  const idCollisions = packIds.filter((id) => bankIds.has(id));
  const unknownTopics = [...new Set(packFlat.map((x) => x.topic).filter((t) => !bank[t]))];

  const usedFiller = new Set<string>();
  const replacements: ReplacementRow[] = [];
  for (const item of packFlat) {
    const fillers = (bank[item.topic] || []).filter((q) => isFillerQuestion(q) && !usedFiller.has(q.id));
    const drop = fillers[0] || null;
    if (drop) usedFiller.add(drop.id);
    replacements.push({
      topic: item.topic,
      dropFillerId: drop?.id || null,
      addQualityId: item.row.id,
      action: drop ? 'replace_filler' : 'add_if_no_filler',
      fillerStemPrefix: String(drop?.q || '').replace(/\s+/g, ' ').trim().slice(0, 64),
      qualityStemPrefix: String(item.row.q || '').replace(/\s+/g, ' ').trim().slice(0, 64),
    });
  }

  const packFps = packFlat.map((x) => questionFingerprint(x.row));
  const packFpDup = packFps.length - new Set(packFps).size;
  const invalid = packFlat.filter((x) => !isValidQuestion(x.row)).map((x) => x.row.id);

  return {
    mergedIntoBank: QUALITY_FIX_META.mergedIntoBank,
    requiresOwnerApproval: QUALITY_FIX_META.requiresOwnerApproval,
    bankCount,
    packCount: packFlat.length,
    replaceFiller: replacements.filter((r) => r.action === 'replace_filler').length,
    addOnly: replacements.filter((r) => r.action === 'add_if_no_filler').length,
    idCollisions,
    unknownTopics,
    packFpDup,
    invalid,
    projectedBankCountIfReplaceOnly: bankCount - replacements.filter((r) => r.dropFillerId).length + packFlat.length,
    replacements,
    rollback: MERGE_ROLLBACK_PLAN.summary,
  };
}

export const PACK_JSON_REL = 'supabase/functions/bank-pack/pack.json';
export const PACK_META_REL = 'supabase/functions/bank-pack/pack.meta.json';
export const MAIN_PACK_SHA256 = QUALITY_FIX_META.mainPackSha256;

/** pack.json gitignore’da; git checkout geri getirmez. Bu turda kopya oluşturulmaz. */
export const MERGE_ROLLBACK_PLAN = {
  summary:
    'pack.json gitignore; git checkout onu geri getirmez. Birleşmeden önce supabase/.temp altına kopya; SHA karşılaştır. QUALITY_FIX_PACK ve QUALITY_PRIORITY_PACK ayrı durur; bu turda kopya ve yazım yok.',
  packJsonGitignored: true,
  gitCheckoutRestoresPackJson: false,
  currentPackPath: PACK_JSON_REL,
  currentMetaPath: PACK_META_REL,
  backupDirAlreadyGitignored: 'supabase/.temp',
  backupMethod:
    'Birleştirme komutundan hemen önce (henüz çalıştırma): copy pack.json -> supabase/.temp/pack.json.pre-merge.<ilk12sha>. Bu klasör .gitignore’da. pack.json ve BANK bu turda kopyalanmaz/yazılmaz.',
  shaBeforeMerge: MAIN_PACK_SHA256,
  shaCheck:
    'Önce: npm run verify:bank çıktısı sha256=734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2. Sonra: yeni sha ≠ yedek sha ise birleşme yazılmıştır. Geri alma: yedek dosyayı pack.json üzerine kopyala; tracked src/data değiştiyse git checkout -- src/data/bankData.ts src/data/bankPackOriginal.ts (pack.json değil). Tekrar verify:bank eski sha.',
  rollbackSteps: [
    'supabase/.temp/pack.json.pre-merge.* → supabase/functions/bank-pack/pack.json (git checkout kullanma)',
    'Tracked kaynak değiştiyse: git checkout -- src/data/bankData.ts src/data/bankPackOriginal.ts',
    'npm run verify:bank → questions=7007 ve sha256=734e47…',
    'QUALITY_FIX_META.mergedIntoBank false kalmalı',
  ],
  thisTurnCreatedBackup: false,
} as const;
