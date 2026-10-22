import { useApp } from '../context/AppContext';
import type { ReactNode } from 'react';

export function FeatureLock({
  title,
  children,
  premium = false,
}: {
  title: string;
  children?: ReactNode;
  /** Yapay Zekâ / gelişmiş analiz kilidi: Pro ve deneme de kilitli. */
  premium?: boolean;
}) {
  const { go } = useApp();
  return (
    <div className="card notice" style={{ marginTop: 8 }}>
      <div className="section-title"><h3>{title}</h3></div>
      <p className="muted">
        {premium
          ? 'Bu özellik yalnız Premium üyelikte açılır. Pro ve deneme üyeliğinde temel e-koçluk özellikleri açık kalır.'
          : 'Bu özellik 14 günlük deneme veya ücretli üyelik gerektirir. Yerel tarayıcı ayarı yetki vermez.'}
      </p>
      {children}
      <div className="actions">
        <button className="btn primary" type="button" onClick={() => go('membership')}>{premium ? 'Premium’a geç' : 'Üyelik'}</button>
      </div>
    </div>
  );
}
