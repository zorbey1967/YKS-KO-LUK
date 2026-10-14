/** Çalışmayan kayıt/AI parçaları. Kod var diye tamamlanmış sayılmaz. */

export const RECORDING_GAPS = [
  'livekit_egress_start_stop',
  'livekit_egress_credentials',
  'meeting_rooms.recording_enabled_check_false',
  'meeting-token_rejects_recording',
  'consent_rpc_without_pipeline',
  'age_verification',
  'transcript_worker',
  'meeting-recording-ingest_503',
  'meeting-ai-review_no_evidence',
  'admin_alert_from_real_recording',
] as const;

export function recordingPipelineComplete() {
  return false;
}

export function recordingMayStartIfGapsRemain() {
  return false;
}

/** Sıra: izin → yaş → LiveKit Egress → depo sniff → AI kuyruk. Hiçbiri tek başına tamamlanmış sayılmaz. */
export const RECORDING_PLAN = [
  '1. Hukuki bilgilendirme + iki taraf consent RPC; yaş belirsizse kayıt kapalı.',
  '2. meeting_rooms recording_enabled check kaldırmadan önce LiveKit Egress (ücretli) ve secret env.',
  '3. meeting-token recorder grant yalnız Egress identity; katılımcı recorder:false kalır.',
  '4. meeting-recording-ingest sniff + meeting-recordings kova; süreli imza; saklama/purge.',
  '5. Transkript worker; yoksa AI queued→failed, hesap kapatılmaz.',
  '6. meeting-ai-review kanıt referansı + belirsizlik; yüksek risk admin_security_alerts; autoCloseFromAi=false.',
  '7. Sessiz kütüphane/koç odasında otomatik kayıt yok.',
] as const;
