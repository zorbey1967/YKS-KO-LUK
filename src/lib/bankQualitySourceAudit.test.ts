import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_FIX_META } from '../data/bankQualityFixPack';
import { MERGE_ROLLBACK_PLAN, MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { auditQualityPack } from './bankQualityGateAudit';
import {
  HUMAN_CLAIMS,
  PENDING_SOURCE_REVIEWS,
  SOURCE_CLAIMS,
  SOURCE_CONTRADICTIONS,
  pendingMappingNotes,
  sourceAuditSummary,
  topicNonFillerCount,
} from './bankQualitySourceAudit';
import { fillerInventory, reauditGateSafeMappings, STAGED_QUALITY_PLAN } from './bankQualityInventory';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('kaynak ve bekleyen eşleme (birleştirme yok)', () => {
  it('47 eski atıf: 8 TDK yazım çekildi; kalan needs_source_verification; 2 tarih insan', () => {
    const sum = sourceAuditSummary();
    expect(SOURCE_CLAIMS).toHaveLength(47);
    expect(sum.sourceVerified).toBe(13);
    expect(sum.needsSourceVerification).toBe(34);
    expect(sum.needsHuman).toEqual(['qf-n038', 'qf-8-ink-mm']);
    expect(sum.waitingSourceOrHuman).toBe(36);
    expect(sum.sozlukGovTrFetched).toBe(false);
    expect(sum.mebTextbookFetched).toBe(false);
    expect(sum.mebProgramFetched).toBe(true);
    expect(SOURCE_CLAIMS.filter((c) => c.status === 'source_verified').every((c) => Boolean(c.verifiedAt && c.verifiedClaim))).toBe(true);
    expect(sum.statusMismatch).toEqual([]);
    expect(HUMAN_CLAIMS.every((c) => c.status === 'needs_human')).toBe(true);
    for (const c of SOURCE_CLAIMS) {
      const item = QUALITY_FIX_ITEMS.find((x) => x.row.id === c.id);
      expect(item?.status, c.id).toBe(c.status);
    }
    expect(QUALITY_FIX_ITEMS.filter((x) => x.status === 'source_verified')).toHaveLength(13);
    expect(QUALITY_FIX_ITEMS.filter((x) => x.status === 'needs_source_verification')).toHaveLength(34);
    expect(PENDING_SOURCE_REVIEWS).toHaveLength(34);
    expect(new Set(PENDING_SOURCE_REVIEWS.map((r) => r.id))).toEqual(
      new Set(SOURCE_CLAIMS.filter((c) => c.status === 'needs_source_verification').map((c) => c.id)),
    );
    expect(PENDING_SOURCE_REVIEWS.every((r) => r.supportsCorrectAnswer === false)).toBe(true);
    expect(SOURCE_CONTRADICTIONS.map((c) => c.id).sort()).toEqual(
      ['qf-8-fen-p', 'qf-n082', 'qf-n085', 'qf-n097', 'qf-n099'].sort(),
    );
  });

  it('altı bekleyen eşleme zorla onaylanmaz; basınç ekleri kavramsal kopya', () => {
    const notes = pendingMappingNotes(BANK_PRE_QUALITY_MERGE);
    expect(notes).toHaveLength(6);
    expect(notes.filter((n) => n.addQualityId === 'qf-n038' || n.addQualityId === 'qf-8-ink-mm').every((n) => n.verdict === 'bekle' && n.action === 'replace_filler')).toBe(true);
    const p = notes.find((n) => n.addQualityId === 'qf-8-fen-p');
    const a = notes.find((n) => n.addQualityId === 'qf-n051');
    const z = notes.find((n) => n.addQualityId === 'qf-n049');
    const t = notes.find((n) => n.addQualityId === 'qf-n073');
    expect(p?.verdict).toBe('ekleme');
    expect(p?.nearBankIds).toContain('lgs-bs-1');
    expect(a?.verdict).toBe('ekleme');
    expect(a?.nearBankIds).toContain('s8-fn-1');
    expect(z?.action).toBe('add_if_no_filler');
    expect(z?.levelOk).toBe(true);
    expect(z?.verdict).toBe('bekle');
    expect(t?.verdict).toBe('ekleme');
    const uslu = topicNonFillerCount(BANK_PRE_QUALITY_MERGE, '8. Sınıf|Matematik|Üslü ifadeler');
    const basinc = topicNonFillerCount(BANK_PRE_QUALITY_MERGE, '8. Sınıf|Fen|Basınç');
    expect(z?.dropFillerId).toBeNull();
    expect(uslu.total).toBe(53);
    expect(basinc.filler).toBe(0);
    expect(basinc.nonFiller).toBe(23);
    console.log('PENDING_MAP', JSON.stringify(notes));
    console.log('TOPIC_NEED', JSON.stringify({ uslu, basinc, tytPar: topicNonFillerCount(BANK_PRE_QUALITY_MERGE, 'YKS TYT|Türkçe|Paragraf') }));
  });

  it('geri alma planı pack.json gitignore konumuna uyar; yedek bu turda yok', () => {
    expect(MERGE_ROLLBACK_PLAN.gitCheckoutRestoresPackJson).toBe(false);
    expect(MERGE_ROLLBACK_PLAN.thisTurnCreatedBackup).toBe(false);
    expect(MERGE_ROLLBACK_PLAN.currentPackPath).toBe('supabase/functions/bank-pack/pack.json');
    expect(existsSync(join(root, MERGE_ROLLBACK_PLAN.currentPackPath))).toBe(true);
    expect(existsSync(join(root, 'supabase/.temp'))).toBe(true);
    expect(MAIN_PACK_SHA256).toBe('734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2');
    expect(QUALITY_FIX_META.mergedIntoBank).toBe(false);
    const audit = auditQualityPack(BANK_PRE_QUALITY_MERGE);
    expect(audit.bankCount).toBe(7007);
    expect(audit.sourceCitedFetched).toBe(13);
    expect(audit.needsSourceVerification).toHaveLength(34);
    expect(audit.mappingSafe).toBe(83);
    expect(audit.allChecksPassCount).toBe(84);
    expect(Object.values(BANK_PRE_QUALITY_MERGE).reduce((n, l) => n + l.length, 0)).toBe(7007);
    const inv = fillerInventory(BANK_PRE_QUALITY_MERGE);
    expect(inv.filler).toBe(5643);
    expect(inv.top20).toHaveLength(20);
    expect(inv.osymNote).toContain('osym');
    const re = reauditGateSafeMappings(BANK_PRE_QUALITY_MERGE);
    expect(re.gateSafe).toBe(83);
    expect(re.gateUnsafe).toBe(37);
    expect(re.stillSafe).toBe(re.gateSafe - re.stillSafeDropped.length);
    expect(STAGED_QUALITY_PLAN.mergeThisTurn).toBe(false);
    expect(STAGED_QUALITY_PLAN.generateFillerQuestions).toBe(false);
    console.log('FILLER_TOP20', JSON.stringify(inv.top20));
    console.log('FILLER_BY_LEVEL', JSON.stringify(inv.byLevel));
    console.log('FILLER_BY_SUBJECT', JSON.stringify(inv.bySubject));
    console.log('MAPPING_REAUDIT', JSON.stringify({
      gateSafe: re.gateSafe,
      stillSafe: re.stillSafe,
      dropped: re.stillSafeDropped,
      mathReplaceOk: re.mathReplaceOk,
      sourceReplaceOk: re.sourceReplaceOk,
      clusters: re.sameSkillClusters.length,
    }));
  });
});
