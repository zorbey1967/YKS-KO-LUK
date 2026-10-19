import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { denemeSubjectRows, examResultMode } from './examResultEntry';
import { getStudentEducationContext } from './studentEducation';
import { emptyData } from './types';

describe('LGS sinav sonucu TYT ye cevrilmez', () => {
  it('examResultMode ve ders satirlari LGS', () => {
    expect(examResultMode('LGS Deneme')).toBe('lgs');
    const ctx = getStudentEducationContext({ ...emptyData(), grade: '8. Sınıf' });
    const rows = denemeSubjectRows(ctx, 'LGS');
    expect(rows).toContain('Türkçe');
    expect(rows).toContain('Fen');
    expect(rows).not.toContain('Sosyal');
  });

  it('ExamResultModal LGS için kindLocked; TYT fallback yok', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/ExamResultModal.tsx'), 'utf8');
    expect(src).toContain("resultMode === 'lgs'");
    expect(src).toContain('kindLocked');
    expect(src).toContain("denemeBandLabel");
    expect(src).not.toMatch(/effectiveKind = written[\s\S]*'TYT'/);
  });
});
