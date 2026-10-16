import { describe, expect, it } from 'vitest';
import { formatCloudQueryError, isMissingRelation, isUniqueViolation, postgrestErrorText, userFacingCloudError } from './postgrestError';

describe('postgrestError', () => {
  it('düz nesne hatasını [object Object] yapmaz', () => {
    const err = { code: 'PGRST202', message: 'Could not find the function public.push_student_data in the schema cache' };
    expect(postgrestErrorText(err)).toMatch(/PGRST202/);
    expect(postgrestErrorText(err)).toMatch(/push_student_data/);
    expect(isMissingRelation(err)).toBe(true);
    expect(formatCloudQueryError(err)).not.toMatch(/\[object Object\]/);
    expect(userFacingCloudError(err)).toBe('İşlem şu an tamamlanamadı.');
    expect(userFacingCloudError({ code: '42501', message: 'JWT expired fetchActiveCoaches' })).toBe('İşlem şu an tamamlanamadı.');
  });

  it('23505 çakışmayı idempotent sayar', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false);
  });
});
