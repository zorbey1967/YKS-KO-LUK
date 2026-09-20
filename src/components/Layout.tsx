import { useApp } from '../context/AppContext';
import { NAV } from '../lib/types';
import { examCountdown } from '../lib/insights';
import { examTitle } from '../lib/stage';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { page, go, menuOpen, setMenuOpen, profile, user, toggleTheme, theme, toastMsg, data } = useApp();
  const item = NAV.find((n) => n.id === page) || NAV[0];
  const count = examCountdown(data.examDate);
  return (
    <div className="app">
      <a className="skip-link" href="#mainContent">İçeriğe geç</a>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">🎓</div>
          <div>
            <strong>Öğrenci E-Koçluk</strong>
            <small>{examTitle(data)} çalışma paneli</small>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
              {n.icon} <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-user">
            <div className="userline">
              <div className="avatar">{(profile?.name || 'Ö').trim().charAt(0).toUpperCase()}</div>
              <div>
                <strong>{profile?.name || (user ? 'Öğrenci' : 'Misafir')}</strong>
                <span>{data.grade} • {data.age} yaş • {count.past ? 'sınav tarihi geçti' : count.label}</span>
                <span>{user?.email || 'Giriş yok — Hesabım'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="main" id="mainContent">
        <header className="topbar">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="icon-btn mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
              ☰
            </button>
            <div>
              <div className="eyebrow">Öğrenci E-Koçluk Sistemi</div>
              <h1>{item.label}</h1>
            </div>
          </div>
          <div className="top-actions">
            <button className="btn secondary" type="button" onClick={() => go('goal')}>🎯 Hedef / yaş</button>
            <button className="btn secondary" type="button" onClick={() => go('account')}>👤 Hesabım</button>
            <button className="icon-btn" type="button" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </header>
        {children}
      </main>
      {toastMsg ? <div className="toast">{toastMsg}</div> : null}
    </div>
  );
}

