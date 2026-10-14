import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { livePgUrlBlocked, pgSqlAvailable, runPgSqlFile } from './pgTestRun';

const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
const sqlFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/tests/027_no_email_admin_pg.sql',
);

describe.skipIf(!pgSqlAvailable())('027 protect_role PostgreSQL', () => {
  it('psql/docker ile 027_no_email_admin_pg.sql çalışır (ROLLBACK)', () => {
    if (pgUrl) expect(livePgUrlBlocked(pgUrl)).toBe(false);
    const out = runPgSqlFile(sqlFile);
    expect(out.toLowerCase()).toMatch(/rollback/);
  });
});

describe('027 PostgreSQL test dosyası', () => {
  it('canlı URL reddedilir; senaryo dosyası yerelde durur', () => {
    expect(sqlFile.replace(/\\/g, '/')).toContain('supabase/tests/027_no_email_admin_pg.sql');
    expect(livePgUrlBlocked('https://naiakscryafhvcghjmzx.supabase.co')).toBe(true);
  });
});
