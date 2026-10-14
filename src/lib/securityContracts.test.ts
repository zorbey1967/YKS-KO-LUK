import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { examScanPathOwned, EXAM_SCAN_HOUR_LIMIT, EXAM_SCAN_MAX_BYTES, takeQuotaSlot } from './examScanQuota';
import { canCoachWriteWeekPlan, canStudentWriteWeekPlan } from './weekPlanAuth';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
function sql(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('016 fatura kilidi 030’da korunur', () => {
  it('020/016 provider kolonları 030 freeze listesinde vardır', () => {
    const older = sql('supabase/migrations/016_billing_payments.sql');
    const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    for (const col of ['billing_provider', 'provider_customer_id', 'provider_subscription_id', 'trial_started_at', 'subscription_status']) {
      expect(older).toContain(`new.${col}`);
      expect(s).toContain(`new.${col}`);
    }
  });
});

describe('GUC ile üyelik aşımı yok', () => {
  const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
  it('yks.internal ve set_config yok; kilit current_user authenticated/anon', () => {
    expect(s).not.toContain("current_setting('yks.internal'");
    expect(s).not.toContain("set_config('yks.internal'");
    expect(s).toContain("if current_user in ('authenticated', 'anon') then");
    expect(s).toContain('new.trial_started_at := old.trial_started_at');
    expect(s).toContain('new.billing_provider := coalesce(old.billing_provider, \'\')');
    expect(s).toContain('new.provider_customer_id := coalesce(old.provider_customer_id, \'\')');
    expect(s).toContain('new.provider_subscription_id := coalesce(old.provider_subscription_id, \'\')');
    expect(s).toContain('revoke update on table public.profiles');
    const freezeGate = s.slice(s.indexOf('create or replace function public.protect_plan()'));
    expect(freezeGate).not.toMatch(/if auth\.role\(\) = 'authenticated'/);
  });
  it('start_top_plan_trial GUC kullanmadan DEFINER yazar; ikinci deneme trial_started_at IS NULL', () => {
    expect(s).toContain('security definer');
    expect(s).toContain('where id = uid and trial_started_at is null');
    expect(s).toContain("interval '14 days'");
    expect(s).toContain('caller_account_active');
    expect(s).toContain("prow is distinct from 'student'");
    expect(s).toContain('deneme yalnızca öğrenci hesabına özel');
  });
});

describe('e-posta admin vermez', () => {
  it('002/005 yükseltir; 027 kapatır; handle_new_user her zaman student', () => {
    expect(sql('supabase/migrations/002_platform_admin.sql')).toMatch(/yusufbesiroglu357@gmail\.com/);
    expect(sql('supabase/migrations/005_owner_admin.sql')).toMatch(/yusufbesiroglu357@gmail\.com/);
    const s = sql('supabase/migrations/027_live010_no_email_admin.sql');
    expect(s).not.toMatch(/lower\(coalesce\(new\.email/i);
    expect(s).toContain("'student'");
    expect(s).toContain("coalesce(new.raw_user_meta_data->>'name', '')");
  });
});

describe('askıya alınmış JWT korunan işlemleri keser', () => {
  it('029/030 RPC ve politikalar caller_account_active ister', () => {
    const a = sql('supabase/migrations/029_account_suspend.sql');
    const b = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    const ai = readFileSync(join(root, 'supabase/functions/student-ai/index.ts'), 'utf8');
    const scan = readFileSync(join(root, 'supabase/functions/exam-scan/index.ts'), 'utf8');
    const checkout = readFileSync(join(root, 'supabase/functions/billing-checkout/index.ts'), 'utf8');
    const meeting = readFileSync(join(root, 'supabase/functions/meeting-token/index.ts'), 'utf8');
    expect(a).toContain('student_data_own_select');
    expect(a).toContain('public.caller_account_active()');
    expect(a).toContain('appt_select');
    expect(a).toContain('request_appointment_unguarded');
    expect(a).toContain('require_caller_account_active');
    expect(a).toContain('matches_select');
    expect(b).toContain("raise exception 'hesap askıda'");
    expect(b).toContain('exam_reports_own');
    expect(ai).toContain('caller_account_active');
    expect(ai).toContain('Hesap askıda');
    expect(scan).toContain('take_exam_scan_slot');
    expect(scan).toContain('caller_account_active');
    expect(checkout).toContain('caller_account_active');
    expect(meeting).toContain('caller_account_active');
  });
});

describe('Storage sahibi olmayan okuyamaz; verified_key istemci yazamaz', () => {
  it('031 klasör = auth.uid; koç storage yok; UPDATE politikası yok', () => {
    const s = sql('supabase/migrations/031_exam_scans_storage.sql');
    expect(s).toContain('public = false');
    expect(s).toContain('(storage.foldername(name))[1] = (select auth.uid()::text)');
    expect(s).toContain('exam_scans_insert_own');
    expect(s).toContain('exam_scans_select_own');
    expect(s).toContain('exam_scans_delete_own');
    expect(s).not.toMatch(/for update/i);
    expect(s).toContain('Koçlara Storage okuma verilmez');
    expect(s).toContain('8388608');
    expect(s).toContain("storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'pdf')");
    expect(s).toContain("image/jpeg");
    expect(s).toContain("application/pdf");
  });
  it('verified_key authenticated için false; istemci insert alanı göndermez', () => {
    const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    expect(s).toContain('new.verified_key := false');
    expect(s).toContain("if current_user in ('authenticated', 'anon') then");
    const client = readFileSync(join(root, 'src/lib/cloudPlatform.ts'), 'utf8');
    expect(client).not.toMatch(/verified_key:\s*row\.verifiedKey/);
  });
  it('yol sahipliği başka uid’yi reddeder', () => {
    expect(examScanPathOwned('aaa', 'aaa/file.jpg')).toBe(true);
    expect(examScanPathOwned('aaa', 'bbb/file.jpg')).toBe(false);
    expect(examScanPathOwned('aaa', 'aaa/../bbb/x')).toBe(false);
    expect(examScanPathOwned('aaa', 'aaa/file.exe')).toBe(false);
  });
});

describe('rate limit eşzamanlı aşılmaz', () => {
  it('paylaşılan sayaç 8 sınırını geçmez', async () => {
    const store = new Map<string, number>();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => Promise.resolve(takeQuotaSlot(store, 'u1', EXAM_SCAN_HOUR_LIMIT))),
    );
    expect(results.filter(Boolean)).toHaveLength(8);
    expect(store.get('u1')).toBe(8);
    expect(EXAM_SCAN_MAX_BYTES).toBe(8 * 1024 * 1024);
  });
  it('030 take_exam_scan_slot n < 8 atomik artırım', () => {
    const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    expect(s).toContain('where public.exam_scan_quota.n < 8');
    expect(s).toContain("raise exception 'analiz kotası doldu'");
  });
});

describe('haftalık program yetkisi', () => {
  it('geçmiş randevu pasif koça yazma vermez', () => {
    expect(canCoachWriteWeekPlan({
      coachAccountActive: true,
      coachRowStatus: 'pasif',
      matchStatus: 'active',
      hasPastAppointment: true,
    })).toBe(false);
    expect(canCoachWriteWeekPlan({
      coachAccountActive: true,
      coachRowStatus: 'active',
      matchStatus: 'ended',
      hasPastAppointment: true,
    })).toBe(false);
    expect(canCoachWriteWeekPlan({
      coachAccountActive: true,
      coachRowStatus: 'active',
      matchStatus: 'active',
      hasPastAppointment: false,
    })).toBe(true);
  });
  it('öğrenci yalnızca aktif koç yokken yazar; SQL randevuya bakmaz', () => {
    expect(canStudentWriteWeekPlan(true)).toBe(false);
    expect(canStudentWriteWeekPlan(false)).toBe(true);
    const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
    expect(s).not.toMatch(/a\.status in \('onay', 'tamamlandi'\)/);
    expect(s).toContain('own_active_coach_id');
    expect(s).toContain('aktif koçun varken planı sen değiştiremezsin');
  });
});

describe('platform sahibi ve boş tablo; deneme bir kez', () => {
  const s = sql('supabase/migrations/030_owner_trial_weekplan_exam.sql');
  it('boş platform_owner fail-closed; e-posta yok; SELECT grant yok', () => {
    expect(s).toContain('create table if not exists public.platform_owner');
    expect(s).toContain('revoke all on table public.platform_owner from public, anon, authenticated');
    expect(s).toContain('o.user_id = auth.uid()');
    expect(s).not.toMatch(/insert into public\.platform_owner/);
    expect(s.toLowerCase()).not.toContain('@gmail.com');
  });
  it('deneme ikinci kez trial_started_at doluysa yazmaz', () => {
    expect(s).toContain('if started is not null then');
    expect(s).toContain('Bu hesap denemeyi kullandı.');
    expect(s).toContain('and trial_started_at is null');
  });
});
