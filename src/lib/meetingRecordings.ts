/** Kayıt erişimi ve AI inceleme. Otomatik hesap kapatma yok. */

export type RecordingStatus = 'pending' | 'recording' | 'uploaded' | 'failed' | 'purged';
export type AnalysisStatus = 'queued' | 'running' | 'done' | 'failed';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export function canViewRecording(input: {
  viewerId: string;
  studentId: string;
  coachUserId: string | null;
  isAdmin: boolean;
}) {
  if (input.isAdmin) return true;
  if (input.viewerId && input.viewerId === input.studentId) return true;
  if (input.coachUserId && input.viewerId === input.coachUserId) return true;
  return false;
}

export function partySafeAnalysis(row: {
  analysis_status: string;
  under_admin_review?: boolean;
}) {
  return {
    analysisStatus: row.analysis_status,
    underAdminReview: Boolean(row.under_admin_review),
  };
}

export function autoCloseFromAi(_risk: RiskLevel) {
  return false;
}

/** Reşit olmayan ihtimali veya LiveKit Egress yoksa kayıt başlamaz. */
export function recordingMayStart(input: {
  consentStudent: boolean;
  consentCoach: boolean;
  pipelineReady: boolean;
  ageUnverified: boolean;
}) {
  if (input.ageUnverified) return false;
  if (!input.pipelineReady) return false;
  return input.consentStudent && input.consentCoach;
}

export function sniffMeetingBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'video/mp4';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return null;
}

export function recordingUploadError(claimedMime: string, bytes: Uint8Array, maxBytes = 100 * 1024 * 1024) {
  if (!bytes.length) return 'Kayıt boş.';
  if (bytes.length > maxBytes) return 'Kayıt 100 MB’den küçük olsun.';
  const sniffed = sniffMeetingBytes(bytes);
  if (!sniffed) return 'Dosya imzası WebM/MP4/MPEG değil.';
  const mime = claimedMime.toLowerCase().split(';')[0].trim();
  if (mime && mime !== sniffed && !(sniffed === 'video/mp4' && mime === 'audio/mp4')) {
    return 'Dosya türü ile içerik uyuşmuyor.';
  }
  return '';
}
