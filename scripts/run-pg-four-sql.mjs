/**
 * İzole PG güvenlik senaryolarını throwaway Docker’da çalıştırır. Host psql gerekmez.
 * Canlı supabase.co reddedilir. Parola yazdırılmaz.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'yks-pg-four-sql';
const LIVE = 'naiakscryafhvcghjmzx';

function dockerBin() {
  const home = process.env.LOCALAPPDATA || '';
  const binDir = join(home, 'Programs', 'DockerDesktop', 'resources', 'bin');
  if (binDir) process.env.PATH = `${binDir};${process.env.PATH || ''}`;
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore', timeout: 15_000 });
    return 'docker';
  } catch {
    const fallback = join(binDir, 'docker.exe');
    execFileSync(fallback, ['version'], { stdio: 'ignore', timeout: 15_000 });
    return fallback;
  }
}

const docker = dockerBin();

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, ...opts });
}

function psql(db, sql) {
  return sh(docker, ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
  });
}

function load(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const suites = [
  {
    db: 't020',
    label: 'studentEntitled',
    files: [
      'supabase/tests/020_local_pg_bootstrap.sql',
      'supabase/migrations/020_appointment_entitlement_caller_only.sql',
      'supabase/tests/020_entitlement_pg.sql',
    ],
  },
  {
    db: 't027',
    label: 'protectRole',
    files: [
      'supabase/tests/pg_security_bootstrap.sql',
      'supabase/migrations/027_live010_no_email_admin.sql',
      'supabase/tests/027_no_email_admin_pg.sql',
    ],
  },
  {
    db: 't030',
    label: 'protectPlan',
    files: [
      'supabase/tests/pg_security_bootstrap.sql',
      'supabase/migrations/027_live010_no_email_admin.sql',
      'supabase/migrations/029_account_suspend.sql',
      'supabase/migrations/030_owner_trial_weekplan_exam.sql',
      'supabase/tests/030_security_pg.sql',
    ],
  },
  {
    db: 't040',
    label: 'approvedCancel',
    files: [
      'supabase/tests/pg_security_bootstrap.sql',
      'supabase/migrations/040_approved_cancel_audit.sql',
      'supabase/tests/040_cancel_pg.sql',
    ],
  },
  {
    db: 't032',
    label: 'disableNonOwner',
    files: [
      'supabase/tests/pg_security_bootstrap.sql',
      'supabase/migrations/029_account_suspend.sql',
      'supabase/migrations/030_owner_trial_weekplan_exam.sql',
      'supabase/migrations/032_disable_non_owner_accounts.sql',
      'supabase/tests/032_disable_non_owner_pg.sql',
    ],
  },
];

await (async () => {
  try {
    try { sh(docker, ['rm', '-f', name], { stdio: 'pipe' }); } catch { /* yok */ }
    sh(docker, [
      'run', '-d', '--name', name,
      '-e', 'POSTGRES_PASSWORD=test',
      '-e', 'POSTGRES_DB=postgres',
      'postgres:16-alpine',
    ]);
    let ready = false;
    for (let i = 0; i < 40; i += 1) {
      try {
        sh(docker, ['exec', name, 'pg_isready', '-U', 'postgres']);
        psql('postgres', 'select 1;');
        ready = true;
        break;
      } catch {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      }
    }
    if (!ready) throw new Error('Postgres hazır olmadı');

    for (const suite of suites) {
      psql('postgres', `drop database if exists ${suite.db}; create database ${suite.db};`);
      for (const file of suite.files) {
        process.stdout.write(psql(suite.db, load(file)));
      }
      console.log(`PG_FOUR_OK ${suite.label}`);
    }
    console.log('PG_FOUR_SQL_OK');
  } finally {
    try { sh(docker, ['rm', '-f', name], { stdio: 'pipe' }); } catch { /* ignore */ }
  }
})();
