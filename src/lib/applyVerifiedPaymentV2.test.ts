import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');

describe('054 apply_verified_payment v2', () => {
  const s = read('supabase/migrations/054_apply_verified_payment_v2.sql');

  it('043 ile aynı imza; anon/authenticated EXECUTE yok', () => {
    expect(s).toContain('create or replace function public.apply_verified_payment(');
    expect(s).toMatch(/p_user_id uuid,\s*p_plan_id text,\s*p_provider text,\s*p_payment_id text,\s*p_amount_try numeric,\s*p_checkout_id uuid default null,\s*p_subscription_id text default ''/);
    expect(s).toContain("set search_path to ''");
    expect(s).toContain('security definer');
    expect(s).toContain('revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated');
    expect(s).not.toMatch(/grant execute on function public\.apply_verified_payment/i);
    expect(s).not.toMatch(/apply_payment_refund/);
  });

  it('tekrar ödeme abonelik/profil/oturum yazmadan duplicate_payment döner', () => {
    const dupIdx = s.indexOf("if prev_status in ('succeeded', 'refunded') then");
    const returnIdx = s.indexOf("'duplicate_payment', true", dupIdx);
    const upsertIdx = s.indexOf('insert into public.billing_subscriptions');
    const profileIdx = s.indexOf('update public.profiles');
    expect(dupIdx).toBeGreaterThan(0);
    expect(returnIdx).toBeGreaterThan(dupIdx);
    expect(returnIdx).toBeLessThan(upsertIdx);
    expect(returnIdx).toBeLessThan(profileIdx);
    const dupBlock = s.slice(dupIdx, returnIdx);
    expect(dupBlock).not.toMatch(/update public\.(billing_subscriptions|profiles|billing_checkout_sessions)/);
  });

  it('aynı plan aktifse kalan gün korunur; farklı plan now + 30 gün', () => {
    expect(s).toContain("ends := greatest(cur_end, now_ts) + interval '30 days';");
    expect(s).toMatch(/cur_status = 'active'\s+and cur_plan = p_plan_id/);
    expect(s).toContain("ends := now_ts + interval '30 days';");
  });

  it('daha eski oturumdan gelen ödeme daha yeni aktif planı düşürmez', () => {
    expect(s).toContain('chk_created < cur_created');
    const lateIdx = s.indexOf("'late_payment', true");
    expect(lateIdx).toBeGreaterThan(0);
    expect(lateIdx).toBeLessThan(s.indexOf('insert into public.billing_subscriptions'));
  });

  it('043 dosyası değişmeden kalır', () => {
    const old = read('supabase/migrations/043_apply_verified_payment.sql');
    expect(old).not.toContain('late_payment');
    expect(old).toContain("ends := pg_catalog.clock_timestamp() + interval '30 days';");
  });
});

describe('Shopier iade kararı', () => {
  const wh = read('supabase/functions/billing-webhook/index.ts');

  it('iade yeniden çekilen siparişin tamamlanmış iadesinden; başlık tek başına refunded yapmaz', () => {
    expect(wh).toContain('const refundedTotal = shopierRefundedTotal(order);');
    const refundIdx = wh.indexOf('if (refundedTotal > 0.009) {');
    const applyIdx = wh.indexOf('applyPaymentRefund(admin', refundIdx);
    const headerIdx = wh.indexOf('if (/refund/i.test(eventName)) {');
    expect(refundIdx).toBeGreaterThan(0);
    expect(applyIdx).toBeGreaterThan(refundIdx);
    expect(headerIdx).toBeGreaterThan(applyIdx);
    const headerBlock = wh.slice(headerIdx, wh.indexOf('}', headerIdx));
    expect(headerBlock).not.toContain('applyPaymentRefund');
    expect(headerBlock).toContain('iade_tamamlanmadi');
    expect(wh.match(/applyPaymentRefund\(admin/g)).toHaveLength(1);
    expect(wh).not.toContain('markPaymentRefunded');
  });

  it('gecikmiş ödeme inceleme olayı yazar', () => {
    expect(wh).toContain('applied.latePayment');
    expect(wh).toContain('late_payment_review');
  });
});
