import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoCloseFromAi,
  canViewRecording,
  partySafeAnalysis,
  recordingMayStart,
  recordingUploadError,
} from './meetingRecordings';
import { RECORDING_GAPS, RECORDING_PLAN, recordingPipelineComplete } from './meetingRecordingGaps';

const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
const junk = new TextEncoder().encode('not-a-video-file!!!!');

describe('görüşme kaydı erişim ve imza', () => {
  it('öğrenci başkasının kaydını, koç başka koçun kaydını açamaz; yönetici açar', () => {
    expect(canViewRecording({ viewerId: 's1', studentId: 's1', coachUserId: 'c1', isAdmin: false })).toBe(true);
    expect(canViewRecording({ viewerId: 's2', studentId: 's1', coachUserId: 'c1', isAdmin: false })).toBe(false);
    expect(canViewRecording({ viewerId: 'c1', studentId: 's1', coachUserId: 'c1', isAdmin: false })).toBe(true);
    expect(canViewRecording({ viewerId: 'c2', studentId: 's1', coachUserId: 'c1', isAdmin: false })).toBe(false);
    expect(canViewRecording({ viewerId: 's2', studentId: 's1', coachUserId: 'c1', isAdmin: true })).toBe(true);
  });

  it('öğrenciye yönetici notu yok; AI tek başına hesap kapatmaz', () => {
    expect(partySafeAnalysis({ analysis_status: 'done', under_admin_review: true })).toEqual({
      analysisStatus: 'done',
      underAdminReview: true,
    });
    expect(autoCloseFromAi('high')).toBe(false);
    expect(recordingPipelineComplete()).toBe(false);
    expect(RECORDING_GAPS).toContain('livekit_egress_start_stop');
    expect(RECORDING_GAPS).toContain('age_verification');
    expect(RECORDING_PLAN[0]).toMatch(/yaş/);
    expect(recordingMayStart({
      consentStudent: true, consentCoach: true, pipelineReady: false, ageUnverified: false,
    })).toBe(false);
    expect(recordingMayStart({
      consentStudent: true, consentCoach: true, pipelineReady: true, ageUnverified: true,
    })).toBe(false);
    expect(recordingMayStart({
      consentStudent: true, consentCoach: true, pipelineReady: true, ageUnverified: false,
    })).toBe(true);
  });

  it('sahte MIME ve yanlış imzayı reddeder', () => {
    expect(recordingUploadError('video/webm', webm)).toBe('');
    expect(recordingUploadError('video/webm', junk)).toMatch(/imza/);
    expect(recordingUploadError('audio/mpeg', webm)).toMatch(/uyuşmuyor/);
  });

  it('036 dizin test koçu gizler; oturum iptali sahip kapılı; silme yok', () => {
    const s = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations/036_owner_meetings_security.sql'), 'utf8');
    expect(s).toContain("coalesce(c.is_test, false) = false");
    expect(s).toContain('revoke_non_owner_sessions');
    expect(s).toContain('grant_owner_premium_entitlement');
    expect(s).toContain("plan = 'premium'");
    expect(s).toContain('delete from auth.sessions');
    expect(s.toLowerCase()).not.toMatch(/delete from public\.(profiles|appointments|meeting_rooms)/);
    expect(s).toContain('admin_security_inbox');
    expect(s).toContain('my_meeting_ai_status');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });
});
