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
});
