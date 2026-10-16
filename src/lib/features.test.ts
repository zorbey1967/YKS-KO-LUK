import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_ENABLED, isNavPageVisible } from './features';
import { commandNav, NAV, sidebarNav } from './types';

describe('soru bankası feature flag', () => {
  it('kapalıyken menü ve komut paletinden düşer; kod durur', () => {
    expect(QUESTION_BANK_ENABLED).toBe(false);
    expect(isNavPageVisible('questionbank')).toBe(false);
    expect(isNavPageVisible('analytics')).toBe(true);
    expect(NAV.some((n) => n.id === 'questionbank')).toBe(true);
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    expect(commandNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(app).toContain('QuestionBankPage');
    expect(app).toContain('FeatureComingSoon');
    expect(readFileSync(join(process.cwd(), 'src/components/FeatureComingSoon.tsx'), 'utf8')).toContain('geliştirme aşamasında');
    const bank = readFileSync(join(process.cwd(), 'src/pages/QuestionBankPage.tsx'), 'utf8');
    expect(bank).toContain('Soru Bankası');
  });
});

describe('analiz AI tetikleyici', () => {
  it('sayfa açılışında student-ai çağırmaz', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/AnalyticsPage.tsx'), 'utf8');
    expect(page).toContain('AI ile Analiz Et');
    expect(page).toContain('requestAiCoachAnalysis');
    expect(page).not.toMatch(/useEffect\([\s\S]{0,400}requestAiCoachAnalysis/);
    expect(page).not.toContain('askCoach(');
    const chat = readFileSync(join(process.cwd(), 'src/components/CoachChat.tsx'), 'utf8');
    expect(chat).toContain('askCoach(');
    expect(chat).toContain('void send(');
  });
});

describe('üyelik performans regresyonu', () => {
  it('MembershipPage user+refreshAuth döngüsü yok', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/MembershipPage.tsx'), 'utf8');
    expect(page).not.toMatch(/useEffect\(\(\) => \{[\s\S]*refreshAuth[\s\S]*\}, \[user, refreshAuth\]\)/);
    expect(page).not.toMatch(/if \(!user\) return;\s*void refreshAuth\(\)/);
  });
});
