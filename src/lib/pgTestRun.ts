import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LIVE = 'naiakscryafhvcghjmzx';

export function livePgUrlBlocked(url: string) {
  const s = String(url || '').toLowerCase();
  if (!s) return false;
  if (s.includes(LIVE)) return true;
  if (s.includes('supabase.co') && !s.includes('127.0.0.1') && !s.includes('localhost')) return true;
  try {
    const u = new URL(s.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'));
    if (u.hostname.endsWith('supabase.co')) return true;
  } catch {
    if (/db\.[a-z0-9]+\.supabase\.co/.test(s)) return true;
  }
  return false;
}

export function pgSqlAvailable() {
  return Boolean(String(process.env.YKS_PG_DOCKER || process.env.YKS_PG_TEST_URL || '').trim());
}

function dockerBin() {
  const home = process.env.LOCALAPPDATA || '';
  const fallback = `${home}\\Programs\\DockerDesktop\\resources\\bin\\docker.exe`;
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore', timeout: 8_000 });
    return 'docker';
  } catch {
    execFileSync(fallback, ['version'], { stdio: 'ignore', timeout: 8_000 });
    return fallback;
  }
}

/** Host psql veya throwaway Docker. Canlı URL reddedilir. Parola yazdırılmaz. */
export function runPgSqlFile(sqlFile: string) {
  const docker = String(process.env.YKS_PG_DOCKER || '').trim();
  const db = String(process.env.YKS_PG_DB || 'yks_test').trim() || 'yks_test';
  const url = String(process.env.YKS_PG_TEST_URL || '').trim();
  if (url && livePgUrlBlocked(url)) throw new Error('LIVE_PG_REFUSED');
  if (docker) {
    return execFileSync(dockerBin(), [
      'exec', '-i', docker, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1',
    ], {
      encoding: 'utf8',
      timeout: 30_000,
      input: readFileSync(sqlFile, 'utf8'),
    });
  }
  if (!url) throw new Error('YKS_PG_TEST_URL yok');
  return execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', sqlFile, url], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}
