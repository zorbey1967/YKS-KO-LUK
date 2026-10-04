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

  useEffect(() => {
    if (page !== 'meeting') return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [page]);

  return (
    <div className={`app${page === 'meeting' ? ' app--meeting' : ''}`}>
      <a
        className="skip-link"
        href="#mainContent"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById('mainContent');
          if (!el) return;
          el.setAttribute('tabindex', '-1');
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        İçeriğe geç
      </a>
      {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)} />}
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
            <button key={n.id} className={page === n.id ? 'active' : ''} type="button" aria-current={page === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
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
                <span>{user?.email || 'Oturum yok'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className={`main${page === 'meeting' ? ' main--meeting' : ''}`} id="mainContent" tabIndex={-1}>
        {page === 'meeting' ? null : (
        <header className="topbar">
          <div className="topbar-lead">
            <button className="icon-btn mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü" aria-expanded={menuOpen}>
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
              <button className="btn secondary" type="button" onClick={() => go('goal')}>Hedefim</button>
            ) : null}
            <button className={user ? 'btn secondary' : 'btn primary'} type="button" onClick={() => go('account')}>{user ? 'Hesabım' : 'Giriş'}</button>
            <button className="btn secondary" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Açık tema' : 'Koyu tema'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</button>
          </div>
        </header>
        )}
        {children}
      </main>
      {toastMsg ? <div className="toast" role="status" aria-live="polite">{toastMsg}</div> : null}
    </div>
  );
}
