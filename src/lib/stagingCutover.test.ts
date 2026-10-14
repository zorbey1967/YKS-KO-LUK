import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('staging-cutover canlı hedefi reddeder', () => {
  it('--apply canlı project ref ile çıkış kodu 1', () => {
    const r = spawnSync(process.execPath, [join(root, 'scripts/staging-cutover.mjs'), '--apply'], {
      encoding: 'utf8',
      cwd: root,
      env: {
        ...process.env,
        YKS_STAGING_PROJECT_REF: 'naiakscryafhvcghjmzx',
        STAGING_CONFIRM: 'I_UNDERSTAND_STAGING',
      },
    });
    expect(r.status).toBe(1);
    expect(`${r.stdout || ''}${r.stderr || ''}`).toMatch(/STAGING_REF_IS_LIVE|STAGING_REFUSED/);
  });
});
