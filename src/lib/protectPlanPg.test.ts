import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { livePgUrlBlocked, pgSqlAvailable, runPgSqlFile } from './pgTestRun';

const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
const sqlFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/tests/030_security_pg.sql',
);

describe.skipIf(!pgSqlAvailable())('030 PostgreSQL', () => {
  it('psql/docker ile 030_security_pg.sql çalışır (ROLLBACK)', () => {
    if (pgUrl) expect(livePgUrlBlocked(pgUrl)).toBe(false);
    const out = runPgSqlFile(sqlFile);
    expect(out.toLowerCase()).toMatch(/rollback/);
  });
});

describe('030 PostgreSQL test dosyası', () => {
  it('regproc yerine pg_proc; canlı URL yok', () => {
    expect(sqlFile.replace(/\\/g, '/')).toContain('supabase/tests/030_security_pg.sql');
    expect(livePgUrlBlocked('postgresql://x@db.xyz.supabase.co/postgres')).toBe(true);
  });
});
