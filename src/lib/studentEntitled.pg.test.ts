import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
const sqlFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/tests/020_entitlement_pg.sql',
);

describe.skipIf(!pgUrl)('student_entitled PostgreSQL (YKS_PG_TEST_URL)', () => {
  it('psql ile 020_entitlement_pg.sql çalışır (ROLLBACK)', () => {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', sqlFile, pgUrl], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(out.toLowerCase()).toMatch(/rollback/);
  });
});

describe('PostgreSQL entegrasyon test yolu', () => {
  it('YKS_PG_TEST_URL yoksa atlanır; metin testi yerine supabase/tests/020_entitlement_pg.sql kullanılır', () => {
    expect(sqlFile.replace(/\\/g, '/')).toContain('supabase/tests/020_entitlement_pg.sql');
    if (!pgUrl) {
      expect(pgUrl).toBe('');
    }
  });
});
