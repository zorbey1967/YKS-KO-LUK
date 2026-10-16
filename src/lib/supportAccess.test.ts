import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_ENABLED } from './features';
import { commandNav, sidebarNav } from './types';
import {
  needsSupportNameConsent,
  parseSupportStatus,
  supportNamesForTicket,
  supportNextStatus,
  supportTicketInsertAllowed,
  supportTicketVisible,
} from './supportAccess';

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
