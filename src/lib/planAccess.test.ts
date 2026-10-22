import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLANS, FEATURE_CAPABILITY, type FeatureId } from './plans';
import { TIER_CAPABILITIES, tierCan } from './planAccess';
import { accessTier, canSeeAnalyticsPage, canUseAi, canUseAnalytics, canUseFeature, paidAccessLocked } from './subscription';
import {
  TIER_CAPABILITIES as EDGE_TIERS,
  accessTierFromBilling,
  premiumAiDecision,
} from '../../supabase/functions/_shared/planAccess.ts';
import type { Profile } from './types';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const now = Date.parse('2026-10-20T12:00:00.000Z');
const future = '2026-11-19T12:00:00.000Z';
const past = '2026-10-01T00:00:00.000Z';

const student = (p: Partial<Profile>): Profile => ({
  id: 'u1', name: 'Öğrenci', email: 'o@example.com', role: 'student', account_status: 'active',
  plan: 'Ücretsiz', subscription_status: 'none', trial_started_at: null, trial_ends_at: null, subscription_ends_at: null,
  ...p,
} as Profile);
const pro = student({ plan: 'pro', subscription_status: 'active', subscription_ends_at: future });
const premium = student({ plan: 'premium', subscription_status: 'active', subscription_ends_at: future });
const trial = student({ subscription_status: 'trialing', trial_started_at: past, trial_ends_at: future });
const free = student({});

const CORE: FeatureId[] = ['core_study', 'appointments'];
const AI: FeatureId[] = ['zorro_basic', 'zorro_advanced', 'ai_plan'];

describe('paket tablosu tek kaynak', () => {
  it('istemci ve edge aynı tabloyu kullanır', () => {
    expect(EDGE_TIERS).toEqual(TIER_CAPABILITIES);
  });
  it('Pro yalnız temel; deneme ve Premium temel + yapay zekâ + gelişmiş analiz (060)', () => {
    expect(TIER_CAPABILITIES.pro).toEqual(['core']);
    expect([...TIER_CAPABILITIES.trial].sort()).toEqual(['advanced_analytics', 'ai', 'core']);
    expect(TIER_CAPABILITIES.none).toEqual([]);
    expect([...TIER_CAPABILITIES.premium].sort()).toEqual(['advanced_analytics', 'ai', 'core']);
  });
  it('paket özellik listesi tablodan türer; Pro listesinde yapay zekâ özelliği yok', () => {
    for (const f of PLANS.pro.features) expect(tierCan('pro', FEATURE_CAPABILITY[f])).toBe(true);
    for (const f of PLANS.premium.features) expect(tierCan('premium', FEATURE_CAPABILITY[f])).toBe(true);
    expect(PLANS.pro.features.some((f) => FEATURE_CAPABILITY[f] !== 'core')).toBe(false);
    expect(PLANS.pro.bullets.join(' ')).not.toMatch(/zorro|yapay zek|analiz/i);
    expect(PLANS.premium.bullets.join(' ')).toMatch(/ZORRO/);
  });
  it('SQL (058) aynı katmanları ve yalnız premium/staff için yapay zekâ verir', () => {
    const sql = read('supabase/migrations/058_plan_access_premium_ai.sql');
    for (const t of ["'none'", "'trial'", "'pro'", "'premium'", "'staff'"]) expect(sql).toContain(t);
    expect(sql).toMatch(/caller_access_tier\(\) in \('premium', 'staff'\)/);
    expect(sql.replace(/--.*$/gm, '')).not.toMatch(/function public\.apply_verified_payment/);
    expect(sql).toMatch(/as restrictive for insert/);
  });
  it('SQL (060) yapay zekâyı aktif denemeye de açar; katman tablosu (058) değişmez', () => {
    const sql = read('supabase/migrations/060_trial_full_access.sql');
    expect(sql).toMatch(/caller_access_tier\(\) in \('premium', 'staff', 'trial'\)/);
    expect(sql).not.toMatch(/function public\.caller_access_tier/);
    const live = read('supabase/live/apply_060_061_live.sql');
    expect(live).toMatch(/caller_access_tier\(\) in \('premium', 'staff', 'trial'\)/);
    expect(live).toMatch(/^begin;/m);
    expect(live).toMatch(/^commit;/m);
    expect(live).toContain('CANLI_060_061_OK');
  });
});

describe('arayüz yetkisi (senaryolar 1–6)', () => {
  it('1) Pro temel özelliklere erişir', () => {
    for (const f of CORE) expect(canUseFeature(pro, f, now)).toBe(true);
    expect(paidAccessLocked(pro, now)).toBe(false);
    expect(accessTier(pro, now)).toBe('pro');
  });
  it('2) Pro ZORRO’ya erişemez', () => {
    for (const f of AI) expect(canUseFeature(pro, f, now)).toBe(false);
    expect(canUseAi(pro, false, now)).toBe(false);
  });
  it('3) Pro gelişmiş analize erişemez (sayfayı kilitli görür)', () => {
    expect(canUseAnalytics(pro, false, now)).toBe(false);
    expect(canSeeAnalyticsPage(pro, false, now)).toBe(true);
  });
  it('4–6) Premium temel + ZORRO + gelişmiş analiz', () => {
    for (const f of [...CORE, ...AI, 'analytics' as const]) expect(canUseFeature(premium, f, now)).toBe(true);
    expect(canUseAi(premium, false, now)).toBe(true);
    expect(canUseAnalytics(premium, false, now)).toBe(true);
  });
  it('deneme tüm özellikler (yapay zekâ + gelişmiş analiz dahil). Üyeliksiz kilitli', () => {
    expect(canUseFeature(trial, 'core_study', now)).toBe(true);
    expect(canUseAi(trial, false, now)).toBe(true);
    expect(canUseAnalytics(trial, false, now)).toBe(true);
    expect(canUseAi(free, false, now)).toBe(false);
    expect(paidAccessLocked(free, now)).toBe(true);
  });
  it('süresi biten Premium yapay zekâyı kaybeder; yönetici açık', () => {
    const expired = student({ plan: 'premium', subscription_status: 'active', subscription_ends_at: past });
    expect(canUseAi(expired, false, now)).toBe(false);
    expect(canUseAi(free, true, now)).toBe(true);
  });
});

describe('sunucu yetkisi (senaryolar 7–8)', () => {
  const gate = (p: { plan: string; status: string; subEnds?: string; trialEnds?: string; role?: string }) => ({
    skip: false, role: p.role || 'student', plan: p.plan, status: p.status, subEnds: p.subEnds || '', trialEnds: p.trialEnds || '',
  });
  it('katman yalnız veritabanı kolonlarından', () => {
    expect(accessTierFromBilling(gate({ plan: 'pro', status: 'active', subEnds: future }), false, now)).toBe('pro');
    expect(accessTierFromBilling(gate({ plan: 'premium', status: 'active', subEnds: future }), false, now)).toBe('premium');
    expect(accessTierFromBilling(gate({ plan: '', status: 'trialing', trialEnds: future }), false, now)).toBe('trial');
    expect(accessTierFromBilling(gate({ plan: 'premium', status: 'active', subEnds: past }), false, now)).toBe('none');
    expect(accessTierFromBilling(gate({ plan: 'premium', status: 'active', role: 'coach' }), false, now)).toBe('none');
    expect(accessTierFromBilling({ ...gate({ plan: 'premium', status: 'active' }), skip: true }, false, now)).toBe('none');
    expect(accessTierFromBilling(gate({ plan: '', status: '' }), true, now)).toBe('staff');
  });
  it('8) Pro 402; deneme izinli (060); RPC hatası 503; RPC false 402; yalnız ikisi evetse izin', () => {
    expect(premiumAiDecision({ tier: 'pro', rpcOk: true, rpcValue: true })).toMatchObject({ allow: false, status: 402 });
    expect(premiumAiDecision({ tier: 'trial', rpcOk: true, rpcValue: true })).toEqual({ allow: true });
    expect(premiumAiDecision({ tier: 'trial', rpcOk: true, rpcValue: false })).toMatchObject({ allow: false, status: 402 });
    expect(premiumAiDecision({ tier: 'trial', rpcOk: false, rpcValue: null })).toMatchObject({ allow: false, status: 503 });
    expect(premiumAiDecision({ tier: 'premium', rpcOk: false, rpcValue: null })).toMatchObject({ allow: false, status: 503 });
    expect(premiumAiDecision({ tier: 'premium', rpcOk: true, rpcValue: false })).toMatchObject({ allow: false, status: 402 });
    expect(premiumAiDecision({ tier: 'premium', rpcOk: true, rpcValue: 'true' })).toMatchObject({ allow: false });
    expect(premiumAiDecision({ tier: 'premium', rpcOk: true, rpcValue: true })).toEqual({ allow: true });
    expect(premiumAiDecision({ tier: 'staff', rpcOk: true, rpcValue: true })).toEqual({ allow: true });
  });
  it('7) student-ai Premium kararını gövdeyi okumadan verir; gövdeden plan/katman okunmaz', () => {
    const src = read('supabase/functions/student-ai/index.ts');
    const decideAt = src.indexOf('premiumAiDecision(');
    const rpcAt = src.indexOf('rpc("caller_premium_ai")');
    const bodyAt = src.indexOf('body = await req.json()');
    expect(rpcAt).toBeGreaterThan(0);
    expect(decideAt).toBeGreaterThan(rpcAt);
    expect(bodyAt).toBeGreaterThan(decideAt);
    expect(src).not.toMatch(/body\.(plan|tier|premium|plan_id|ai|role|isAdmin)\b/);
    expect(read('supabase/functions/exam-scan/index.ts')).not.toMatch(/body\.(plan|tier|premium|plan_id|ai|role|isAdmin)\b/);
    expect(src).not.toMatch(/bill\.tier === "pro"/);
  });
  it('exam-scan de aynı kapıyı kullanır, kotadan önce', () => {
    const src = read('supabase/functions/exam-scan/index.ts');
    const decideAt = src.indexOf('premiumAiDecision(');
    expect(src.indexOf('rpc("caller_premium_ai")')).toBeGreaterThan(0);
    expect(decideAt).toBeGreaterThan(0);
    expect(src.indexOf('take_exam_scan_slot')).toBeGreaterThan(decideAt);
  });
  it('soru bankası erişimi bu işte değişmedi (bank-pack studentFeatureOk ile kalır)', () => {
    const bank = read('supabase/functions/bank-pack/index.ts');
    expect(bank).toContain('studentFeatureOk');
    expect(bank).not.toContain('planAccess');
  });
});

describe('ödeme (Shopier) planı sunucudan', () => {
  it('webhook planı ödeme oturumundan alır, tutarı paket fiyatıyla karşılaştırır; istemci gövdesi plan yazmaz', () => {
    const hook = read('supabase/functions/billing-webhook/index.ts');
    expect(hook).toMatch(/const planId = normalizePlanId\(session\.plan_id\)/);
    const shop = read('supabase/functions/_shared/shopierWebhook.ts');
    expect(shop).toMatch(/isCatalogPriceTry\(input\.planId, expected\)/);
    const checkout = read('supabase/functions/billing-checkout/index.ts');
    expect(checkout).toMatch(/const amountTry = chargeAmountTry\(planId\)/);
  });
  it('043 ve 054 dosyaları değişmedi (içerik özeti)', () => {
    const sha = (rel: string) => createHash('sha256').update(read(rel).replace(/\r\n/g, '\n')).digest('hex');
    expect(sha('supabase/migrations/043_apply_verified_payment.sql')).toBe('3833d6f3b6aa8d72c824a21fcaf8e319f248d2667b5c3813d928668899375302');
    expect(sha('supabase/migrations/054_apply_verified_payment_v2.sql')).toBe('38422e48194afe28614012105d0562aec573339eb9f5ae1f06ed6fcbdcc5fed2');
  });
});

describe('yapay zekâ servisi hatası ve arayüz kilitleri', () => {
  it('model ağ hatası / zaman aşımı güvenli 502 döner; anahtar istemciye gitmez', () => {
    const scan = read('supabase/functions/exam-scan/index.ts');
    expect(scan).toMatch(/new AbortController\(\)/);
    expect(scan).toMatch(/signal: ctrl\.signal/);
    expect(scan).toMatch(/\} catch \{\n\s*return json\(req, \{ ok: false, error: "Görsel model yanıt vermedi/);
    const ai = read('supabase/functions/student-ai/index.ts');
    expect(ai).toMatch(/signal: ctrl\.signal/);
    expect(ai).toMatch(/return json\(req, \{ error: "Model yanıt vermedi" \}, 502\)/);
    for (const rel of ['src/lib/coachAi.ts', 'src/lib/cloudPlatform.ts', 'src/lib/aiSchedule.ts']) {
      expect(read(rel)).not.toMatch(/GEMINI_API_KEY|generativelanguage\.googleapis/);
    }
  });
  it('Premium olmayan kullanıcı kilidi görür ve Premium’a geç ile üyelik sayfasına gider', () => {
    expect(read('src/components/CoachChat.tsx')).toMatch(/go\('membership'\); \}\}>Premium’a geç/);
    expect(read('src/components/AiCoachCard.tsx')).toMatch(/go\('membership'\)\}>Premium’a geç/);
    expect(read('src/pages/AnalyticsPage.tsx')).toMatch(/<FeatureLock title="Gelişmiş analiz Premium üyelikte açılır" premium>/);
    expect(read('src/pages/PlanPage.tsx')).toMatch(/go\('membership'\)\}>Premium’a geç/);
    expect(read('src/components/Layout.tsx')).toMatch(/canUseAi\(profile, isAdmin\) \? null : <small className="nav-premium"/);
  });
  it('aktif Premium iken Pro ödemesi onaysız başlatılmaz; aynı plan uzatması kalan günü gösterir', () => {
    const m = read('src/pages/MembershipPage.tsx');
    expect(m).toMatch(/snap\.planId === 'premium' && planId === 'pro' && !confirmDowngrade/);
    expect(m).toMatch(/Uzatırsan yeni bitiş/);
    expect(m).not.toMatch(/Premium erişim aktif/);
  });
});

