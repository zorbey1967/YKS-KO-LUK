import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mig = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');

function sql(name: string) {
  return readFileSync(join(mig, name), 'utf8');
}

describe('migration hedef şema (020 sonra 021+016; 013/017 atlanır)', () => {
  it('013 authenticated student_entitled verir ve account_status = p_status yazar', () => {
    const s = sql('013_billing_subscriptions.sql');
    expect(s).toContain('grant execute on function public.student_entitled(uuid) to authenticated');
    expect(s).toMatch(/if r\.subscription_status is null then\s+return true/i);
    expect(s).toContain('account_status = p_status');
  });

  it('017 e-posta kapısı ekler ama account_status = p_status bırakır (002 CHECK riski)', () => {
    const s = sql('017_billing_trial_email.sql');
    expect(s).toContain('e-posta doğrulanmamış');
    expect(s).toContain('account_status = p_status');
  });

  it('018 fail-closed ama authenticated EXECUTE bırakır; 019 REVOKE eder', () => {
    expect(sql('018_student_entitled_fail_closed.sql')).toContain(
      'grant execute on function public.student_entitled(uuid) to authenticated',
    );
    expect(sql('019_student_entitled_caller_only.sql')).toContain(
      'revoke all on function public.student_entitled(uuid) from public, anon, authenticated',
    );
  });

  it('016 auth.users FK ve payments unique; webhook tek transaction değil', () => {
    const s = sql('016_billing_payments.sql');
    expect(s).toContain('references auth.users(id)');
    expect(s).toContain('unique (provider, provider_payment_id)');
    expect(s).not.toContain('currency text not null default \'TRY\' check');
  });

  it('020 002-uyumlu account_status ve oracle REVOKE; 021 is_admin anon kapatır', () => {
    const s = sql('020_appointment_entitlement_caller_only.sql');
    expect(s).toContain("when p_status = 'rejected' then 'pasif'");
    expect(s).toContain('revoke all on function public.student_entitled(uuid) from public, anon, authenticated');
    expect(sql('021_billing_events_after_020.sql')).toContain('revoke all on function public.is_admin() from public, anon');
    expect(sql('021_billing_events_after_020.sql')).not.toContain('create or replace function public.student_entitled');
  });

  it('023 e-posta ile admin yapmaz', () => {
    const s = sql('023_protect_role_no_email_admin.sql');
    expect(s.toLowerCase()).not.toContain('yusufbesiroglu357@gmail.com');
    expect(s).toContain("if new.role = 'admin' then");
    expect(s).toContain('revoke all on function public.is_admin() from public, anon');
  });

  it('025 rev OCC ve koç özeti yetkili öğrenciye', () => {
    const s = sql('025_student_data_rev_coach_brief.sql');
    expect(s).toContain('push_student_data');
    expect(s).toContain('p_expected_rev');
    expect(s).toContain('coach_student_brief');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s).toContain('grant execute on function public.push_student_data');
  });

  it('024 oturum id tekilleştirir; production notu taşır', () => {
    const s = sql('024_student_data_session_idempotent.sql');
    expect(s).toContain('canonicalize_student_json');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s).toContain('auth.uid() = user_id');
  });

  it('022 tek transaction RPC; authenticated EXECUTE yok', () => {
    const s = sql('022_apply_verified_payment_atomic.sql');
    expect(s).toContain('on conflict (provider, provider_payment_id) do nothing');
    expect(s).toContain('revoke all on function public.apply_verified_payment');
    expect(s).not.toContain('grant execute on function public.apply_verified_payment');
  });

  it('026 Shopier ürün eşlemesi taslak; production notu taşır', () => {
    const s = sql('026_shopier_product_map.sql');
    expect(s).toContain('PRODUCTION');
    expect(s).toContain('billing_checkout_shopier_product_uidx');
    expect(s).toContain("provider = 'shopier'");
  });

  it('027 010 şemasında e-posta admin ve anon RPC kapatır; 023 dosyasını değiştirmez', () => {
    const s = sql('027_live010_no_email_admin.sql');
    expect(s).toContain('handle_new_user');
    expect(s).toContain('revoke all on function public.handle_new_user() from public, anon, authenticated');
    expect(s).toContain('001–010');
    expect(sql('023_protect_role_no_email_admin.sql')).toContain('revoke all on function public.is_admin() from public, anon');
  });

  it('028 coach_directory security_invoker ayrı dosyadır', () => {
    expect(sql('028_coach_directory_security_invoker.sql')).toContain('security_invoker = true');
  });

  it('030 sahip/deneme/program taslağı e-posta gömmez; 027–029 ayrı kalır', () => {
    const s = sql('030_owner_trial_weekplan_exam.sql');
    expect(s).toContain('is_platform_owner');
    expect(s).toContain('start_top_plan_trial');
    expect(s).toContain('deneme yalnızca öğrenci hesabına özel');
    expect(s).toContain('upsert_student_week_plan');
    expect(s).not.toContain("current_setting('yks.internal'");
    expect(s).not.toContain("set_config('yks.internal'");
    expect(s).toContain("current_user in ('authenticated', 'anon')");
    expect(s).toContain('take_exam_scan_slot');
    expect(s).toContain('protect_exam_report');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s.toLowerCase()).not.toContain('yusufbesiroglu357@gmail.com');
    expect(sql('027_live010_no_email_admin.sql')).toContain('handle_new_user');
  });

  it('032 boş sahipte no-op; silme yok; dizin aktif profil ister', () => {
    const s = sql('032_disable_non_owner_accounts.sql');
    expect(s).toContain('platform_owner boş');
    expect(s).toContain('disable_non_owner_accounts');
    expect(s).toContain('preview_disable_non_owner_accounts');
    expect(s).toContain('owner_uuid_confirmed');
    expect(s).toContain('owner_confirm_reason');
    expect(s).toContain('aktif sahip profili yok');
    expect(s).toContain('p_confirm_owner');
    expect(s).toContain('total_profiles');
    expect(s).toContain('meeting_count');
    expect(s).toContain('payment_count');
    expect(s).toContain('disable_counts_match');
    expect(s).toContain('p_expect');
    expect(s).toContain('pg_advisory_xact_lock');
    expect(s).toContain('randevu sayısı değişti');
    expect(s).toContain('keep_ids_for_disable');
    expect(s).toContain('Toplu kapatma otomatik çalışmaz');
    expect(s).toContain('appointments_preserved');
    expect(s).toContain("p.account_status = 'active'");
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s.toLowerCase()).not.toMatch(/delete from public\.(profiles|appointments|coaches)/);
    expect(s.toLowerCase()).not.toContain('yusufbesiroglu357@gmail.com');
  });

  it('040 iptal denetim tablosu; respond_appointment yok; silme yok', () => {
    const s = sql('040_approved_cancel_audit.sql');
    expect(s).toContain('appointment_cancel_events');
    expect(s).toContain('duplicate');
    expect(s).toContain('cancel_decision');
    expect(s).not.toContain('create or replace function public.respond_appointment');
    expect(s.toLowerCase()).not.toMatch(/delete from public\.appointments/);
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('039 onaylı iptal talebi; respond_appointment yok', () => {
    const s = sql('039_approved_appointment_cancel.sql');
    expect(s).toContain('request_cancel_approved_appointment');
    expect(s).toContain('decide_approved_appointment_cancel');
    expect(s).not.toContain('create or replace function public.respond_appointment');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('038 istemci Storage INSERT kapatır; kayıt hattı false; AI kapatma yok', () => {
    const s = sql('038_storage_ingest_recording_gate.sql');
    expect(s).toContain('drop policy if exists "exam_scans_insert_own"');
    expect(s).toContain('drop policy if exists "meet_rec_insert_own"');
    expect(s).toContain('meeting_recording_pipeline_ready');
    expect(s).toContain('enqueue_meeting_ai_review');
    expect(s).toContain('select false');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s.toLowerCase()).not.toMatch(/delete from public\.(profiles|appointments)/);
  });

  it('037 sessiz kütüphane heartbeat ve koç kick; e-posta yok', () => {
    const s = sql('037_study_rooms.sql');
    expect(s).toContain('library_heartbeat');
    expect(s).toContain('coach_kick_student');
    expect(s).toContain("kind = 'library'");
    expect(s).toContain('share_exams');
    expect(s).not.toContain('email');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('036 sahip Premium, oturum iptali, test koç dizini, kayıt tabloları; silme yok', () => {
    const s = sql('036_owner_meetings_security.sql');
    expect(s).toContain('grant_owner_premium_entitlement');
    expect(s).toContain('revoke_non_owner_sessions');
    expect(s).toContain("plan = 'premium'");
    expect(s).toContain('is_test');
    expect(s).toContain('meeting_recordings');
    expect(s).toContain('meeting_ai_reviews');
    expect(s).toContain('admin_security_alerts');
    expect(s).toContain('admin_security_inbox');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s.toLowerCase()).not.toMatch(/delete from public\.(profiles|appointments)/);
  });

  it('035 randevu DELETE yalnız yönetici', () => {
    const s = sql('035_appointments_no_client_delete.sql');
    expect(s).toContain('for delete using (public.is_admin())');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('034 dizin genel karttır; definer fonksiyon search_path kilitli; email/score yok', () => {
    const s = sql('034_coach_directory_public_cards.sql');
    expect(s).toContain('coach_directory_cards');
    expect(s).toContain('security definer');
    expect(s).toContain("set search_path = ''");
    expect(s).toContain('security_invoker = true');
    expect(s).toContain('security_barrier = true');
    expect(s).toContain("c.status = 'active'");
    expect(s).toContain("p.account_status = 'active'");
    expect(s).not.toMatch(/c\.email|c\.score/);
    expect(s).not.toMatch(/returns table \([^)]*email/);
    expect(s).not.toMatch(/returns table \([^)]*user_id/);
    expect(s).toContain('revoke all on table public.coach_directory from public, anon, authenticated');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('033 appointment_starts_at authenticated GRANT; 004 REVOKE kalır', () => {
    expect(sql('004_meetings.sql')).toContain(
      'revoke all on function public.appointment_starts_at(date, text) from public, anon, authenticated',
    );
    expect(sql('033_appointment_starts_at_grant.sql')).toContain(
      'grant execute on function public.appointment_starts_at(date, text) to authenticated',
    );
    expect(sql('033_appointment_starts_at_grant.sql')).toContain('Production’a bu turda uygulanmaz');
  });

  it('031 özel exam-scans kovası; public false', () => {
    const s = sql('031_exam_scans_storage.sql');
    expect(s).toContain("public = false");
    expect(s).toContain('exam-scans');
    expect(s).toContain('exam_scans_insert_own');
    expect(s).toContain('exam_scans_select_own');
    expect(s).toContain('exam_scans_delete_own');
    expect(s).toContain('Production’a bu turda uygulanmaz');
  });

  it('029 askıya alma taslağı 027/028’i değiştirmeden gelir; silme yok', () => {
    const s = sql('029_account_suspend.sql');
    expect(s).toContain('admin_set_account_status');
    expect(s).toContain('son aktif yönetici askıya alınamaz');
    expect(s).toContain('kendi hesabını askıya alamazsın');
    expect(s).toContain('admin_account_events');
    expect(s).toContain('status_before_suspend');
    expect(s).toContain('platform sahibi askıya alınamaz');
    expect(s).toContain('appt_select');
    expect(s).toContain('request_appointment_unguarded');
    expect(s).toContain('require_caller_account_active');
    expect(s).toContain('Production’a bu turda uygulanmaz');
    expect(s).not.toContain('delete from public.profiles');
    expect(s).not.toContain('delete from auth.users');
    expect(sql('027_live010_no_email_admin.sql')).toContain('handle_new_user');
    expect(sql('028_coach_directory_security_invoker.sql')).toContain('security_invoker = true');
  });

  it('044 destek tabloları additive; zorro ve trial RPC yok', () => {
    const s = sql('044_support_tickets.sql');
    expect(s).toContain('create table if not exists public.support_tickets');
    expect(s).toContain('create table if not exists public.support_replies');
    expect(s).toContain('user_id = auth.uid() or public.is_admin()');
    expect(s).toContain('revoke all on table public.support_tickets from anon, public');
    expect(s).toContain('for update using (public.is_admin())');
    expect(s).not.toMatch(/drop table public/i);
    expect(s).not.toMatch(/delete from public/i);
    expect(s).not.toContain('zorro_conversations');
    expect(s).not.toContain('start_top_plan_trial');
  });

  it('045 destek FORCE RLS; politika user_id veya is_admin', () => {
    const s = sql('045_support_force_rls_isolation.sql');
    expect(s).toContain('force row level security');
    expect(s).toContain('support_tickets_select');
    expect(s).toContain('user_id = auth.uid() or public.is_admin()');
    expect(s).toContain('support_replies_select');
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toMatch(/delete from/i);
  });

  it('046 ders programı PDF koça; path öğrenci klasörü; RLS gevşetilmez', () => {
    const s = sql('046_schedule_pdf_to_coach.sql');
    expect(s).toContain('schedule_pdf_submissions');
    expect(s).toContain('schedule-pdfs');
    expect(s).toContain('coach_linked_to_student');
    expect(s).toContain('student_linked_coach_id');
    expect(s).toContain('force row level security');
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toMatch(/delete from public\./i);
  });

  it('049 destek sender_role; RLS gevşetilmez; DROP yok', () => {
    const s = sql('049_support_sender_role.sql');
    expect(s).toContain('sender_role');
    expect(s).toContain("check (sender_role in ('student', 'coach'))");
    expect(s).toContain('force row level security');
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toMatch(/drop policy/i);
  });

  it('047 koç programı PDF; öğrenci path izolasyonu; RLS gevşetilmez', () => {
    const s = sql('047_coach_program_pdfs.sql');
    expect(s).toContain('coach_program_pdfs');
    expect(s).toContain('coach-program-pdfs');
    expect(s).toContain('coach_linked_to_student');
    expect(s).toContain('force row level security');
    expect(s).toContain('storage.foldername(objects.name)');
    expect(s).not.toMatch(/drop table/i);
  });

  it('055 profil kilidi, e-postasız rol, kayıt bilgisi, yenileme/iade, doğrulamalı deneme', () => {
    const s = sql('055_commercial_readiness.sql');
    expect(s).toContain('drop policy if exists "profiles_own_upsert" on public.profiles');
    expect(s).toContain('revoke insert, update, delete, truncate on table public.profiles from public, anon, authenticated');
    expect(s).toContain("'name', 'target_department', 'target_rank', 'updated_at'");
    expect(s).not.toMatch(/@[a-z0-9.-]+\.(com|net|org)/i);
    expect(s).toContain('signup_grade');
    // Kalan gün korunur (yenileme ve paket değişimi); 054 kuralları da 055'te durur.
    expect(s).toContain("if cur_status = 'active' and cur_end is not null and cur_end > now_ts then");
    expect(s).toContain("ends := base + interval '30 days'");
    expect(s).toContain("if prev_status in ('succeeded', 'refunded') then");
    expect(s).toContain("'duplicate_payment', true");
    expect(s).toContain('chk_created < cur_created');
    expect(s).toContain("'late_payment', true");
    // 053: istemci e-posta / rol / durum değiştiremez; 052: OAuth niyeti korunur.
    expect(s).toContain('new.email := old.email;');
    expect(s).toContain("when coalesce(public.profiles.signup_intent, '') in ('', 'student')");
    expect(s).toContain('function public.apply_payment_refund(');
    expect(s).toContain('revoke all on function public.apply_payment_refund(text, text, numeric) from public, anon, authenticated');
    expect(s).toContain('revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated');
    expect(s).toContain('u.email_confirmed_at is not null');
    expect(s).toMatch(/set search_path = ''/);
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toMatch(/delete from public\./i);
    expect(s).not.toMatch(/set search_path = public/i);
  });

  it('048 storage foldername coaches.name gölgelemesi düzeltilir', () => {
    const s = sql('048_fix_storage_foldername_objects_name.sql');
    expect(s).toContain('storage.foldername(objects.name)');
    expect(s).toContain('coach-program-pdfs');
    expect(s).toContain('schedule-pdfs');
    expect(s).not.toMatch(/foldername\(name\)/);
  });

  it('050 içerik denetimi; RLS; sunucu taraması; yönetici otomatik askı yok', () => {
    const s = sql('050_content_moderation.sql');
    expect(s).toContain('moderation_violations');
    expect(s).toContain('force row level security');
    expect(s).toContain('record_moderation_violation');
    expect(s).toContain('admin_list_moderation_violations');
    expect(s).toContain('admin_review_moderation_violation');
    expect(s).toContain('moderation_target_is_admin');
    expect(s).toContain('scan_text_profanity');
    expect(s).toContain('p_text');
    expect(s).toContain('appeal_note');
    expect(s).toContain('ses ihlali yalnızca sunucu STT');
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toContain('VITE_SUPABASE_SERVICE');
  });

  it('051 STT olayları; service_role; istemci grant yok', () => {
    const s = sql('051_meeting_stt_moderation.sql');
    expect(s).toContain('moderation_stt_events');
    expect(s).toContain('service_record_voice_stt_violation');
    expect(s).toContain('appointment_user_is_party');
    expect(s).toContain('force row level security');
    expect(s).toContain('unique_violation');
    expect(s).not.toMatch(/drop table/i);
    expect(s).not.toContain('VITE_SUPABASE_SERVICE');
  });

  it('053 canlı hotfix: e-posta ile admin yok; istemci email/role kilitli', () => {
    const s = sql('053_live_hotfix_email_admin.sql');
    expect(s).not.toMatch(/yusufbesiroglu/i);
    expect(s).toContain('create or replace function public.protect_role()');
    expect(s).toContain('create or replace function public.handle_new_user()');
    expect(s).toContain('new.email := old.email;');
    expect(s).toContain('new.role := old.role;');
    expect(s).toContain('new.account_status := old.account_status;');
    expect(s).toMatch(/auth\.uid\(\) is not null and not public\.is_admin\(\) then\s+new\.role := 'student';/);
    expect(s).not.toMatch(/^\s*(update|delete|insert into public\.profiles\s+select)/im);
  });

  it('052 OAuth signup_intent; email admin yok; claim RPC', () => {
    const s = sql('052_oauth_signup_intent.sql');
    expect(s).toContain('claim_signup_prefs');
    expect(s).toContain('signup_intent');
    expect(s).toContain("intent not in ('student', 'coach')");
    expect(s).not.toMatch(/yusufbesiroglu/i);
    expect(s).not.toContain('VITE_SUPABASE_SERVICE');
  });
});
