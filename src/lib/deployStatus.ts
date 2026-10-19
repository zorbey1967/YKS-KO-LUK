/** Yerel taslak. Canlı katalog doğrulanmadan “uygulandı” yazılmaz. */
export type DraftFlag = 'local_draft' | 'unknown_live';

export const SQL_DRAFTS: { id: string; title: string; file: string; status: DraftFlag }[] = [
  { id: '027', title: 'E-posta ile yönetici atamayı kapatma', file: '027_live010_no_email_admin.sql', status: 'local_draft' },
  { id: '028', title: 'Koç listesi görünümü', file: '028_coach_directory_security_invoker.sql', status: 'local_draft' },
  { id: '029', title: 'Hesabı askıya alma', file: '029_account_suspend.sql', status: 'local_draft' },
  { id: '030', title: 'Platform sahibi, 14 günlük deneme, haftalık program, sınav analizi', file: '030_owner_trial_weekplan_exam.sql', status: 'local_draft' },
  { id: '031', title: 'Sınav tarama deposu', file: '031_exam_scans_storage.sql', status: 'local_draft' },
  { id: '032', title: 'Sahip dışındaki hesapları askıya alma', file: '032_disable_non_owner_accounts.sql', status: 'local_draft' },
  { id: '033', title: 'Randevu starts_at GRANT', file: '033_appointment_starts_at_grant.sql', status: 'local_draft' },
  { id: '034', title: 'Genel koç kartı', file: '034_coach_directory_public_cards.sql', status: 'local_draft' },
  { id: '035', title: 'Randevu satır silme yok', file: '035_appointments_no_client_delete.sql', status: 'local_draft' },
  { id: '036', title: 'Sahip Premium, oturum iptali, kayıt/AI denetim', file: '036_owner_meetings_security.sql', status: 'local_draft' },
  { id: '037', title: 'Sessiz kütüphane ve koç çalışma odası', file: '037_study_rooms.sql', status: 'local_draft' },
  { id: '038', title: 'Storage ingest kapısı, kayıt izni, AI kuyruk RPC', file: '038_storage_ingest_recording_gate.sql', status: 'local_draft' },
  { id: '039', title: 'Onaylı randevu iptal talebi (respond değişmez)', file: '039_approved_appointment_cancel.sql', status: 'local_draft' },
  { id: '040', title: 'Onaylı iptal denetimi ve yarış kilidi', file: '040_approved_cancel_audit.sql', status: 'local_draft' },
  { id: '055', title: 'Profil kilidi, kayıt bilgisi, yenileme/iade, doğrulamalı deneme', file: '055_commercial_readiness.sql', status: 'local_draft' },
];

export function draftStatusLabel(s: DraftFlag) {
  if (s === 'local_draft') return 'Yalnızca bu bilgisayarda taslak; canlıya işlenmedi';
  return 'Canlı durum bilinmiyor';
}
