import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accessMessage, pagesAllowedForGate, resolveAccessGate } from './accessGate';
import { canDecideApprovedCancel } from './appointmentCancelPolicy';
import { isMeetingJoinVisible, istanbulWallIso, splitAppointmentsBySlot } from './meeting';
import { applyLoginMode, loginModeNotice, resolveLoginMode } from './roleMode';
import type { Profile } from './types';

const root = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const user = { email_confirmed_at: '2026-10-01T00:00:00Z' };
const base = (over: Partial<Profile> = {}): Profile => ({
  name: 'Ali Veli', email: 'ali@example.com', plan: '', role: 'student', account_status: 'active', ...over,
});

describe('randevu ayrımı ve görüşme penceresi', () => {
  const now = new Date(istanbulWallIso('2026-10-23', '10:00')).getTime();
  const row = (date: string, time: string, status = 'onay') => ({ date, time, minutes: 40, status, startsAt: null });

  it('yarınki randevu "eski" değil, yaklaşan sayılır', () => {
    const split = splitAppointmentsBySlot([row('2026-10-24', '09:00'), row('2026-10-22', '09:00')], now);
    expect(split.upcoming.map((a) => a.date)).toEqual(['2026-10-24']);
    expect(split.past.map((a) => a.date)).toEqual(['2026-10-22']);
  });

  it('bugünün sıradaki dersi current, sonrakiler upcoming', () => {
    const split = splitAppointmentsBySlot([row('2026-10-23', '15:00'), row('2026-10-23', '12:00'), row('2026-10-25', '10:00')], now);
    expect(split.current.map((a) => a.time)).toEqual(['12:00']);
    expect(split.upcoming.map((a) => `${a.date} ${a.time}`)).toEqual(['2026-10-23 15:00', '2026-10-25 10:00']);
  });

  it('katıl düğmesi ders bitiminden 15 dk sonra kaybolur (24 saat değil)', () => {
    const a = row('2026-10-23', '10:00');
    expect(isMeetingJoinVisible(a, now + 50 * 60_000)).toBe(true);
    expect(isMeetingJoinVisible(a, now + 56 * 60_000)).toBe(false);
  });
});

describe('koç durumu ve giriş modu', () => {
  const gate = (p: Profile | null) => resolveAccessGate({ user, profile: p, isAdmin: false, authReady: true });

  it('pasif koç kaydı "başvurunuz alındı" değil, pasif mesajı görür', () => {
    const g = gate(applyLoginMode(base({ coach_status: 'pasif' }), 'coach'));
    expect(g).toBe('coach_suspended');
    expect(accessMessage(g)).toMatch(/pasife alındı/);
    expect(pagesAllowedForGate(g)).toEqual(['account', 'coaches']);
  });

  it('reddedilen koç seçim yokken öğrenci modunda açılır', () => {
    expect(resolveLoginMode(base({ signup_intent: 'coach', coach_status: 'rejected' }), null)).toBe('student');
    expect(resolveLoginMode(base({ signup_intent: 'coach', coach_status: 'pending' }), null)).toBe('coach');
  });

  it('koç kaydı okunamadıysa "kayıt yok" denmez ve mod öğrenciye çevrilmez', () => {
    const p = base({ coach_lookup_failed: true });
    expect(loginModeNotice(p, 'coach')).toBe('');
    expect(resolveLoginMode(p, 'coach')).toBe('coach');
  });

  it('yönetici "Koç olarak gir" seçse de uyarı almaz', () => {
    expect(loginModeNotice(base({ role: 'admin' }), 'coach')).toBe('');
  });
});

describe('onaylı randevu iptali: karşı taraf karar verir', () => {
  const appt = { id: 'ap1', status: 'onay' as const, studentId: 'ogr', coachId: 'koc', cancelDecision: 'pending' as const };

  it('öğrencinin talebine koç karar verir; öğrenci kendi talebine karar veremez', () => {
    const a = { ...appt, cancelRequestedBy: 'ogr' };
    expect(canDecideApprovedCancel(a, 'ogr', { asCoachForThisAppt: false, isAdmin: false })).toBe(false);
    expect(canDecideApprovedCancel(a, 'kocUser', { asCoachForThisAppt: true, isAdmin: false })).toBe(true);
  });

  it('koçun talebine öğrenci karar verir; koç kendi talebine karar veremez', () => {
    const a = { ...appt, cancelRequestedBy: 'kocUser' };
    expect(canDecideApprovedCancel(a, 'kocUser', { asCoachForThisAppt: true, isAdmin: false })).toBe(false);
    expect(canDecideApprovedCancel(a, 'ogr', { asCoachForThisAppt: false, isAdmin: false })).toBe(true);
    expect(canDecideApprovedCancel(a, 'yabanci', { asCoachForThisAppt: false, isAdmin: false })).toBe(false);
    expect(canDecideApprovedCancel(a, 'yonetici', { asCoachForThisAppt: false, isAdmin: true })).toBe(true);
  });
});

describe('koç akışı: arayüz ve veri ayrımı', () => {
  const coaches = read('src/pages/CoachesPage.tsx');
  const cloud = read('src/lib/cloudPlatform.ts');
  const ctx = read('src/context/AppContext.tsx');
  const meeting = read('src/lib/meeting.ts');

  it('öğrenci modundaki ödev listesi yalnız öğrenci olarak alınan ödevler', () => {
    expect(cloud).toMatch(/fetchMyCoachHomework\(studentId: string\)[\s\S]{0,400}\.eq\('student_id', studentId\)/);
    expect(read('src/pages/TasksPage.tsx')).toContain('fetchMyCoachHomework(user.id)');
  });

  it('olmayan Tahsilat ve Çalışma odası sekmeleri kaldırıldı; Randevu sekmesi içerik gösterir', () => {
    expect(coaches).not.toMatch(/'para', 'Tahsilat'|'oda', 'Çalışma odası'|coach_kick_student/);
    expect(coaches).toMatch(/tab === 'randevu' \?/);
    expect(cloud).not.toMatch(/coach_payments|coach_students|pushCoachDesk/);
  });

  it('koç panelinde yalnız koç olarak verilen dersler; dizinde kendi kartı yok', () => {
    expect(coaches).toMatch(/a\.coachId === session\.coachId && a\.studentId !== user\?\.id/);
    expect(coaches).toMatch(/list\.filter\(\(c\) => c\.id !== ownCoachId\)/);
  });

  it('koç panelinden çıkış öğrenci moduna geçer; hesabı kapatmaz', () => {
    expect(coaches).toMatch(/setLoginMode\('student'\)/);
    expect(coaches).not.toMatch(/if \(mine && supabase\) await supabase\.auth\.signOut\(\)/);
  });

  it('Ana Sayfa / Takvim randevularına koçluk dersleri karışmaz', () => {
    expect(meeting).toMatch(/asCoach \? res\.rows : res\.rows\.filter\(\(a\) => a\.studentId === userId\)/);
  });

  it('çıkışta giriş modu ve koç masası cihazda kalmaz', () => {
    expect(ctx).toMatch(/clearLoginMode\(\)/);
    expect(read('src/lib/coaches.ts')).toMatch(/localStorage\.removeItem\(DESK_KEY\)/);
  });

  it('bekleyen koç başvurusu yalnız aynı e-postalı hesaba uygulanır', () => {
    const account = read('src/pages/AccountPage.tsx');
    expect(account).toMatch(/normalizeEmailInput\(p\.email \|\| ''\) !== normalizeEmailInput\(user\.email\)/);
    expect(account).toMatch(/coach_track: coachTrack/);
  });
});

describe('063 SQL', () => {
  const sql = read('supabase/migrations/063_coach_flow_fixes.sql');

  it('koç dizini security definer fonksiyonla, yalnız onaylı ve aktif hesaplar', () => {
    expect(sql).toMatch(/create or replace function public\.coach_directory_rows\(\)[\s\S]*security definer[\s\S]*c\.status = 'active'[\s\S]*p\.account_status = 'active'/);
    expect(sql).toMatch(/create or replace view public\.coach_directory with \(security_invoker = true\)/);
  });

  it('bağlı öğrenci yalnız onaylı / tamamlanmış randevu', () => {
    expect(sql).toMatch(/a\.status in \('onay', 'tamamlandi'\)/);
  });

  it('randevu ve ödeve doğrudan yazma kapalı; kendi saatine randevu yok', () => {
    expect(sql).toMatch(/create policy "appt_update" on public\.appointments for update using \(public\.is_admin\(\)\)/);
    expect(sql).toMatch(/revoke insert, update, delete, truncate, references, trigger on table public\.coach_homeworks/);
    expect(sql).toMatch(/kendi saatine randevu alamazsın/);
  });

  it('iptal kararını talep eden değil karşı taraf verir; slot serbest kalır', () => {
    expect(sql).toMatch(/kendi iptal talebine karşı taraf karar verir/);
    expect(sql).toMatch(/update public\.coach_availability[\s\S]{0,200}status = 'booked'/);
  });

  it('055 tek seferlik "koç rolü" güncellemesi kaldırıldı', () => {
    expect(read('supabase/migrations/055_commercial_readiness.sql')).not.toMatch(/set role = 'coach'/);
    expect(read('supabase/live/apply_050_055_live.sql')).not.toMatch(/set role = 'coach'/);
  });
});
