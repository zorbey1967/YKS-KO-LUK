import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { livePgUrlBlocked, pgSqlAvailable, runPgSqlFile } from './pgTestRun';

const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
const sqlFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/tests/020_entitlement_pg.sql',
);

describe.skipIf(!pgSqlAvailable())('student_entitled PostgreSQL', () => {
  it('psql/docker ile 020_entitlement_pg.sql çalışır (ROLLBACK); canlı URL yok', () => {
    if (pgUrl) expect(livePgUrlBlocked(pgUrl)).toBe(false);
    const out = runPgSqlFile(sqlFile);
    expect(out.toLowerCase()).toMatch(/rollback/);
  });
});

describe('PostgreSQL entegrasyon test yolu', () => {
  it('canlı supabase.co reddedilir; dosya sözleşmesi durur', () => {
    expect(sqlFile.replace(/\\/g, '/')).toContain('supabase/tests/020_entitlement_pg.sql');
    expect(livePgUrlBlocked('postgresql://postgres@db.abc.supabase.co:5432/postgres')).toBe(true);
    expect(livePgUrlBlocked('postgresql://postgres@127.0.0.1:54322/postgres')).toBe(false);
  });
});
