import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { NAV, type PageId } from '../lib/types';

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { go } = useApp();
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const s = q.toLocaleLowerCase('tr-TR');
    const extra = [
      { id: 'goal' as PageId, icon: '🎯', label: 'Hedefi değiştir' },
      { id: 'goal' as PageId, icon: '🎂', label: 'Yaşı değiştir' },
    ];
    return [...NAV, ...extra].filter((n) => n.label.toLocaleLowerCase('tr-TR').includes(s) || n.id.includes(s));
  }, [q]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  if (!open) return null;
  return (
    <div className="command" onClick={onClose}>
      <div className="command-box" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Sayfa ara… (Ctrl/Cmd+K)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="command-list">
          {items.map((n) => (
            <button key={`${n.id}-${n.label}`} type="button" onClick={() => { go(n.id as PageId); onClose(); }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
