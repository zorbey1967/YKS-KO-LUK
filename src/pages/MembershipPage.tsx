import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { listMyPayments, paymentStatusLabel, requestCancel, requestCheckout, type PaymentRow } from '../lib/billing';
import {
  CAMPAIGN,
  PLAN_LIST,
  TRIAL_DAYS,
  chargeAmountTry,
  discountPercent,
  formatTry,
  type PlanId,
} from '../lib/plans';
import { billingFromProfile, displayMembershipName, entitledPlan, trialDaysLeft } from '../lib/subscription';
import { startTopPlanTrial } from '../lib/cloudPlatform';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function MembershipPage() {
  const { profile, toast, go, user, refreshAuth, isAdmin } = useApp();
  const snap = billingFromProfile(profile);
  const days = trialDaysLeft(snap);
  const tier = entitledPlan(snap);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [payNote, setPayNote] = useState('');
  const [pays, setPays] = useState<{ rows: PaymentRow[]; available: boolean }>({ rows: [], available: false });
  const [cancelBusy, setCancelBusy] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const planName = displayMembershipName(profile, Date.now(), isAdmin);
  const trialActive = Boolean(user) && tier === 'trial';
  const student = Boolean(user) && profile?.role !== 'coach' && profile?.role !== 'admin';

  useEffect(() => {
    if (!student) return;
    void listMyPayments().then(setPays);
  }, [student]);

  async function pay(planId: PlanId) {
    if (!user) {
      toast('Ödeme için giriş gerekli.');
      go('account');
      return;
    }
    setBusy(planId);
    setPayNote('');
    try {
      const res = await requestCheckout(planId);
      if (res.ready && res.checkout_url) {
        window.location.assign(res.checkout_url);
        return;
      }
      setPayNote(res.error);
      toast('Ödeme sayfası açılamadı. Üyelik değişmedi.');
    } finally {
      setBusy(null);
    }
  }

  async function startTrial() {
    if (!user) {
      toast('Deneme için giriş gerekli.');
      go('account');
      return;
    }
    if (!confirm('14 günlük Premium denemeyi başlatmak istiyor musun? Ücret alınmaz. Aynı hesaba ikinci deneme verilmez.')) return;
    setTrialBusy(true);
    setPayNote('');
    try {
      const res = await startTopPlanTrial();
      setPayNote(res.message);
      toast(res.ok ? res.message : res.message);
      if (res.ok) await refreshAuth();
    } finally {
      setTrialBusy(false);
    }
  }

  async function cancel() {
    setCancelBusy(true);
    const res = await requestCancel();
    toast(res.ok ? 'İptal talebi kaydedildi. Dönem bitene kadar erişim kuralı sunucuda kalır.' : res.error);
    setCancelBusy(false);
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Üyelik</div>
        <h2>Pro ve Premium</h2>
        <p>
          {TRIAL_DAYS} günlük deneme yalnızca e-posta doğrulama ve yönetici onayından sonra sunucuya yazılır.
          Ücretli dönem Shopier’de doğrulanmış tek seferlik çekimle 30 gün açılır. Otomatik yenileme yok.
          Başlangıç paketi: kampanyalı Premium {formatTry(chargeAmountTry('premium'))} / 30 gün (katalog).
          Mevcut aboneliğin kilitli tutarı onayın olmadan değişmez.
        </p>
      </div>

      {student ? (
        <div className="grid stats" style={{ marginTop: 16 }}>
          <div className="card stat">
            <div className="label">PLANIN</div>
            <div className="value" style={{ fontSize: 22 }}>{planName}</div>
            <div className="sub">{trialActive && days ? `${days} gün kaldı` : snap.status === 'active' ? 'Ücretli üyelik' : ''}</div>
          </div>
          {trialActive && snap.trialEndsAt ? (
            <div className="card stat">
              <div className="label">DENEME BİTİŞ</div>
              <div className="value" style={{ fontSize: 18 }}>{fmtDate(snap.trialEndsAt)}</div>
            </div>
          ) : snap.status === 'active' ? (
            <div className="card stat">
              <div className="label">DÖNEM BİTİŞ</div>
              <div className="value" style={{ fontSize: 18 }}>{fmtDate(snap.subscriptionEndsAt)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="plan-compare" style={{ marginTop: 16 }}>
        {PLAN_LIST.map((p) => {
          const off = discountPercent(p.id);
          const now = chargeAmountTry(p.id);
          return (
            <div className={`card plan-tile${tier === p.id ? ' is-current' : ''}`} key={p.id}>
              <div className="section-title">
                <h3>{p.name.toUpperCase()}</h3>
                {CAMPAIGN.active ? <span className="chip">%{off} indirim</span> : null}
              </div>
              <div className="plan-price">
                {CAMPAIGN.active ? <span className="price-was">{formatTry(p.listPriceTry)} / ay</span> : null}
                <span className="price-now">{formatTry(now)}</span>
                <span className="price-period"> / ay</span>
              </div>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                İlk çekim: {formatTry(now)}. Kampanya sürerken sonraki çekim de {formatTry(now)}; kampanya kapanınca yeni çekimler {formatTry(p.listPriceTry)}.
                {CAMPAIGN.endsAt ? '' : ' Kampanya bitiş tarihi yok; sayaç yok.'}
              </p>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Ödeme doğrulanınca 30 günlük dönem başlar. İptal talebi dönemin sonuna kadar erişimi kesmez; kart çekimi ancak sağlayıcı aboneliği varsa durur.
              </p>
              <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {p.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="btn primary" type="button" disabled={busy !== null || !user} onClick={() => void pay(p.id)}>
                  {busy === p.id ? 'Shopier’e gidiliyor…' : !user ? 'Giriş gerekli' : `Shopier ile ${p.name} satın al`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>Yönetici hesabında plan satın alman gerekmez; özellikler sunucu yetkisiyle açıktır.</p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>14 günlük ücretsiz Premium deneme</h3><span>{TRIAL_DAYS} gün</span></div>
        <p className="muted">
          En üst plan (Premium) özellikleri 14 gün açılır. Başlangıç ve bitiş sunucuda yazılır. Ücret alınmaz.
          Aynı hesap ikinci kez deneme alamaz.
          {trialActive && days ? ` Kalan: ${days} gün.` : ''}
        </p>
        {(snap.status === 'expired' && profile?.trial_started_at) || (snap.status !== 'trialing' && snap.status !== 'active' && profile?.trial_started_at && snap.trialEndsAt) ? (
          <p className="notice">Bu hesap denemeyi kullandı. Devam için Pro veya Premium satın al.</p>
        ) : null}
        <div className="actions">
          <button
            className="btn primary"
            type="button"
            disabled={trialBusy || !user || !student || trialActive || snap.status === 'active' || isAdmin}
            onClick={() => void startTrial()}
          >
            {trialBusy ? 'Başlatılıyor…' : trialActive ? `${days} gün kaldı` : '14 günlük ücretsiz denemeyi başlat'}
          </button>
        </div>
      </div>

      {payNote ? <p className="notice" style={{ marginTop: 16 }}>{payNote}</p> : null}
      <p className="muted" style={{ marginTop: 12 }}>
        Shopier ürün sayfasına gitmek veya teşekkür ekranı üyeliği açmaz. Abonelik yalnızca imzalı bildirim ve Shopier sipariş doğrulamasından sonra yazılır.
      </p>

      {student ? (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Ödeme geçmişi</h3></div>
            {!pays.available ? (
              <p className="muted">Ödeme tablosu bu veritabanında yok (016). Sahte geçmiş yok.</p>
            ) : pays.rows.length === 0 ? (
              <p className="muted">Kayıtlı ödeme yok.</p>
            ) : (
              pays.rows.map((r) => (
                <div className="plan-item" key={r.id}>
                  <span>
                    <b>{paymentStatusLabel(r.status)}</b>
                    <br />
                    <small className="muted">{fmtDate(r.createdAt)} • {r.provider || '—'} • {r.providerPaymentId || '—'}</small>
                  </span>
                  <b>{formatTry(r.amountTry)}</b>
                </div>
              ))
            )}
          </div>
          {snap.status === 'active' || trialActive ? (
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn secondary" type="button" disabled={cancelBusy} onClick={() => void cancel()}>
                {cancelBusy ? 'Gönderiliyor…' : 'İptal talebi oluştur'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" type="button" onClick={() => go('account')}>Hesabıma git</button>
      </div>
    </>
  );
}
