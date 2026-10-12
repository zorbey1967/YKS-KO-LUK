import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { commandNav, type PageId } from '../lib/types';
import { pagesAllowedForGate } from '../lib/accessGate';

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { go, isAdmin, profile, accessGate } = useApp();
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const s = q.toLocaleLowerCase('tr-TR');
    const base = commandNav(profile?.role, isAdmin, pagesAllowedForGate(accessGate));
    return base.filter((n) => n.label.toLocaleLowerCase('tr-TR').includes(s) || n.id.includes(s));
  }, [q, isAdmin, profile?.role, accessGate]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  if (!open) return null;
  return (
    <div className="command" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sayfa ara">
      <div className="command-box" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          aria-label="Sayfa ara"
          placeholder="Sayfa ara… (Ctrl/Cmd+K)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && items[0]) {
              go(items[0].id);
              onClose();
            }
          }}
        />
        <div className="command-list">
          {items.length ? items.map((n, i) => (
            <button key={`${n.id}-${n.label}`} type="button" className={i === 0 ? 'is-first' : undefined} onClick={() => { go(n.id as PageId); onClose(); }}>
              {n.label}
            </button>
          )) : <div className="empty" style={{ margin: 12 }}>Eşleşen sayfa yok.</div>}
        </div>
      </div>
    </div>
  );
}
