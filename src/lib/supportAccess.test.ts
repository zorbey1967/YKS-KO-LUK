import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_ENABLED } from './features';
import { commandNav, sidebarNav } from './types';
import {
  filterAdminSupportTickets,
  filterOwnSupportTickets,
  needsSupportNameConsent,
  parseSenderRole,
  parseSupportStatus,
  supportIsolationScenario,
  supportNamesForTicket,
  supportNextStatus,
  supportSenderRoleLabel,
  supportTicketInsertAllowed,
  supportTicketVisible,
} from './supportAccess';
import { storageKey } from './storage';
import { liveStorageKey } from './studyTimer';

describe('destek erişim ve isim onayı', () => {
  it('öğrenci kendi mesajını görür, başkasını görmez; admin tümünü görür; anon göremez/yazamaz', () => {
    const me = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(supportTicketVisible({ authUid: me, isAdmin: false, ticketUserId: me })).toBe(true);
    expect(supportTicketVisible({ authUid: me, isAdmin: false, ticketUserId: other })).toBe(false);
    expect(supportTicketVisible({ authUid: me, isAdmin: true, ticketUserId: other })).toBe(true);
    expect(supportTicketVisible({ authUid: null, isAdmin: false, ticketUserId: me })).toBe(false);
    expect(supportTicketInsertAllowed({ authUid: null, ticketUserId: me })).toBe(false);
    expect(supportTicketInsertAllowed({ authUid: me, ticketUserId: other })).toBe(false);
    expect(supportTicketInsertAllowed({ authUid: me, ticketUserId: me })).toBe(true);
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/044_support_tickets.sql'), 'utf8');
    expect(sql).toContain('revoke all on table public.support_tickets from anon, public');
    expect(sql).toContain('user_id = auth.uid() or public.is_admin()');
    expect(sql).toContain("auth.jwt() ->> 'email'");
  });

  it('A/B: TEST A ve TEST B karşılıklı görünmez; admin her ikisini görür', () => {
    const studentA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const studentB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const tickets = [
      { id: '1', user_id: studentA, subject: 'TEST A' },
      { id: '2', user_id: studentB, subject: 'TEST B' },
      { id: '3', user_id: studentA, subject: 'leak-should-not-reach-B' },
    ];
    const r = supportIsolationScenario({ tickets, studentA, studentB });
    expect(r.aSeesOnlyOwn).toBe(true);
    expect(r.bSeesOnlyOwn).toBe(true);
    expect(r.adminSeesBoth).toBe(true);
    expect(r.aSubjects).toEqual(['TEST A', 'leak-should-not-reach-B']);
    expect(r.bSubjects).toEqual(['TEST B']);
    expect(filterOwnSupportTickets(tickets, null)).toEqual([]);
    expect(filterOwnSupportTickets(tickets, studentB).map((t) => t.subject)).not.toContain('TEST A');
  });

  it('localStorage anahtarı kullanıcıya özel; A ve B aynı key paylaşmaz', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(storageKey(a)).toBe(`yks_v7_${a}`);
    expect(storageKey(b)).toBe(`yks_v7_${b}`);
    expect(storageKey(a)).not.toBe(storageKey(b));
    expect(storageKey(null)).toBe('yks_v7_guest');
    expect(liveStorageKey(a)).not.toBe(liveStorageKey(b));
    expect(liveStorageKey(a)).toContain(a);
  });

  it('destek istemci ve UI izolasyon katmanları kodda zorunlu', () => {
    const cloud = readFileSync(join(process.cwd(), 'src/lib/supportCloud.ts'), 'utf8');
    expect(cloud).toMatch(/listMySupportTickets[\s\S]*?\.eq\('user_id', uid\)/);
    expect(cloud).toContain('filterOwnSupportTickets');
    expect(cloud).toContain('listAdminSupportTickets');
    expect(cloud).toContain('support-notify');
    expect(cloud).not.toContain('service_role');
    expect(cloud).not.toContain('ADMIN_SUPPORT_EMAIL');
    expect(cloud).not.toContain('RESEND_API_KEY');
    expect(cloud).toMatch(/listAdminSupportTickets[\s\S]*?\.from\('support_tickets'\)[\s\S]*?\.order\(/);
    expect(cloud).not.toMatch(/listAdminSupportTickets[\s\S]*?\.eq\('user_id'/);
    const panel = readFileSync(join(process.cwd(), 'src/components/SupportPanel.tsx'), 'utf8');
    expect(panel).toContain('setRows([])');
    expect(panel).toContain('[user?.id]');
    expect(panel).toContain('r.user_id === user.id');
    expect(panel).toContain('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    const admin = readFileSync(join(process.cwd(), 'src/components/AdminSupportPanel.tsx'), 'utf8');
    expect(admin).toContain('listAdminSupportTickets');
    expect(admin).toContain('Gelen Destek Mesajları');
    expect(admin).toContain('supportSenderRoleLabel');
    expect(admin).toContain('filterAdminSupportTickets');
    expect(admin).not.toContain('listMySupportTickets');
    expect(admin).not.toContain('service_role');
    const notify = readFileSync(join(process.cwd(), 'supabase/functions/support-notify/index.ts'), 'utf8');
    expect(notify).toContain('ADMIN_SUPPORT_EMAIL');
    expect(notify).toMatch(/to:\s*\[adminEmail\]/);
    expect(notify).not.toMatch(/to:\s*\[[^\]]*ticket\.email/);
    expect(notify).not.toContain('SERVICE_ROLE');
    const ctx = readFileSync(join(process.cwd(), 'src/context/AppContext.tsx'), 'utf8');
    expect(ctx).toContain('prevUser.id !== u.id');
    expect(ctx).toContain('setDataState(loadData(u.id))');
    const m045 = readFileSync(join(process.cwd(), 'supabase/migrations/045_support_force_rls_isolation.sql'), 'utf8');
    expect(m045).toContain('force row level security');
    expect(m045).toContain('user_id = auth.uid() or public.is_admin()');
    const m049 = readFileSync(join(process.cwd(), 'supabase/migrations/049_support_sender_role.sql'), 'utf8');
    expect(m049).toContain('sender_role');
    expect(m049).not.toMatch(/drop policy/i);
  });

  it('admin filtreleri: yeni / yanıtlandı / hatırlatıldı', () => {
    expect(parseSenderRole('coach')).toBe('coach');
    expect(supportSenderRoleLabel('coach')).toBe('Koç');
    expect(supportSenderRoleLabel('student')).toBe('Öğrenci');
    const rows = [
      { id: '1', status: 'new' as const },
      { id: '2', status: 'replied' as const },
      { id: '3', status: 'reviewing' as const },
    ];
    expect(filterAdminSupportTickets(rows, 'new', {}).map((r) => r.id)).toEqual(['1']);
    expect(filterAdminSupportTickets(rows, 'replied', {}).map((r) => r.id)).toEqual(['2']);
    expect(filterAdminSupportTickets(rows, 'nudged', { '3': true }).map((r) => r.id)).toEqual(['3']);
  });

  it('isim onayı: profil adı varsa sormaz; hayır deyince boş ad ile gönderilebilir', () => {
    expect(needsSupportNameConsent('Ali Veli', null)).toBe(false);
    expect(needsSupportNameConsent('', null)).toBe(true);
    expect(needsSupportNameConsent('', 'no')).toBe(false);
    expect(supportNamesForTicket({ profileName: 'Ali Veli', consent: null })).toEqual({ firstName: 'Ali', lastName: 'Veli' });
    expect(supportNamesForTicket({ profileName: '', consent: 'no' })).toEqual({ firstName: '', lastName: '' });
  });

  it('mesaj durumu Yeni / İnceleniyor / Yanıtlandı', () => {
    expect(parseSupportStatus('reviewing')).toBe('reviewing');
    expect(supportNextStatus('new', 'replied')).toBe('replied');
    expect(supportNextStatus('new', 'hack')).toBe('new');
  });
});

describe('destek ile birlikte korunan yüzeyler', () => {
  it('Soru Bankası görünmez; kütüphane heartbeat cleanup; AI mount yok; üyelik refresh loop yok', () => {
    expect(QUESTION_BANK_ENABLED).toBe(false);
    expect(sidebarNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    expect(commandNav('student', false).map((x) => x.id)).not.toContain('questionbank');
    const lib = readFileSync(join(process.cwd(), 'src/pages/LibraryPage.tsx'), 'utf8');
    expect(lib).toContain('window.clearInterval(id)');
    expect(lib).toContain('document.hidden');
    const analytics = readFileSync(join(process.cwd(), 'src/pages/AnalyticsPage.tsx'), 'utf8');
    expect(analytics).not.toMatch(/useEffect\([\s\S]{0,400}requestAiCoachAnalysis/);
    const mem = readFileSync(join(process.cwd(), 'src/pages/MembershipPage.tsx'), 'utf8');
    expect(mem).not.toMatch(/useEffect\(\(\) => \{[\s\S]*refreshAuth[\s\S]*\}, \[user, refreshAuth\]\)/);
    expect(readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')).toContain('SupportPanel');
  });
});
