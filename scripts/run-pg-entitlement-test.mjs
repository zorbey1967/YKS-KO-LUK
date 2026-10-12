/**
 * Throwaway Docker Postgres. Üretim URL yok.
 * docker + postgres:16 gerekir. Host psql gerekmez.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'yks-pg-entitlement-test';
const files = [
  join(root, 'supabase/tests/020_local_pg_bootstrap.sql'),
  join(root, 'supabase/migrations/020_appointment_entitlement_caller_only.sql'),
  join(root, 'supabase/tests/020_entitlement_pg.sql'),
  join(root, 'supabase/migrations/021_billing_events_after_020.sql'),
  join(root, 'supabase/migrations/016_billing_payments.sql'),
  join(root, 'supabase/tests/016_billing_idempotency_pg.sql'),
  join(root, 'supabase/migrations/022_apply_verified_payment_atomic.sql'),
  join(root, 'supabase/tests/022_atomic_payment_pg.sql'),
  join(root, 'supabase/migrations/023_protect_role_no_email_admin.sql'),
  join(root, 'supabase/tests/023_protect_role_pg.sql'),
  join(root, 'supabase/migrations/024_student_data_session_idempotent.sql'),
  join(root, 'supabase/tests/024_student_data_idempotent_pg.sql'),
  join(root, 'supabase/migrations/025_student_data_rev_coach_brief.sql'),
  join(root, 'supabase/tests/025_sync_coach_pg.sql'),
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
      throw new Error('docker CLI bulunamadı (PATH veya Docker Desktop).');
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

await (async () => {
try {
  try {
    sh(docker, ['rm', '-f', name], { stdio: 'pipe' });
  } catch {
    /* yok */
  }
  sh(docker, [
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=test',
    '-e', 'POSTGRES_DB=yks_test',
    'postgres:16-alpine',
  ]);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      sh(docker, ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'yks_test']);
      ready = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  if (!ready) throw new Error('Postgres hazır olmadı');
  for (const file of files) {
    const out = psql(readFileSync(file, 'utf8'));
    process.stdout.write(out);
  }
  const concUid = '99999999-9999-4999-8999-999999999999';
  const concChk = '99999999-9999-4999-8999-999999999990';
  psql(`
    insert into auth.users (id, email_confirmed_at) values ('${concUid}', now())
      on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
    insert into public.profiles (id, role, account_status, plan)
      values ('${concUid}', 'student', 'active', 'Ücretsiz')
      on conflict (id) do update set role = 'student', account_status = 'active';
    insert into public.billing_checkout_sessions (id, user_id, plan_id, amount_try, currency, status)
      values ('${concChk}', '${concUid}', 'pro', 100, 'TRY', 'pending')
      on conflict (id) do nothing;
  `);
  const same = `select public.apply_verified_payment('${concUid}'::uuid, 'pro', 'iyzico', 'pay_c_same', 100, '${concChk}'::uuid, '');`;
  await Promise.all([psqlAsync(same), psqlAsync(same)]);
  const sameN = psql(`select count(*)::text from public.billing_payments where provider_payment_id = 'pay_c_same';`);
  if (!/\b1\b/.test(sameN)) throw new Error(`eşzamanlı aynı id 1 satır olmalı: ${sameN}`);
  const d1 = `select public.apply_verified_payment('${concUid}'::uuid, 'pro', 'iyzico', 'pay_c_a', 100, '${concChk}'::uuid, '');`;
  const d2 = `select public.apply_verified_payment('${concUid}'::uuid, 'pro', 'iyzico', 'pay_c_b', 100, '${concChk}'::uuid, '');`;
  await Promise.all([psqlAsync(d1), psqlAsync(d2)]);
  const diffN = psql(`select count(*)::text from public.billing_payments where provider_payment_id in ('pay_c_a', 'pay_c_b');`);
  if (!/\b2\b/.test(diffN)) throw new Error(`eşzamanlı farklı id 2 satır olmalı: ${diffN}`);
  console.log('PG_ENTITLEMENT_TEST_OK');
  console.log('PG_BILLING_IDEMPOTENCY_OK');
  console.log('PG_ATOMIC_PAYMENT_OK');
  console.log('PG_CONCURRENT_PAYMENT_OK');
  console.log('PG_PROTECT_ROLE_OK');
} finally {
  try {
    sh(docker, ['rm', '-f', name], { stdio: 'pipe' });
  } catch {
    /* ignore */
  }
}
})();
