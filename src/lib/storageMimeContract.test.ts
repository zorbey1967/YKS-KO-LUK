import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('exam-scans MIME: kova vs sniff', () => {
  it('kova allowed_mime listeler; sihirli bayt exam-scan’de', () => {
    const bucket = readFileSync(join(root, 'supabase/migrations/031_exam_scans_storage.sql'), 'utf8');
    const scan = readFileSync(join(root, 'supabase/functions/exam-scan/index.ts'), 'utf8');
    expect(bucket).toContain('allowed_mime_types');
    expect(bucket).toContain('8388608');
    expect(bucket).not.toContain('function sniffMime');
    expect(scan).toContain('function sniffMime');
    const gate = readFileSync(join(root, 'supabase/migrations/038_storage_ingest_recording_gate.sql'), 'utf8');
    expect(gate).toContain('drop policy if exists "exam_scans_insert_own"');
    expect(gate).toContain('drop policy if exists "meet_rec_insert_own"');
    expect(gate).toContain('meeting_recording_pipeline_ready');
    expect(gate).toContain('select false');
    expect(scan).toContain('MAX_BYTES = 8 * 1024 * 1024');
    expect(scan).toContain('Yalnızca JPEG, PNG, WebP veya PDF');
  });
});
