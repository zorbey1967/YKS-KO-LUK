import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, acc: string[] = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.(ts|tsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

describe('service_role istemciye sızmaz', () => {
  it('src içinde SERVICE_ROLE / VITE secret yok; exam-upload Deno env kullanır', () => {
    const files = walk(join(root, 'src'));
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/VITE_SUPABASE_SERVICE/);
      expect(s, f).not.toMatch(/SERVICE_ROLE_KEY/);
      expect(s, f).not.toMatch(/sb_secret_/);
    }
    const envDts = readFileSync(join(root, 'src/vite-env.d.ts'), 'utf8');
    expect(envDts).toContain('VITE_SUPABASE_ANON_KEY');
    expect(envDts).not.toContain('SERVICE_ROLE');
    const upload = readFileSync(join(root, 'src/lib/cloudPlatform.ts'), 'utf8');
    expect(upload).toContain("functions.invoke('exam-upload'");
    expect(upload).not.toContain('storage.from(\'exam-scans\').upload');
    const edge = readFileSync(join(root, 'supabase/functions/exam-upload/index.ts'), 'utf8');
    expect(edge).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(edge).toContain('sniffExamMime');
  });
});
