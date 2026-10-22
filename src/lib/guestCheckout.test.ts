import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyGuestPayment,
  claimGuestLogin,
  claimTokenHash,
  claimTokenShapeOk,
  GUEST_CLAIM_WINDOW_MS,
  guestClaimState,
  guestEmailFor,
  guestReusable,
  isGuestEmail,
  newClaimToken,
  type GuestRow,
} from '../../supabase/functions/_shared/guestCheckout.ts';
import { GUEST_EMAIL_DOMAIN, isGuestAccountEmail } from './guestCheckout';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const GID = '0b4f6c2e-1a2b-4c3d-8e9f-001122334455';

const guest = (p: Partial<GuestRow> = {}): GuestRow => ({
  id: GID, plan_id: 'pro', amount_try: 100, currency: 'TRY', status: 'redirected', provider: 'shopier',
  provider_session_id: 'prod_1', user_id: null, checkout_session_id: null, provider_order_id: null,
  created_at: new Date().toISOString(), paid_at: null, claimed_at: null, ...p,
});

/** Supabase admin istemcisinin bu akışta kullanılan küçük bir taklidi (ağ yok). */
function fakeAdmin(opts: { existingUserId?: string | null; createFails?: boolean; applyDuplicate?: boolean } = {}) {
  const calls = { createUser: 0, attach: [] as unknown[], apply: [] as unknown[], updates: [] as unknown[] };
  let profileUser = opts.existingUserId ?? null;
  const admin = {
    auth: {
      admin: {
        async createUser(args: { email: string }) {
          calls.createUser += 1;
          if (opts.createFails) return { data: null, error: { message: 'already registered' } };
          profileUser = 'u-new';
          expect(args.email).toBe(guestEmailFor(GID));
          return { data: { user: { id: 'u-new' } }, error: null };
        },
      },
    },
    from(table: string) {
      const q = {
        select() { return q; },
        eq() { return q; },
        async maybeSingle() { return { data: table === 'profiles' && profileUser ? { id: profileUser } : null, error: null }; },
        update(v: unknown) { calls.updates.push({ table, v }); return { eq: async () => ({ error: null }) }; },
      };
      return q;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'guest_checkout_attach') { calls.attach.push(args); return { data: 'chk-1', error: null }; }
      if (name === 'apply_verified_payment') {
        calls.apply.push(args);
        return { data: { ok: true, duplicate_payment: Boolean(opts.applyDuplicate), late_payment: false }, error: null };
      }
      return { data: null, error: { message: 'bilinmeyen rpc' } };
    },
  };
  return { admin: admin as never, calls };
}

describe('hesapsız ödeme anahtarı', () => {
  it('anahtar 32 bayt rastgele, biçimi sıkı; veritabanına yalnız özet gider', async () => {
    const a = newClaimToken();
    const b = newClaimToken();
    expect(a).not.toBe(b);
    expect(claimTokenShapeOk(a)).toBe(true);
    for (const bad of ['', 'x', `${a}=`, `${a.slice(0, 42)}+`, 42, null]) expect(claimTokenShapeOk(bad)).toBe(false);
    const h = await claimTokenHash(a);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(a);
    expect(await claimTokenHash(a)).toBe(h);
  });

  it('giriş kimliği bu ödemeye bağlı ve gerçek posta alamaz (.invalid)', () => {
    expect(guestEmailFor(GID)).toBe(`rk-${GID}@misafir.rubikkocluk.invalid`);
    expect(GUEST_EMAIL_DOMAIN).toBe('misafir.rubikkocluk.invalid');
    expect(isGuestEmail(guestEmailFor(GID))).toBe(true);
    expect(isGuestAccountEmail(guestEmailFor(GID))).toBe(true);
    expect(isGuestAccountEmail('ali@example.com')).toBe(false);
    expect(() => guestEmailFor('../x@evil')).toThrow();
  });

  it('oturum yalnız ödemesi doğrulanmış ve süresi geçmemiş kayıtta', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(guestClaimState(guest(), now)).toBe('pending');
    expect(guestClaimState(guest({ status: 'paid', user_id: null, paid_at: '2026-10-22T11:00:00Z' }), now)).toBe('pending');
    expect(guestClaimState(guest({ status: 'paid', user_id: 'u1', paid_at: null }), now)).toBe('pending');
    expect(guestClaimState(guest({ status: 'paid', user_id: 'u1', paid_at: '2026-10-22T11:00:00Z' }), now)).toBe('ready');
    expect(guestClaimState(guest({ status: 'paid', user_id: 'u1', paid_at: new Date(now - GUEST_CLAIM_WINDOW_MS - 1).toISOString() }), now)).toBe('expired');
    expect(guestClaimState(guest({ status: 'failed' }), now)).toBe('closed');
  });

  it('anahtar tek kullanımlık ve 24 saat: bir kez kullanıldıysa hemen kapanır', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const paid = { status: 'paid', user_id: 'u1', paid_at: '2026-10-22T11:00:00Z' } as const;
    expect(GUEST_CLAIM_WINDOW_MS).toBe(24 * 3_600_000);
    expect(guestClaimState(guest({ ...paid }), now)).toBe('ready');
    expect(guestClaimState(guest({ ...paid, claimed_at: new Date(now - 1).toISOString() }), now)).toBe('closed');
    expect(guestClaimState(guest({ ...paid, claimed_at: 'bozuk' }), now)).toBe('closed');
    expect(guestClaimState(guest({ ...paid, paid_at: '2026-10-21T11:59:00Z' }), now)).toBe('expired');
  });

  it('ödenmemiş link aynı plan için 6 saat yeniden kullanılır', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(guestReusable(guest({ created_at: '2026-10-22T09:00:00Z' }), 'pro', now)).toBe(true);
    expect(guestReusable(guest({ created_at: '2026-10-22T05:00:00Z' }), 'pro', now)).toBe(false);
    expect(guestReusable(guest({ created_at: '2026-10-22T09:00:00Z' }), 'premium', now)).toBe(false);
    expect(guestReusable(guest({ status: 'paid', created_at: '2026-10-22T09:00:00Z' }), 'pro', now)).toBe(false);
  });
});

describe('doğrulanmış ödemede hesap + paket', () => {
  it('ilk teslimat: hesap açılır, oturum bağlanır, paket 054 ile yazılır, kayıt ödendi olur', async () => {
    const { admin, calls } = fakeAdmin();
    const r = await applyGuestPayment(admin, { guest: guest(), planId: 'pro', orderId: 'ord_1' });
    expect(r).toMatchObject({ ok: true, userId: 'u-new', createdUser: true, duplicatePayment: false });
    expect(calls.createUser).toBe(1);
    expect(calls.attach).toEqual([{ p_guest_id: GID, p_user_id: 'u-new', p_order_id: 'ord_1' }]);
    expect(calls.apply[0]).toMatchObject({ p_user_id: 'u-new', p_plan_id: 'pro', p_provider: 'shopier', p_payment_id: 'ord_1', p_amount_try: 100, p_checkout_id: 'chk-1' });
    expect(calls.updates).toHaveLength(1);
  });

  it('tekrar teslimat: hesap zaten bağlıysa yeni hesap açılmaz; 054 duplicate döner', async () => {
    const { admin, calls } = fakeAdmin({ applyDuplicate: true });
    const r = await applyGuestPayment(admin, { guest: guest({ user_id: 'u-old', status: 'paid', paid_at: '2026-10-22T11:00:00Z' }), planId: 'pro', orderId: 'ord_1' });
    expect(r).toMatchObject({ ok: true, userId: 'u-old', createdUser: false, duplicatePayment: true });
    expect(calls.createUser).toBe(0);
  });

  it('eşzamanlı teslimat: hesap az önce açıldıysa aynı hesap bulunur, ikinci hesap yok', async () => {
    const { admin, calls } = fakeAdmin({ existingUserId: 'u-race' });
    const r = await applyGuestPayment(admin, { guest: guest(), planId: 'pro', orderId: 'ord_1' });
    expect(r).toMatchObject({ ok: true, userId: 'u-race', createdUser: false });
    expect(calls.createUser).toBe(0);
  });

  it('hesap açılamazsa paket yazılmaz ve hata döner (webhook 500, Shopier tekrar dener)', async () => {
    const { admin, calls } = fakeAdmin({ createFails: true });
    const r = await applyGuestPayment(admin, { guest: guest(), planId: 'pro', orderId: 'ord_1' });
    expect(r.ok).toBe(false);
    expect(calls.attach).toHaveLength(0);
    expect(calls.apply).toHaveLength(0);
  });
});

/** claimGuestLogin için: koşullu güncelleme (.is claimed_at null) ve magic link taklidi. */
function claimAdmin(opts: { markRows?: number; markError?: boolean; linkError?: boolean } = {}) {
  const calls = { marks: [] as unknown[], links: 0, rollbacks: [] as unknown[] };
  const admin = {
    auth: {
      admin: {
        async generateLink(args: { type: string; email: string }) {
          calls.links += 1;
          expect(args).toEqual({ type: 'magiclink', email: guestEmailFor(GID) });
          if (opts.linkError) return { data: null, error: { message: 'gotrue' } };
          return { data: { properties: { hashed_token: `h${calls.links}` } }, error: null };
        },
      },
    },
    from() {
      return {
        update(v: Record<string, unknown>) {
          if (v.claimed_at === null) {
            return { eq: () => ({ eq: async (_c: string, at: unknown) => { calls.rollbacks.push(at); return { error: null }; } }) };
          }
          return {
            eq: () => ({
              is: (col: string, val: unknown) => ({
                async select() {
                  calls.marks.push({ col, val, v });
                  if (opts.markError) return { data: null, error: { message: 'db' } };
                  return { data: Array.from({ length: opts.markRows ?? 1 }, () => ({ id: GID })), error: null };
                },
              }),
            }),
          };
        },
      };
    },
  };
  return { admin: admin as never, calls };
}

describe('tek kullanımlık giriş özeti (claimGuestLogin)', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  const paid = () => guest({ status: 'paid', user_id: 'u1', paid_at: '2026-10-22T11:00:00Z' });

  it('ilk istek: claimed_at boştan doldurulur, SONRA tek özet üretilir', async () => {
    const { admin, calls } = claimAdmin();
    expect(await claimGuestLogin(admin, paid(), now)).toEqual({ ok: true, tokenHash: 'h1' });
    expect(calls.marks).toEqual([{ col: 'claimed_at', val: null, v: { claimed_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() } }]);
    expect(calls.links).toBe(1);
  });

  it('eşzamanlı ikinci istek (satır zaten işaretli): özet ÜRETİLMEZ, closed', async () => {
    const { admin, calls } = claimAdmin({ markRows: 0 });
    expect(await claimGuestLogin(admin, paid(), now)).toEqual({ ok: false, status: 'closed' });
    expect(calls.links).toBe(0);
  });

  it('kullanılmış anahtar (şifre sonradan belirlense de): veritabanına bile gitmeden closed', async () => {
    const { admin, calls } = claimAdmin();
    const used = guest({ status: 'paid', user_id: 'u1', paid_at: '2026-10-22T11:00:00Z', claimed_at: '2026-10-22T11:30:00Z' });
    expect(await claimGuestLogin(admin, used, now)).toEqual({ ok: false, status: 'closed' });
    expect(calls.marks).toHaveLength(0);
    expect(calls.links).toBe(0);
  });

  it('işaret yazılamazsa özet verilmez (error)', async () => {
    const { admin, calls } = claimAdmin({ markError: true });
    expect(await claimGuestLogin(admin, paid(), now)).toEqual({ ok: false, status: 'error' });
    expect(calls.links).toBe(0);
  });

  it('özet üretilemezse işaret geri alınır (hiç özet verilmedi; tekrar denemek güvenli)', async () => {
    const { admin, calls } = claimAdmin({ linkError: true });
    expect(await claimGuestLogin(admin, paid(), now)).toEqual({ ok: false, status: 'error' });
    expect(calls.rollbacks).toEqual([new Date(now).toISOString()]);
  });

  it('ödenmemiş / süresi geçmiş kayıtta özet yok', async () => {
    const { admin, calls } = claimAdmin();
    expect(await claimGuestLogin(admin, guest(), now)).toEqual({ ok: false, status: 'pending' });
    expect(await claimGuestLogin(admin, guest({ status: 'paid', user_id: 'u1', paid_at: '2026-10-20T11:00:00Z' }), now)).toEqual({ ok: false, status: 'expired' });
    expect(calls.links).toBe(0);
  });
});

describe('uçların sözleşmesi', () => {
  it('webhook: misafir yolu imza, sipariş çekme ve iade kontrollerinden SONRA ve shopierActivateOk ile', () => {
    const hook = read('supabase/functions/billing-webhook/index.ts');
    const sig = hook.indexOf('shopierWebhookAuth(raw, signature, secrets.webhookToken)');
    const fetchAt = hook.indexOf('shopierGetOrder(secrets.pat, orderId)');
    const refundAt = hook.indexOf('if (/refund/i.test(eventName))');
    const guestAt = hook.indexOf('from("billing_guest_checkouts")');
    const applyAt = hook.indexOf('applyGuestPayment(admin');
    expect(sig).toBeGreaterThan(0);
    expect(fetchAt).toBeGreaterThan(sig);
    expect(refundAt).toBeGreaterThan(fetchAt);
    expect(guestAt).toBeGreaterThan(refundAt);
    expect(applyAt).toBeGreaterThan(hook.indexOf('shopierActivateOk({', guestAt));
  });

  it('billing-guest: istemci tutarı reddedilir, fiyat katalogdan; oturum özeti yalnız "ready" durumunda', () => {
    const fn = read('supabase/functions/billing-guest/index.ts');
    expect(fn).toMatch(/body\.amount != null \|\| body\.price != null/);
    expect(fn).toMatch(/const amountTry = chargeAmountTry\(planId\)/);
    expect(fn).not.toMatch(/body\.(user_id|email|role|status|paid)/);
    expect(fn).toMatch(/claim_token_hash: await claimTokenHash\(token\)/);
    // Giriş özeti yalnız tek kullanımlık claimGuestLogin'den; uçta doğrudan magic link yok
    expect(fn).toMatch(/const claim = await claimGuestLogin\(admin, row\)/);
    expect(fn).not.toMatch(/generateLink/);
    expect(fn).toMatch(/if \(claim\.status === "error"\) return json\(req, \{ error: [^}]+\}, 503\)/);
    expect(fn).toMatch(/token_hash: claim\.tokenHash/);
    expect(read('supabase/config.toml')).toMatch(/\[functions\.billing-guest\]\s*\nverify_jwt = false/);
  });

  it('istemci: plan dışında bir şey göndermez; anahtar yalnız bu tarayıcıda', () => {
    const c = read('src/lib/guestCheckout.ts');
    expect(c).toMatch(/invokeGuest\(\{ action: 'start', plan_id: planId, token:/);
    expect(c).not.toMatch(/amount|price|user_id/);
    expect(c).toMatch(/verifyOtp\(\{ token_hash: tokenHash, type: 'magiclink' \}\)/);
    // Üyelik sayfası: misafir → dinamik misafir ödeme (doğrudan Shopier), girişli → mevcut ödeme akışı.
    const page = read('src/pages/MembershipPage.tsx');
    expect(page).toMatch(/const res = await startGuestCheckout\(planId\);/);
    expect(page).toMatch(/const tab = window\.open\('', '_blank'\);\s*if \(tab\) tab\.opener = null;/);
    expect(page).toMatch(/tab\.location\.href = res\.url;/);
    expect(page).toMatch(/const res = await requestCheckout\(planId\);/);
    // Sabit (eşlemesiz) Shopier ürün linkleri kullanılmaz: hesap/paket eşlemesi kopardı.
    expect(page).not.toMatch(/shopier\.com\/onlineekocluk|SHOPIER_PAY_LINKS/);
    // İstemci tutar göndermez; plan dışında bir şey göndermez.
    expect(page).not.toMatch(/startGuestCheckout\([^)]*amount/);
  });

  it('istemci: kullanılmış anahtarda takılmaz; anahtarı siler ve açıklama gösterir', () => {
    const c = read('src/lib/guestCheckout.ts');
    expect(c).toMatch(/status === 'expired' \|\| status === 'closed' \|\| status === 'unknown'\) \{\n\s*clearGuestCheckout\(\);/);
    const w = read('src/components/GuestCheckoutWatcher.tsx');
    expect(w).toMatch(/if \(r === 'closed'\) setClosedNote\(true\);/);
    expect(w).toMatch(/Bu ödeme için giriş bağlantısı zaten kullanıldı\./);
    expect(w).toMatch(/if \(r === 'expired' \|\| r === 'closed' \|\| r === 'none'\) \{\n\s*setPending\(null\);/);
  });
});
