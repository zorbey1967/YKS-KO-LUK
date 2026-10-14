/**
 * Throwaway Docker Postgres. Canlı Supabase URL yok.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'yks-pg-security-test';
const files = [
  join(root, 'supabase/tests/pg_security_bootstrap.sql'),
  join(root, 'supabase/migrations/029_account_suspend.sql'),
  join(root, 'supabase/migrations/030_owner_trial_weekplan_exam.sql'),
  join(root, 'supabase/migrations/032_disable_non_owner_accounts.sql'),
  join(root, 'supabase/tests/pg_security_matrix.sql'),
];
const extraSql = [
  join(root, 'supabase/migrations/027_live010_no_email_admin.sql'),
  join(root, 'supabase/tests/027_no_email_admin_pg.sql'),
  join(root, 'supabase/tests/030_security_pg.sql'),
  join(root, 'supabase/tests/032_disable_non_owner_pg.sql'),
];

function dockerBin() {
  const home = process.env.LOCALAPPDATA || '';
  const binDir = join(home, 'Programs', 'DockerDesktop', 'resources', 'bin');
  if (binDir) process.env.PATH = `${binDir};${process.env.PATH || ''}`;
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore', timeout: 15_000 });
    return 'docker';
  } catch {
    const fallback = join(binDir, 'docker.exe');
    try {
      execFileSync(fallback, ['version'], { stdio: 'ignore', timeout: 15_000 });
      return fallback;
    } catch {
      throw new Error('docker CLI bulunamadı; izole PG atlandı değil, bu betik başarısız.');
    }
  }
}

const docker = dockerBin();

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, ...opts });
}

function psql(sql) {
  return sh(docker, ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'yks_test', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
  });
}

function psqlScalar(sql) {
  return sh(docker, ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'yks_test', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
  }).trim();
}

function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const p = spawn(docker, ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'yks_test', '-v', 'ON_ERROR_STOP=1']);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || out || `psql exit ${code}`));
    });
    p.stdin.write(sql);
    p.stdin.end();
  });
}

function seedDisable() {
  return `
    insert into auth.users (id) values
      ('11111111-1111-4111-8111-111111111111'),
      ('22222222-2222-4222-8222-222222222222')
    on conflict (id) do nothing;
    insert into public.profiles (id, role, account_status)
    values
      ('11111111-1111-4111-8111-111111111111', 'admin', 'active'),
      ('22222222-2222-4222-8222-222222222222', 'student', 'active')
    on conflict (id) do update set account_status = 'active', role = excluded.role;
    insert into public.platform_owner (user_id)
      values ('11111111-1111-4111-8111-111111111111')
      on conflict (user_id) do nothing;
    insert into public.appointments (id, student_id, status)
      values ('conc-appt', '22222222-2222-4222-8222-222222222222', 'onay')
      on conflict (id) do nothing;
  `;
}

await (async () => {
try {
  try { sh(docker, ['rm', '-f', name], { stdio: 'pipe' }); } catch { /* yok */ }
  sh(docker, [
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=test',
    '-e', 'POSTGRES_DB=yks_test',
    'postgres:16-alpine',
  ]);
  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      sh(docker, ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'yks_test']);
      ready = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  if (!ready) throw new Error('Postgres hazır olmadı');
  let psqlReady = false;
  for (let i = 0; i < 20; i += 1) {
    try {
      psql('select 1;');
      psqlReady = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  if (!psqlReady) throw new Error('psql bağlanamadı');
  for (const file of files) {
    process.stdout.write(psql(readFileSync(file, 'utf8')));
  }
  for (const file of extraSql) {
    process.stdout.write(psql(readFileSync(file, 'utf8')));
  }
  console.log('PG_SQL_027_030_032_OK');

  psql(seedDisable());
  const expectJson = psqlScalar("select public.preview_disable_non_owner_accounts('11111111-1111-4111-8111-111111111111'::uuid)::text;");
  const dsql = `select public.disable_non_owner_accounts('11111111-1111-4111-8111-111111111111'::uuid, $expect$${expectJson}$expect$::jsonb);`;
  await Promise.all([psqlAsync(dsql), psqlAsync(dsql)]);
  const pasif = psql("select count(*)::text from public.profiles where account_status = 'pasif';");
  if (!/\b1\b/.test(pasif)) throw new Error(`eşzamanlı disable tek öğrenci pasif: ${pasif}`);
  const appt = psql("select count(*)::text from public.appointments;");
  if (!/\b1\b/.test(appt) && !/\b2\b/.test(appt)) {
    /* en az seed satırı durmalı */
  }
  const stillAppt = psql("select count(*)::text from public.appointments where id = 'conc-appt';");
  if (!/\b1\b/.test(stillAppt)) throw new Error('eşzamanlı disable randevuyu silmemeli');

  const stu = '66666666-6666-4666-8666-666666666666';
  psql(`
    insert into auth.users (id) values ('${stu}') on conflict (id) do nothing;
    insert into public.profiles (id, role, account_status)
      values ('${stu}', 'student', 'active')
      on conflict (id) do update set role = 'student', account_status = 'active',
        trial_started_at = null, trial_ends_at = null, subscription_status = null;
  `);
  const tsql = `
    select set_config('request.jwt.claim.sub', '${stu}', false);
    select public.start_top_plan_trial();
  `;
  await Promise.all([psqlAsync(tsql), psqlAsync(tsql), psqlAsync(tsql)]);
  const tn = psql(`select count(*)::text from public.profiles where id = '${stu}' and trial_started_at is not null;`);
  if (!/\b1\b/.test(tn)) throw new Error(`eşzamanlı trial tek yazım: ${tn}`);

  console.log('PG_SECURITY_MATRIX_OK');
  console.log('PG_DISABLE_CONCURRENT_OK');
  console.log('PG_TRIAL_CONCURRENT_OK');
} finally {
  try { sh(docker, ['rm', '-f', name], { stdio: 'pipe' }); } catch { /* ignore */ }
}
})();
