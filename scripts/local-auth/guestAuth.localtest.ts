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

describe.skipIf(!schemaMode)('Uçtan uca: tek hesap öğrenci + koç (062)', () => {
  it('6) öğrenci koç başvurur; kendisi onaylayamaz; yönetici onayı rolü öğrenci bırakır', async () => {
    const pw = `Rk${uuid().slice(0, 8)}9a`;
    const email = `cift-${uuid().slice(0, 8)}@example.com`;
    const made = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { intent: 'student', name: 'Çift Rol' } });
    report.dualCreate = made.error ? `HATA: ${made.error.message}` : 'kabul';
    expect(made.error, made.error?.message).toBeNull();
    const uid = made.data.user!.id;

    const s = browser();
    const login = await s.auth.signInWithPassword({ email, password: pw });
    expect(login.error, login.error?.message).toBeNull();
    const app = await s.from('coaches').upsert(
      { user_id: uid, name: 'Çift Rol', email, track: 'YKS Sayısal', focus: 'Deneme', photo: 'data:image/png;base64,AA', student_count: 0, status: 'active' },
      { onConflict: 'user_id' },
    ).select('id, status').single();
    report.dualApply = app.error ? `HATA: ${app.error.message}` : app.data?.status;
    expect(app.error, app.error?.message).toBeNull();
    expect(app.data?.status).toBe('pending');
    const coachId = app.data!.id as string;

    const self = await s.rpc('admin_set_coach_status', { p_id: coachId, p_status: 'active' });
    report.dualSelfApprove = self.error ? 'reddedildi' : 'KABUL (beklenmedik)';
    expect(self.error).not.toBeNull();

    const adminPw = `Rk${uuid().slice(0, 8)}9a`;
    const adminEmail = `yonetici-${uuid().slice(0, 8)}@example.com`;
    const madeAdmin = await admin.auth.admin.createUser({ email: adminEmail, password: adminPw, email_confirm: true });
    expect(madeAdmin.error, madeAdmin.error?.message).toBeNull();
    const promote = await admin.from('profiles').update({ role: 'admin' }).eq('id', madeAdmin.data.user!.id);
    expect(promote.error, promote.error?.message).toBeNull();
    const a = browser();
    expect((await a.auth.signInWithPassword({ email: adminEmail, password: adminPw })).error).toBeNull();
    const approve = await a.rpc('admin_set_coach_status', { p_id: coachId, p_status: 'active' });
    report.dualAdminApprove = approve.error ? `HATA: ${approve.error.message}` : 'kabul';
    expect(approve.error, approve.error?.message).toBeNull();

    const prof = await admin.from('profiles').select('role, account_status').eq('id', uid).single();
    const coach = await admin.from('coaches').select('status').eq('id', coachId).single();
    report.dualAfter = { role: prof.data?.role, coach: coach.data?.status };
    expect(prof.data).toMatchObject({ role: 'student', account_status: 'active' });
    expect(coach.data?.status).toBe('active');

    const tier = await s.rpc('caller_access_tier');
    report.dualStudentTier = tier.error ? `HATA: ${tier.error.message}` : tier.data;
    expect(tier.data).toBe('none');

    // 063: öğrenci onaylı koçu dizinde görür; koç kendi saatine randevu alamaz
    const st = browser();
    const stPw = `Rk${uuid().slice(0, 8)}9a`;
    const stEmail = `ogr-${uuid().slice(0, 8)}@example.com`;
    expect((await admin.auth.admin.createUser({ email: stEmail, password: stPw, email_confirm: true, user_metadata: { name: 'Öğrenci Test' } })).error).toBeNull();
    expect((await st.auth.signInWithPassword({ email: stEmail, password: stPw })).error).toBeNull();
    const dir = await st.from('coach_directory').select('id');
    report.studentSeesDirectory = dir.error ? `HATA: ${dir.error.message}` : (dir.data || []).some((r) => r.id === coachId);
    expect((dir.data || []).some((r) => r.id === coachId)).toBe(true);
    const slot = await s.rpc('add_coach_slot', { p_starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString() });
    expect(slot.error, slot.error?.message).toBeNull();
    const ownSlot = await s.rpc('request_appointment', { p_availability_id: (slot.data as { id: string }).id });
    report.selfBooking = ownSlot.error ? 'reddedildi' : 'KABUL (beklenmedik)';
    expect(ownSlot.error?.message || '').toMatch(/kendi saatine/);
  });

  it('8) "Koç olarak gir": geçici oturum ana istemciye aktarılır; geçici oturum kapatmak aktarılanı bozmaz', async () => {
    const email = `gecis-${uuid().slice(0, 8)}@example.com`;
    const pw = `Rk${uuid().slice(0, 8)}9a`;
    expect((await admin.auth.admin.createUser({ email, password: pw, email_confirm: true })).error).toBeNull();
    const gate = browser();
    const signed = await gate.auth.signInWithPassword({ email, password: pw });
    expect(signed.error, signed.error?.message).toBeNull();
    const main = browser();
    const moved = await main.auth.setSession({
      access_token: signed.data.session!.access_token,
      refresh_token: signed.data.session!.refresh_token,
    });
    report.sessionTransfer = moved.error ? `HATA: ${moved.error.message}` : 'aktarıldı';
    expect(moved.error, moved.error?.message).toBeNull();
    expect((await main.auth.getUser()).data.user?.email).toBe(email);
    // Başvuru / bekleme yolunda geçici oturum yerel kapatılır; başka bir oturum etkilenmez
    const other = browser();
    expect((await other.auth.signInWithPassword({ email, password: pw })).error).toBeNull();
    await other.auth.signOut({ scope: 'local' });
    const still = await main.from('profiles').select('id').limit(1);
    report.localSignOutKeepsOther = still.error ? `HATA: ${still.error.message}` : 'etkilenmedi';
    expect(still.error).toBeNull();
  });

  it('7) koç niyetiyle e-posta kaydı başvuruyu sunucuda beklemede açar; normal kayıt etkilenmez', async () => {
    const email = `koc-kayit-${uuid().slice(0, 8)}@example.com`;
    const r = await browser().auth.signUp({
      email,
      password: `Rk${uuid().slice(0, 8)}9a`,
      options: { data: { name: 'Kayıt Koç', intent: 'coach', coach_track: 'YKS Sözel', coach_focus: 'Paragraf', coach_student_count: '3' } },
    });
    report.coachSignup = r.error ? `HATA: ${r.error.message}` : 'kabul';
    expect(r.error, r.error?.message).toBeNull();
    const row = await admin.from('coaches').select('status, track, student_count, photo').eq('email', email).maybeSingle();
    report.coachSignupRow = row.data || row.error?.message || null;
    expect(row.data).toMatchObject({ status: 'pending', track: 'YKS Sözel', student_count: 3, photo: '' });
    const plain = await browser().auth.signUp({ email: `ogr-kayit-${uuid().slice(0, 8)}@example.com`, password: `Rk${uuid().slice(0, 8)}9a` });
    expect(plain.error, plain.error?.message).toBeNull();
  });
});

describe('rapor', () => {
  it('sonuç özeti', () => {
    console.log(`RK_LOCAL_REPORT ${JSON.stringify({ schemaMode, ...report })}`);
    expect(true).toBe(true);
  });
});
