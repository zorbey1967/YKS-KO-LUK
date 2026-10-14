import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { livePgUrlBlocked, pgSqlAvailable, runPgSqlFile } from './pgTestRun';

const pgUrl = String(process.env.YKS_PG_TEST_URL || '').trim();
const sqlFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/tests/032_disable_non_owner_pg.sql',
);

describe.skipIf(!pgSqlAvailable())('032 PostgreSQL', () => {
  it('psql/docker ile 032_disable_non_owner_pg.sql çalışır (ROLLBACK)', () => {
    if (pgUrl) expect(livePgUrlBlocked(pgUrl)).toBe(false);
    const out = runPgSqlFile(sqlFile);
    expect(out.toLowerCase()).toMatch(/rollback/);
  });
});

describe('032 PostgreSQL test dosyası', () => {
  it('izole PG yoksa atlanır; canlı hesap değiştirilmez', () => {
    expect(sqlFile.replace(/\\/g, '/')).toContain('supabase/tests/032_disable_non_owner_pg.sql');
    expect(livePgUrlBlocked('postgresql://postgres@db.xxx.supabase.co:5432/postgres')).toBe(true);
  });
});
