import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK_PRE_QUALITY_MERGE } from '../data/bankData';
import { buildMergeManifest, mergeManifestJson, LOCKED_COLLISION_WINNERS } from './bankQualityMergeManifest';
import { MAIN_PACK_SHA256 } from './bankQualityMergePlan';
import { resolvedQualityPriorityNextItems } from '../data/bankQualityPriorityNextRevisionItems';
import { QUALITY_PRIORITY_NEXT_ITEMS } from '../data/bankQualityPriorityNextItems';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('final merge manifest (BANK yazılmaz)', () => {
  it('26 çakışmayı çözer, unique filler, overlay kullanır, json plan yazar', () => {
    const m = buildMergeManifest(BANK_PRE_QUALITY_MERGE);
    expect(m.applied).toBe(false);
    expect(m.writesBank).toBe(false);
    expect(m.starting84Count).toBe(84);
    expect(m.collisions).toHaveLength(26);
    expect(m.duplicateFillerAssignments).toEqual([]);
    expect(m.qpnUsesRevisionOverlay).toBe(true);
    expect(m.qpnRevisedIds.sort()).toEqual(
      ['qpn-s1-go-13', 'qpn-s1-go-19', 'qpn-s1-sy-r10', 'qpn-s1-sy-r5', 'qpn-tyt-fn-01', 'qpn-tyt-sy-07'].sort(),
    );
    const origById = new Map(QUALITY_PRIORITY_NEXT_ITEMS.map((x) => [x.row.id, x.row]));
    for (const r of m.replacements.filter((x) => x.quality_id.startsWith('qpn-'))) {
      const resolved = resolvedQualityPriorityNextItems().find((x) => x.row.id === r.quality_id)!;
      const orig = origById.get(r.quality_id)!;
      if (m.qpnRevisedIds.includes(r.quality_id)) {
        expect(JSON.stringify(resolved.row)).not.toBe(JSON.stringify(orig));
      }
    }
    expect(m.replacements.every((r) => r.status !== 'needs_source_verification' && r.status !== 'needs_human')).toBe(true);
    expect(m.human_pending.sort()).toEqual(['qf-8-ink-mm', 'qf-n038'].sort());
    expect(m.replacements.some((r) => m.source_pending.includes(r.quality_id))).toBe(false);
    expect(m.replacements.some((r) => ['qf-8-fen-p', 'qf-n051', 'qfp-s1-ol-01', 'qpn-s1-go-13', 'qpn-s1-go-19'].includes(r.quality_id))).toBe(
      false,
    );
    const fillers = m.replacements.map((r) => r.target_filler_id);
    expect(new Set(fillers).size).toBe(fillers.length);
    expect(m.projectedQuestions).toBe(7007);
    expect(MAIN_PACK_SHA256).toBe('734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2');
    expect(m.verification.applied).toBe(false);
    expect(m.verification.writesBank).toBe(false);
    expect(m.verification.uniqueEqualsCount).toBe(true);
    expect(m.verification.blockedInReplacements).toEqual([]);
    expect(m.verification.missingFillers).toEqual([]);
    expect(m.verification.targetsNotFiller).toEqual([]);
    expect(m.verification.topicMismatch).toEqual([]);
    expect(m.verification.lockedWinnersHonored).toBe(true);
    expect(m.verification.addCount).toBe(0);
    expect(m.bankDiff.writesBank).toBe(false);
    expect(m.bankDiff.addCount).toBe(0);
    expect(m.bankDiff.replaceCount).toBe(m.replacementCount);
    expect(m.bankDiff.questionsAfter).toBe(m.bankDiff.questionsBefore);
    expect(Object.fromEntries(m.collisions.map((c) => [c.filler_id, c.winner]))).toEqual(LOCKED_COLLISION_WINNERS);
    const json = mergeManifestJson(BANK_PRE_QUALITY_MERGE);
    const path = join(root, 'merge-manifest.json');
    const roundtrip = JSON.parse(readFileSync(path, 'utf8'));
    expect(roundtrip.replacementCount).toBe(m.replacementCount);
    expect(json.replacementCount).toBe(106);
    const bankSrc = readFileSync(join(root, 'src/data/bankData.ts'), 'utf8');
    expect(bankSrc).not.toContain('merge-manifest');
    console.log(
      'MANIFEST_SUMMARY',
      JSON.stringify({
        starting84: m.starting84Count,
        collisions: m.collisions.length,
        winners: m.collisions.filter((c) => c.winner).length,
        noWinner: m.collisions.filter((c) => !c.winner).map((c) => c.filler_id),
        final: m.replacementCount,
        excluded: m.excludedCount,
        source_pending: m.source_pending.length,
        human_pending: m.human_pending.length,
        collisionTable: m.collisions.map((c) => ({
          filler: c.filler_id,
          contenders: c.contenders,
          winner: c.winner,
          reason: c.reason,
        })),
      }),
    );
  });
});
