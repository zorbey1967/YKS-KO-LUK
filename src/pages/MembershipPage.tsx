import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { loadSubscription, saveSubscription, trialLabel, type SubState } from '../lib/subscription';

export function MembershipPage() {
  const { profile } = useApp();
  const [sub, setSub] = useState<SubState>(loadSubscription);
  const info = trialLabel(sub);
  const serverPlan = profile?.plan || 'Ücretsiz';

  function startTrial(plan: 'Go' | 'Pro') {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const next: SubState = {
      plan,
      trialStartedAt: start.toISOString(),
      trialEndsAt: end.toISOString(),
      status: 'trial',
    };
    saveSubscription(next);
    setSub(next);
  }

  function cancel() {
    const next = { ...sub, status: 'cancelled' as const };
    saveSubscription(next);
    setSub(next);
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow" style={{ color: '#cfe1ff' }}>Üyelik</div>
        <h2>14 gün dene, kart yok</h2>
        <p>Hesap planı sunucuda: {serverPlan}. Yerel deneme yalnızca arayüz içindir; otomatik tahsilat bağlanmaz.</p>
      </div>
      <div className="notice" style={{ marginTop: 16 }}>{info.badge} — {info.text}</div>
      <div className="grid three" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>🆓 Ücretsiz</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Görev, deneme, konu, YKS soru bankası ve yerel koç.</p>
          <span className="chip">{serverPlan === 'Ücretsiz' ? 'Aktif katman' : serverPlan}</span>
        </div>
        <div className="card">
          <h3>⚡ Go</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Haftalık program, ders ders net, müfredat takibi. 14 gün deneme.</p>
          {sub.plan === 'Go' && sub.status === 'trial' ? <span className="chip">{info.badge}</span> : (
            <button className="btn primary" type="button" onClick={() => startTrial('Go')}>14 gün dene</button>
          )}
        </div>
        <div className="card">
          <h3>💎 Pro</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Gelişmiş analiz ve koç notları. Ödeme sonraki adım; şimdi yalnızca deneme.</p>
          {sub.plan === 'Pro' && sub.status === 'trial' ? <span className="chip">{info.badge}</span> : (
            <button className="btn primary" type="button" onClick={() => startTrial('Pro')}>14 gün dene</button>
          )}
        </div>
      </div>
      {sub.status === 'trial' && (
        <div className="actions">
          <button className="btn danger" type="button" onClick={cancel}>Denemeyi durdur</button>
        </div>
      )}
    </>
  );
}
