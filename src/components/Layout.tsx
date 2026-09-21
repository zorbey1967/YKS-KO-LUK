import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ADMIN_NAV, MEETING_NAV, NAV, displayAge, displayText } from '../lib/types';
import { examCountdown } from '../lib/insights';
import { examTitle } from '../lib/stage';
import { SITE_NAME, SITE_ORIGIN, copySiteUrl } from '../lib/site';
import { isSupabaseConfigured } from '../lib/supabase';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { page, go, menuOpen, setMenuOpen, profile, user, toggleTheme, theme, toastMsg, toast, data, isAdmin, cloudStatus } = useApp();
  const nav = isAdmin ? [NAV[0], ADMIN_NAV, ...NAV.slice(1)] : NAV;
  const item = nav.find((n) => n.id === page) || (page === 'admin' ? ADMIN_NAV : page === 'meeting' ? MEETING_NAV : NAV[0]);
  const count = examCountdown(data.examDate);

  useEffect(() => {
    document.title = `${page === 'account' && !user ? 'Giriş' : item.label} | ${SITE_NAME}`;
  }, [item.label, page, user]);

  return (
    <div className="app">
      <a className="skip-link" href="#mainContent">İçeriğe geç</a>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">🎓</div>
          <div className="brand-copy">
            <strong>{SITE_NAME}</strong>
            <small>{examTitle(data)} çalışma paneli</small>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
              {n.icon} <span>{n.id === 'account' && !user ? 'Giriş' : n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-user">
            <div className="userline">
              <div className="avatar">{(profile?.name || SITE_NAME).trim().charAt(0).toUpperCase()}</div>
              <div className="userline-text">
                <strong>{profile?.name || (user ? 'Öğrenci' : 'Misafir')}</strong>
                <span>{displayText(data.grade)} • {displayAge(data.age)} • {data.examDate ? (count.past ? 'sınav tarihi geçti' : count.label) : 'sınav tarihi belirtilmedi'}</span>
                <span>{user?.email || 'Giriş yok — Hesabım'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="main" id="mainContent">
        <header className="topbar">
          <div className="topbar-lead">
            <button className="icon-btn mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
              ☰
            </button>
            <div>
              <div className="eyebrow">{SITE_NAME}</div>
              <h1>{page === 'account' && !user ? 'Giriş' : item.label}</h1>
            </div>
            {page === 'home' ? (
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  void copySiteUrl().then((ok) => toast(ok ? 'Adres kopyalandı' : SITE_ORIGIN));
                }}
              >
                Paylaş
              </button>
            ) : null}
          </div>
          <div className="top-actions">
            {!isSupabaseConfigured() ? <span className="chip">{cloudStatus === 'Yapılandırılmadı' ? 'Bulut ayarı yok' : cloudStatus}</span> : null}
            {user ? (
              <button className="btn secondary" type="button" onClick={() => go('goal')}>Hedef / yaş</button>
            ) : null}
            <button className={user ? 'btn secondary' : 'btn primary'} type="button" onClick={() => go('account')}>{user ? 'Hesabım' : 'Giriş'}</button>
            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Tema">{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </header>
        {children}
      </main>
      {toastMsg ? <div className="toast">{toastMsg}</div> : null}
    </div>
  );
}
