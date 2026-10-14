import { useApp } from '../context/AppContext';
import type { ReactNode } from 'react';

export function FeatureLock({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const { go } = useApp();
  return (
    <div className="card notice" style={{ marginTop: 8 }}>
      <div className="section-title"><h3>{title}</h3></div>
      <p className="muted">Bu özellik 14 günlük deneme veya ücretli üyelik gerektirir. Yerel tarayıcı ayarı yetki vermez.</p>
      {children}
      <div className="actions">
        <button className="btn primary" type="button" onClick={() => go('membership')}>Üyelik</button>
      </div>
    </div>
  );
}
