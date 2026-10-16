import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_ENABLED, isNavPageVisible } from './features';
import { coerceAppPage } from './roleNav';
import { commandNav, NAV, sidebarNav } from './types';

describe('soru bankası feature flag', () => {
  it('kapalıyken menü ve komut paletinden düşer; kod durur', () => {
    expect(QUESTION_BANK_ENABLED).toBe(false);
    expect(isNavPageVisible('questionbank')).toBe(false);
    expect(coerceAppPage('questionbank', 'student', 'ok', false)).toBe('home');
    expect(coerceAppPage('topics', 'student', 'ok', false)).toBe('home');
    expect(isNavPageVisible('analytics')).toBe(true);
    expect(isNavPageVisible('topics')).toBe(false);
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('topics');
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('settings');
    expect(NAV.some((n) => n.id === 'questionbank')).toBe(true);
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    expect(commandNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    expect(readFileSync(join(process.cwd(), 'src/pages/AccountPage.tsx'), 'utf8')).not.toMatch(/soru bankası/i);
    expect(readFileSync(join(process.cwd(), 'src/pages/MembershipPage.tsx'), 'utf8')).toContain('QUESTION_BANK_ENABLED');
    expect(readFileSync(join(process.cwd(), 'src/lib/site.ts'), 'utf8')).not.toMatch(/soru bankası/i);
    expect(readFileSync(join(process.cwd(), 'index.html'), 'utf8')).not.toMatch(/soru bankası/i);
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(app).toContain('QuestionBankPage');
    expect(app).toContain('QUESTION_BANK_ENABLED');
    expect(readFileSync(join(process.cwd(), 'src/components/FeatureComingSoon.tsx'), 'utf8')).toContain('geliştirme aşamasında');
    const bank = readFileSync(join(process.cwd(), 'src/pages/QuestionBankPage.tsx'), 'utf8');
    expect(bank).toContain('Soru Bankası');
  });
});

describe('analiz AI tetikleyici', () => {
  it('sayfa açılışında student-ai çağırmaz', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/AnalyticsPage.tsx'), 'utf8');
    expect(page).toContain('AI İLE ANALİZ ET');
    expect(page).toContain('AI ile Analiz Et');
    expect(page).toContain('ANALİZ SONUCU');
    expect(page).toContain('Yüklenen dosyaları analiz et');
    expect(page).toContain('Analiz etmek istediğiniz sınav/deneme fotoğraflarını');
    expect(page).toContain('disabled={docBusy || !files.length}');
    expect(page).toContain('analyzeExamDocumentFiles');
    expect(page).toContain('AI Değerlendirmesi');
    expect(page).toContain('Deneme Analizi');
    expect(page).toContain('Genel Durum');
    expect(page).not.toContain('Ders Analizi');
    expect(page).toContain('Çalışma Analizi');
    expect(page).toContain('TYT');
    expect(page).toContain('AYT');
    expect(page).toContain('requestAiCoachAnalysis');
    expect(page).not.toMatch(/setTab\(/);
    expect(page).not.toMatch(/\['konu',\s*'KONU'\]/);
    expect(page).not.toContain('KONU PERFORMANSI');
    expect(page).not.toContain('Zayıf konular');
    expect(page).not.toMatch(/useEffect\([\s\S]{0,400}requestAiCoachAnalysis/);
    expect(page).not.toMatch(/useEffect\([\s\S]{0,400}analyzeExamDocumentFiles/);
    expect(page).not.toContain('askCoach(');
    const scan = readFileSync(join(process.cwd(), 'supabase/functions/exam-scan/index.ts'), 'utf8');
    expect(scan).toContain('document_analysis');
    expect(scan).toContain('Konusu belirlenemedi');
    const chat = readFileSync(join(process.cwd(), 'src/components/CoachChat.tsx'), 'utf8');
    expect(chat).toContain('askCoach(');
    expect(chat).toContain('void send(');
    expect(chat).not.toMatch(/useEffect\([\s\S]{0,500}askCoach\(/);
  });
});

describe('ana sayfa öğrenci merkezi', () => {
  it('Hadi Başla ve AI açıklaması vardır; açılışta student-ai yok', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/HomePage.tsx'), 'utf8');
    expect(page).toContain('HAZIRIM / HADİ BAŞLA');
    expect(page).toContain('Yapay zekayı senin için nasıl kullanıyoruz?');
    expect(page).toContain('Yapay Zeka Senin İçin Nasıl Çalışıyor?');
    expect(page).toContain('Bu sistemi neden kullanmalısın?');
    expect(page).toContain('Neden buradan çalışmalısın?');
    expect(page).toContain('Bugün Nasılsın?');
    expect(page).toContain('Yaptıkların');
    expect(page).toContain('Hesabıma göre bugün ne yapmalıyım?');
    expect(page).toContain('Koçun Programı');
    expect(page).toContain('Bugünkü Programım');
    expect(page).toContain('Ders Programım');
    expect(page).toContain('Koçun verdiği görevler');
    expect(page).toContain('TaskRows');
    expect(page).toContain('BUGÜN NE KADAR ÇALIŞTIM?');
    expect(page).toContain('SESSİZ KÜTÜPHANEDE NE KADAR KALDIM?');
    expect(page).toContain('Güçlü Olduğun Alanlar');
    expect(page).toContain('Geliştirmen Gereken Alanlar');
    expect(page).toContain('HAFTALIK İLERLEME');
    expect(page).toContain('kişiselleştirilmiş çalışma önerileri');
    expect(page).toContain('Bugünkü durumunu analiz et');
    expect(page).toContain('requestAiCoachAnalysis');
    expect(page).toContain('getStudentProgress');
    expect(page).not.toMatch(/useEffect\(/);
    expect(page).not.toContain('askCoach');
    expect(page).not.toContain('askDailyPlan');
  });
});

describe('Akıllı Plan AI tetikleyici', () => {
  it('Plan sayfası açılışında student-ai çağırmaz', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/PlanPage.tsx'), 'utf8');
    expect(page).toContain('askDailyPlan');
    const mountEffect = page.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[user\?\.id\]\);/);
    expect(mountEffect?.[1]).toContain('listMyCoachProgramPdfs');
    expect(mountEffect?.[1]).not.toContain('askDailyPlan');
    expect(mountEffect?.[1]).not.toContain('saveCloud');
    expect(page).toContain('listMyCoachProgramPdfs');
    expect(page).toContain('getStudentProgress');
    expect(page).toContain('Şimdilik Değiştirme');
    expect(page).toContain('Akıllı Plan; deneme sonuçlarına');
    expect(page).toContain('Planı Sil');
    expect(page).toContain('clearStudentSmartPlan');
    expect(page).toContain('<h3>Koçun Programı</h3>');
    expect(page).not.toContain('Eksiklerim');
    const topics = readFileSync(join(process.cwd(), 'src/pages/TopicsPage.tsx'), 'utf8');
    expect(topics).not.toMatch(/yaşın kaç/i);
    expect(topics).toContain('buildSubjectCards');
  });
});

describe('üyelik performans regresyonu', () => {
  it('MembershipPage user+refreshAuth döngüsü yok', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/MembershipPage.tsx'), 'utf8');
    expect(page).not.toMatch(/useEffect\(\(\) => \{[\s\S]*refreshAuth[\s\S]*\}, \[user, refreshAuth\]\)/);
    expect(page).not.toMatch(/if \(!user\) return;\s*void refreshAuth\(\)/);
    const ctx = readFileSync(join(process.cwd(), 'src/context/AppContext.tsx'), 'utf8');
    expect(ctx).toContain('hydratedUserId');
    expect(ctx).toContain('hydrateChain');
    expect(ctx).not.toMatch(/void loadCloudProfile\(u\)\.then\(\(p\) => pullCloud\(u, p\)\)/);
  });
});

describe('production kaynak dosyaları', () => {
  it('çekirdek StudentProgress ve tahta import edilir', () => {
    const root = process.cwd();
    expect(readFileSync(join(root, 'src/lib/studentProgress.ts'), 'utf8')).toContain('export function getStudentProgress');
    expect(readFileSync(join(root, 'src/lib/examPhoto.ts'), 'utf8')).toContain('suggestExamFromPhoto');
    expect(readFileSync(join(root, 'src/components/MeetingWhiteboard.tsx'), 'utf8')).toContain('MeetingWhiteboard');
    expect(readFileSync(join(root, 'src/pages/MeetingPage.tsx'), 'utf8')).toContain('MeetingWhiteboard');
    expect(readFileSync(join(root, 'src/lib/postgrestError.ts'), 'utf8')).toContain('userFacingCloudError');
    expect(readFileSync(join(root, 'src/styles.css'), 'utf8')).toContain('max-width:768px');
    expect(readFileSync(join(root, 'src/styles.css'), 'utf8')).not.toContain('max-width:760px');
    expect(readFileSync(join(root, 'src/styles.css'), 'utf8')).not.toContain('min-width:761px');
    const schedule = readFileSync(join(root, 'src/pages/SchedulePage.tsx'), 'utf8');
    expect(schedule).toContain('<h3>Program PDF</h3>');
    expect(schedule).toContain('Koça Gönder');
    expect(schedule).toContain('PDF’yi Analiz Et');
    expect(schedule).not.toContain('<h3>Ders Programım</h3>');
    expect(schedule).not.toContain('ExamCenter');
    expect(schedule).not.toContain('Sınavlarım');
    expect(schedule).not.toContain("coachLocked ? 'Koçumun Yaptığı Program'");
    expect(schedule).not.toContain('Koçumun Yaptığı Program');
    expect(schedule).not.toContain("saveStudentWeekPlan({ studentId: user.id");
    expect(schedule).toContain('studentOwnedSchedule');
    expect(readFileSync(join(root, 'src/context/AppContext.tsx'), 'utf8')).toContain('flushLibraryForUser');
    expect(readFileSync(join(root, 'src/context/AppContext.tsx'), 'utf8')).toContain('resetAiCoachCache');
    expect(readFileSync(join(root, 'src/context/AppContext.tsx'), 'utf8')).toContain('resetExamDocumentAnalysisCache');
    expect(readFileSync(join(root, 'src/lib/aiCoachAnalysis.ts'), 'utf8')).toContain('export function resetAiCoachCache');
    expect(readFileSync(join(root, 'src/lib/examDocumentAnalysis.ts'), 'utf8')).toContain('export function resetExamDocumentAnalysisCache');
  });
});
