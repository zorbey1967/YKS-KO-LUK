import { useEffect, useRef, useState } from 'react';
import { claimGuestCheckout, GUEST_STARTED_EVENT, GUEST_WAIT_MS, readGuestCheckout } from '../lib/guestCheckout';

/**
 * Giriş yapmadan başlatılmış ödeme varsa: sayfa açılınca, sekmeye dönünce ve birkaç saniyede bir
 * sunucuya sorar. Ödeme doğrulanmışsa oturumu açar ve sayfayı yeniler (paket ve özellikler gelmiş olur).
 * Ödeme doğrulanmadan hiçbir şey açılmaz.
 */
export function GuestCheckoutWatcher({ signedIn }: { signedIn: boolean }) {
  const [pending, setPending] = useState(() => (signedIn ? null : readGuestCheckout()));
  const [note, setNote] = useState('');
  const [closedNote, setClosedNote] = useState(false);
  const [hidden, setHidden] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const onStart = () => {
      setHidden(false);
      setPending(readGuestCheckout());
    };
    window.addEventListener(GUEST_STARTED_EVENT, onStart);
    return () => window.removeEventListener(GUEST_STARTED_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (signedIn || !pending) return;
    let alive = true;
    const check = async () => {
      if (busy.current || !alive) return;
      busy.current = true;
      try {
        const r = await claimGuestCheckout();
        if (!alive) return;
        if (r === 'signed_in') {
          window.location.reload();
          return;
        }
        if (r === 'closed') setClosedNote(true);
        if (r === 'expired' || r === 'closed' || r === 'none') {
          setPending(null);
          return;
        }
        if (r === 'error') setNote('Ödeme durumu şu an kontrol edilemiyor. Bağlantını kontrol et.');
      } finally {
        busy.current = false;
      }
    };
    void check();
    // Ödeme sayfasındayken birkaç saniyede bir sorulur; süre dolunca yalnız sayfa açılışında/dönüşte sorulur.
    const withinWait = () => !pending.startedAt || Date.now() - pending.startedAt <= GUEST_WAIT_MS;
    const timer = window.setInterval(() => {
      if (!withinWait()) {
        setNote('Ödemeyi tamamladıysan sayfayı yenilediğinde hesabın açılır.');
        return;
      }
      if (document.visibilityState === 'visible') void check();
    }, 5000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [signedIn, pending]);

  if (!signedIn && closedNote && !hidden) {
    // Giriş anahtarı tek kullanımlık: kullanıldıysa (başka sekme/cihaz veya yarıda kalan deneme) burada tekrar açılmaz.
    return (
      <div className="notice guest-pay-wait" role="status" aria-live="polite">
        <b>Bu ödeme için giriş bağlantısı zaten kullanıldı.</b>{' '}
        Hesabına giremiyorsan Shopier’in gönderdiği sipariş e-postasındaki satıcı iletişim bilgisinden, sipariş numaranla bize yaz.{' '}
        <button className="btn secondary" type="button" onClick={() => setHidden(true)}>
          Kapat
        </button>
      </div>
    );
  }
  if (signedIn || !pending || hidden) return null;
  return (
    <div className="notice guest-pay-wait" role="status" aria-live="polite">
      <b>Ödemen bekleniyor.</b>{' '}
      Shopier’de ödemeyi tamamlayınca bu sayfa kendiliğinden hesabını açar ve paketin tanımlanır.
      {note ? <span> {note}</span> : null}{' '}
      <button className="btn secondary" type="button" onClick={() => setHidden(true)}>
        Gizle
      </button>
    </div>
  );
}
