export type SubState = {
  plan: 'Go' | 'Pro' | '';
  trialStartedAt: string;
  trialEndsAt: string;
  status: 'trial' | 'cancelled' | '';
};

const KEY = 'yks_sub_v1';

export function loadSubscription(): SubState {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      plan: x.plan === 'Pro' || x.plan === 'Go' ? x.plan : '',
      trialStartedAt: String(x.trialStartedAt || ''),
      trialEndsAt: String(x.trialEndsAt || ''),
      status: x.status === 'trial' || x.status === 'cancelled' ? x.status : '',
    };
  } catch {
    return { plan: '', trialStartedAt: '', trialEndsAt: '', status: '' };
  }
}

export function saveSubscription(s: SubState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export function trialLabel(s: SubState) {
  if (!s.trialStartedAt || s.status === 'cancelled') return { badge: 'Henüz başlatılmadı', text: 'Bir plan seçtiğinde 14 günlük deneme süresi başlatılabilir. Kart çekimi bağlı değildir.' };
  const end = new Date(s.trialEndsAt);
  const left = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  if (s.status === 'trial' && left > 0) {
    return { badge: `${s.plan} deneme • ${left} gün`, text: `${s.plan} paketi denemedesin. Bitiş: ${end.toLocaleDateString('tr-TR')}. Otomatik tahsilat yok.` };
  }
  return { badge: 'Deneme bitti', text: 'Deneme süresi doldu. Gerçek abonelik için ödeme sağlayıcısı sonraki adımda bağlanacak.' };
}
