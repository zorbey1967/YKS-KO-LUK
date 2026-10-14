import { describe, expect, it } from 'vitest';
import {
  clientExamReportRow,
  examScanFileError,
  EXAM_SCAN_HOUR_LIMIT,
  EXAM_SCAN_MAX_BYTES,
  takeQuotaSlotRow,
} from './examScanQuota';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0]);

describe('exam-scan dosya ve kota', () => {
  it('JPEG/PDF sihirli bayt ve 8 MB sınırı kova ile aynı', () => {
    expect(EXAM_SCAN_MAX_BYTES).toBe(8388608);
    expect(examScanFileError('image/jpeg', jpeg)).toBe('');
    expect(examScanFileError('application/pdf', pdf)).toBe('');
    expect(examScanFileError('application/pdf', jpeg)).toMatch(/PDF/);
    expect(examScanFileError('image/jpeg', pdf)).toMatch(/uyuşmuyor/);
  });

  it('verified_key istemci satırında false kalır', () => {
    expect(clientExamReportRow({ exam_name: 'x', verified_key: true }).verified_key).toBe(false);
  });

  it('eşzamanlı n < 8 atomik model aşılamaz', () => {
    const row = { n: 0 };
    const ok = Array.from({ length: 20 }, () => takeQuotaSlotRow(row, EXAM_SCAN_HOUR_LIMIT) != null);
    expect(ok.filter(Boolean)).toHaveLength(8);
    expect(row.n).toBe(8);
    expect(takeQuotaSlotRow(row, EXAM_SCAN_HOUR_LIMIT)).toBeNull();
  });
});
