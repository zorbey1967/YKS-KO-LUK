import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALC_CONFIG } from './curriculum';
import { googleOAuthOptions } from './googleOAuth';
import { SITE_ORIGIN } from './site';
import { sidebarNav } from './types';
import { calcNet } from './util';

const root = join(process.cwd());
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('production audit contracts', () => {
  it('öğrenci menüsü + App route’ları birlikte durur', () => {
    const app = src('src/App.tsx');
    const ids = sidebarNav('student', false).map((x) => x.id);
    expect(ids).toContain('calculator');
    for (const id of ids) {
      expect(app).toContain(`page === '${id}'`);
    }
    expect(app).toContain("page === 'calculator' && <CalculatorPage");
    expect(app).toContain("page === 'exams' && <ExamsPage");
    expect(app).toContain("page === 'questionbank'");
    expect(app).toContain('QuestionBankPage');
    expect(app).toContain('QUESTION_BANK_ENABLED');
    expect(app).toContain("page === 'membership' && <MembershipPage");
    expect(src('src/components/Layout.tsx')).toContain('ZORRO');
  });

  it('Net Hesapla TYT/AYT/KPSS türlerini kaybetmez', () => {
    expect(Object.keys(CALC_CONFIG)).toEqual(['TYT', 'AYT', 'GY', 'GK']);
    expect(CALC_CONFIG.TYT.some((s) => s.key === 'Türkçe' && s.max === 40)).toBe(true);
    expect(CALC_CONFIG.AYT.some((s) => s.key === 'Matematik' && s.max === 40)).toBe(true);
  });

  it('Google OAuth detectSessionInUrl kapalı; PKCE açık; debug paneli yok', () => {
    const supabase = src('src/lib/supabase.ts');
    expect(supabase).toMatch(/detectSessionInUrl:\s*false/);
    expect(supabase).toMatch(/flowType:\s*'pkce'/);
    expect(supabase).toMatch(/persistSession:\s*true/);
    expect(src('src/pages/AccountPage.tsx')).not.toMatch(/OAUTH DEBUG|code=var|Google oturumu bununla düşmez/);
    expect(googleOAuthOptions().options.redirectTo).toBe(`${SITE_ORIGIN}/`);
    expect(src('src/lib/googleOAuth.ts')).toContain('signInWithOAuth');
  });

  it('Üyelik sayfası trial butonu ve admin onay şartı metnini ayırır', () => {
    const page = src('src/pages/MembershipPage.tsx');
    expect(page).toContain('14 Günlük Ücretsiz Denemeyi Başlat');
    expect(page).toContain('startTopPlanTrial');
    expect(page).toContain('Premium erişim aktif');
    expect(page).not.toMatch(/deneme yalnızca e-posta doğrulama ve yönetici onayından sonra/);
    expect(page).not.toMatch(/henüz sunucuya işlenmedi/);
    expect(page).not.toMatch(/if \(!user\) return;\s*void refreshAuth\(\)/);
    expect(page).toContain('applyTrialRpcToProfile');
    expect(page).not.toContain('confirm(');
  });

  it('Net Hesapla 4 yanlış = 1 doğru', () => {
    expect(calcNet(40, 0)).toBe(40);
    expect(calcNet(36, 4)).toBe(35);
    expect(calcNet(0, 4)).toBe(-1);
  });

  it('Soru Bankası fatura kilidinde değil; bundled seviyeler durur', () => {
    const app = src('src/App.tsx');
    const lockBlock = app.slice(app.indexOf('BILLING_LOCKED_PAGES'), app.indexOf('export default'));
    expect(lockBlock).not.toMatch(/'questionbank'/);
    const bank = src('src/data/bankData.ts');
    expect(bank).toContain('YKS_CURRICULUM');
    expect(bank).toContain('KPSS_CURRICULUM');
    expect(bank).toContain('SCHOOL_CURRICULUM');
  });

  it('production UI migration numarası göstermez', () => {
    const files = [
      'src/pages/MembershipPage.tsx',
      'src/pages/LibraryPage.tsx',
      'src/pages/TasksPage.tsx',
      'src/pages/CoachesPage.tsx',
      'src/pages/AdminPage.tsx',
      'src/components/ExamAnalysisPanel.tsx',
      'src/lib/billing.ts',
      'src/lib/cloudPlatform.ts',
    ];
    for (const f of files) {
      expect(src(f), f).not.toMatch(/\((014|016|030|036|037)\)/);
    }
  });

  it('042 additive schema start_top_plan_trial ve protect_plan’i değiştirmez', () => {
    const sql = src('supabase/migrations/042_production_feature_schema.sql');
    expect(sql).toMatch(/add column if not exists/);
    expect(sql).not.toMatch(/drop table public/i);
    expect(sql).not.toMatch(/create or replace function public\.start_top_plan_trial/);
    expect(sql).not.toMatch(/create or replace function public\.protect_plan/);
    expect(sql).not.toMatch(/create or replace function public\.handle_new_user/);
  });

  it('043 apply_verified_payment authenticated EXECUTE vermez', () => {
    const sql = src('supabase/migrations/043_apply_verified_payment.sql');
    expect(sql).toContain('revoke all on function public.apply_verified_payment');
    expect(sql).not.toMatch(/grant execute on function public\.apply_verified_payment/);
    expect(sql).toContain("set search_path to ''");
    expect(sql).not.toMatch(/create or replace function public\.start_top_plan_trial/);
  });

  it('canlı trial RPC ve protect_plan search_path yerel 041 ile uyumlu', () => {
    const sql = src('supabase/migrations/041_protect_plan_search_path.sql');
    expect(sql).toMatch(/set search_path to ''/);
    expect(sql).toContain('new.trial_started_at := old.trial_started_at');
    expect(sql).toContain('security_invoker = true');
    expect(src('src/lib/cloudPlatform.ts')).toContain("supabase.rpc('start_top_plan_trial')");
  });
});
