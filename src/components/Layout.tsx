import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ADMIN_NAV, MEETING_NAV, NAV, sidebarNav, displayAge, displayText } from '../lib/types';
import { pagesAllowedForGate } from '../lib/accessGate';
import { examCountdown } from '../lib/insights';
import { examTitle } from '../lib/stage';
import { primaryExam } from '../lib/examTargets';
import { SITE_NAME } from '../lib/site';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCoachDisplayName, getPersonDisplayName } from '../lib/displayName';
import type { ReactNode } from 'react';
import { openZorro } from '../lib/zorroBus';

export function Layout({ children }: { children: ReactNode }) {
  const { page, go, menuOpen, setMenuOpen, profile, user, toggleTheme, theme, toastMsg, data, isAdmin, cloudStatus, accessGate } = useApp();
  const isCoach = profile?.role === 'coach';
  const displayName = isCoach
    ? getCoachDisplayName(profile?.name)
    : getPersonDisplayName(profile?.name, user ? 'Öğrenci' : 'Misafir');
  const nav = sidebarNav(profile?.role, isAdmin, pagesAllowedForGate(accessGate));
  const item = nav.find((n) => n.id === page)
    || NAV.find((n) => n.id === page)
    || (page === 'admin' ? ADMIN_NAV : page === 'meeting' ? MEETING_NAV : NAV[0]);
  const primary = primaryExam(data.examTargets || []);
  const count = examCountdown(primary?.date || data.examDate);

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
            <small>{!user ? 'Giriş ve koçlar' : isCoach ? 'Koçluk paneli' : `${examTitle(data)} çalışma paneli`}</small>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} type="button" aria-current={page === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
              {n.icon} <span>{n.id === 'account' && !user ? 'Giriş' : n.label}</span>
            </button>
          ))}
          {!isCoach && user && accessGate === 'ok' ? (
            <>
              <button type="button" onClick={() => openZorro()}>
                🦁 <span>ZORRO</span>
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event('yks-open-support'))}>
                ❓ <span>Destek</span>
              </button>
            </>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-user">
            <div className="userline">
              <div className="avatar">{displayName.trim().charAt(0).toUpperCase()}</div>
              <div className="userline-text">
                <strong>{displayName}</strong>
                {isCoach ? (
                  <span>Koç</span>
                ) : (
                  <span>{displayText(data.grade)} • {displayAge(data.age)} • {primary?.date || data.examDate ? (count.past ? 'sınav tarihi geçti' : `${primary?.title || 'sınav'}: ${count.label}`) : 'sınav tarihi belirtilmedi'}</span>
                )}
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
          </div>
          <div className="top-actions">
            {!isSupabaseConfigured() ? <span className="chip">{cloudStatus === 'Yapılandırılmadı' ? 'Bulut ayarı yok' : cloudStatus}</span> : null}
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
