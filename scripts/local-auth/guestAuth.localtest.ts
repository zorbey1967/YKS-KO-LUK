/**
 * YEREL Supabase testi (Docker, `supabase start`). Canlı projeye ASLA bağlanmaz: adres yalnız
 * 127.0.0.1/localhost olabilir. Gizli değer yazdırılmaz; yerel anahtarlar ortamdan okunur.
 *
 * Sınar:
 *  1) `.invalid` uzantılı giriş kimliğiyle hesap açılabiliyor mu (Auth admin createUser)
 *  2) Aynı kimlikle ikinci hesap açılamıyor mu
 *  3) Ödeme sonrası oturum teslimi: generateLink(magiclink) → tarayıcı verifyOtp → oturum; özet tek kullanımlık
 *  4) (Şema varsa) uçtan uca: misafir ödeme → hesap (tetikleyici) → oturum bağlama → paket (054/055)
 *     → tekrar gelen bildirim ikinci hesap / ödeme / süre üretmiyor; öğrenci tabloyu göremiyor
 *  5) Bilgi: herkese açık signUp aynı alan adını kabul ediyor mu
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  applyGuestPayment,
  claimGuestLogin,
  claimTokenHash,
  guestClaimState,
  guestEmailFor,
  newClaimToken,
  type GuestRow,
} from '../../supabase/functions/_shared/guestCheckout.ts';

const url = String(process.env.SB_API_URL || process.env.LOCAL_SB_URL || '').trim();
const anonKey = String(process.env.SB_ANON_KEY || process.env.SB_PUBLISHABLE_KEY || '').trim();
const serviceKey = String(process.env.SB_SERVICE_ROLE_KEY || process.env.SB_SECRET_KEY || '').trim();
const schemaMode = String(process.env.RK_LOCAL_SCHEMA || '') === '1';

function localOnly(u: string) {
  try {
    const h = new URL(u).hostname;
    return h === '127.0.0.1' || h === 'localhost';
  } catch {
    return false;
  }
}

if (!url || !anonKey || !serviceKey) throw new Error('Yerel Supabase ortamı yok (SB_API_URL / SB_ANON_KEY / SB_SERVICE_ROLE_KEY).');
if (!localOnly(url)) throw new Error('REDDEDILDI: bu test yalnız yerel Supabase ile çalışır.');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' } });
const uuid = () => crypto.randomUUID();
const report: Record<string, unknown> = {};

describe('Auth: .invalid giriş kimliği ve oturum teslimi', () => {
  it('1) .invalid kimlikle hesap açılır; 2) aynı kimlikle ikinci hesap açılamaz', async () => {
    const email = guestEmailFor(uuid());
    const a = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { intent: 'student', source: 'shopier_guest' } });
    report.createUser = a.error ? `HATA: ${a.error.message}` : 'kabul';
    expect(a.error, a.error?.message).toBeNull();
    expect(a.data.user?.email).toBe(email);
    const b = await admin.auth.admin.createUser({ email, email_confirm: true });
    report.duplicateCreateUser = b.error ? 'reddedildi' : 'KABUL (beklenmedik)';
    expect(b.error).not.toBeNull();
  });

  it('3) ödeme sonrası oturum: giriş özeti tarayıcıda oturum açar ve ikinci kez kullanılamaz', async () => {
    const email = guestEmailFor(uuid());
    const made = await admin.auth.admin.createUser({ email, email_confirm: true });
    expect(made.error, made.error?.message).toBeNull();
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    report.generateLink = link.error ? `HATA: ${link.error.message}` : 'kabul';
    expect(link.error, link.error?.message).toBeNull();
    const tokenHash = link.data.properties?.hashed_token || '';
    expect(tokenHash).toMatch(/^[0-9a-f]{20,}$/i);

    const b1 = browser();
    const v1 = await b1.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    report.verifyOtp = v1.error ? `HATA: ${v1.error.message}` : 'oturum açıldı';
    expect(v1.error, v1.error?.message).toBeNull();
    expect(v1.data.session?.user.id).toBe(made.data.user?.id);

    const v2 = await browser().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    report.verifyOtpReuse = v2.error ? 'reddedildi' : 'KABUL (beklenmedik)';
    expect(v2.error).not.toBeNull();

    // Şifre belirleme (başka cihazdan giriş için) çalışıyor mu
    const pw = `Rk${uuid().slice(0, 8)}9a`;
    const up = await b1.auth.updateUser({ password: pw });
    report.setPassword = up.error ? `HATA: ${up.error.message}` : 'kabul';
    expect(up.error, up.error?.message).toBeNull();
    const login = await browser().auth.signInWithPassword({ email, password: pw });
    report.passwordLogin = login.error ? `HATA: ${login.error.message}` : 'giriş yapıldı';
    expect(login.error, login.error?.message).toBeNull();
  });

  it('5) bilgi: herkese açık signUp aynı alan adını kabul ediyor mu (karar için kayıt)', async () => {
    const r = await browser().auth.signUp({ email: guestEmailFor(uuid()), password: `Rk${uuid().slice(0, 8)}9a` });
    report.publicSignUpSameDomain = r.error ? `reddedildi: ${r.error.message}` : 'kabul';
    expect(true).toBe(true);
  });
});

describe.skipIf(!schemaMode)('Uçtan uca: misafir ödeme → hesap → paket → tekrar bildirim', () => {
  it('4) hesap ve paket bir kez oluşur; tekrar bildirim etkisiz; öğrenci tabloyu göremez', async () => {
    const token = newClaimToken();
    const ins = await admin.from('billing_guest_checkouts').insert({
      plan_id: 'pro', amount_try: 100, currency: 'TRY', status: 'redirected', provider: 'shopier',
      provider_session_id: `prod_local_${uuid().slice(0, 8)}`, claim_token_hash: await claimTokenHash(token),
    }).select('*').single();
    expect(ins.error, ins.error?.message).toBeNull();
    const guest = ins.data as GuestRow;
    const orderId = `ord_local_${uuid().slice(0, 8)}`;

    // Ödemeden önce oturum yok
    expect(guestClaimState(guest)).toBe('pending');

    const first = await applyGuestPayment(admin as never, { guest, planId: 'pro', orderId });
    report.firstDelivery = first;
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.createdUser).toBe(true);

    const prof = await admin.from('profiles').select('role, account_status, plan, subscription_status, subscription_ends_at, email').eq('id', first.userId).single();
    expect(prof.error, prof.error?.message).toBeNull();
    expect(prof.data).toMatchObject({ role: 'student', account_status: 'active', plan: 'pro', subscription_status: 'active', email: guestEmailFor(guest.id) });
    const endsBefore = prof.data?.subscription_ends_at;

    // Tekrar gelen bildirim (güncel satırla, webhook'un yapacağı gibi)
    const again = await admin.from('billing_guest_checkouts').select('*').eq('id', guest.id).single();
    const second = await applyGuestPayment(admin as never, { guest: again.data as GuestRow, planId: 'pro', orderId });
    report.secondDelivery = second;
    expect(second).toMatchObject({ ok: true, userId: first.userId, createdUser: false, duplicatePayment: true });
    const prof2 = await admin.from('profiles').select('subscription_ends_at').eq('id', first.userId).single();
    expect(prof2.data?.subscription_ends_at).toBe(endsBefore);
    const pays = await admin.from('billing_payments').select('id').eq('provider', 'shopier').eq('provider_payment_id', orderId);
    expect(pays.data?.length).toBe(1);
    const accounts = await admin.from('profiles').select('id').eq('email', guestEmailFor(guest.id));
    expect(accounts.data?.length).toBe(1);

    // Ödeme sonrası: anahtar tek bir giriş özeti verir (billing-guest "status" ile aynı kod); tarayıcı oturum açar
    const paid = await admin.from('billing_guest_checkouts').select('*').eq('id', guest.id).single();
    const paidRow = paid.data as GuestRow;
    expect(guestClaimState(paidRow)).toBe('ready');
    const claim1 = await claimGuestLogin(admin as never, paidRow);
    report.claimFirst = claim1.ok ? 'ozet verildi' : claim1.status;
    expect(claim1.ok).toBe(true);
    if (!claim1.ok) return;
    const b = browser();
    const v = await b.auth.verifyOtp({ token_hash: claim1.tokenHash, type: 'magiclink' });
    expect(v.error, v.error?.message).toBeNull();
    expect(v.data.session?.user.id).toBe(first.userId);

    // Aynı anahtarla ikinci talep (eski satır bilgisiyle, eşzamanlı istek gibi): veritabanı koşulu reddeder
    const claim2 = await claimGuestLogin(admin as never, paidRow);
    report.claimSecondStale = claim2.ok ? 'OZET VERILDI (beklenmedik)' : claim2.status;
    expect(claim2).toEqual({ ok: false, status: 'closed' });
    const reuse = await browser().auth.verifyOtp({ token_hash: claim1.tokenHash, type: 'magiclink' });
    expect(reuse.error).not.toBeNull();

    // Şifre belirlendikten sonra eski anahtar tekrar giriş açmaz
    const pw = `Rk${uuid().slice(0, 8)}9a`;
    const setPw = await b.auth.updateUser({ password: pw });
    expect(setPw.error, setPw.error?.message).toBeNull();
    const after = await admin.from('billing_guest_checkouts').select('*').eq('id', guest.id).single();
    const claim3 = await claimGuestLogin(admin as never, after.data as GuestRow);
    report.claimAfterPassword = claim3.ok ? 'OZET VERILDI (beklenmedik)' : claim3.status;
    expect(claim3).toEqual({ ok: false, status: 'closed' });
    const pwLogin = await browser().auth.signInWithPassword({ email: guestEmailFor(guest.id), password: pw });
    expect(pwLogin.error, pwLogin.error?.message).toBeNull();

    // Öğrenci (kendi oturumuyla) misafir ödeme tablosunu göremez
    const peek = await b.from('billing_guest_checkouts').select('id').limit(1);
    report.studentReadsGuestTable = peek.error ? 'reddedildi' : `satır: ${peek.data?.length ?? 0}`;
    expect(Boolean(peek.error) || (peek.data?.length ?? 0) === 0).toBe(true);
    const mine = await b.from('profiles').select('plan, subscription_status').eq('id', first.userId).single();
    expect(mine.data).toMatchObject({ plan: 'pro', subscription_status: 'active' });
  });
});

describe('rapor', () => {
  it('sonuç özeti', () => {
    console.log(`RK_LOCAL_REPORT ${JSON.stringify({ schemaMode, ...report })}`);
    expect(true).toBe(true);
  });
});
