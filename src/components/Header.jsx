import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { money } from '../lib/economics.js';

const NAV = [
  ['machines', 'Machines'],
  ['dashboard', 'Dashboard'],
  ['wallet', 'Wallet'],
  ['referrals', 'Referrals'],
  ['leaderboard', 'Leaderboard']
];

const ICON = {
  light: <path d="M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zM12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4" />,
  system: <path d="M3.5 5h17v11h-17zM8.5 20.5h7" />,
  dark: <path d="M20.5 14.4A8.7 8.7 0 019.6 3.5a8.7 8.7 0 1010.9 10.9z" />
};

export default function Header({ page, go, theme, setTheme }) {
  const { config, session, profile, balance, isAdmin, signIn, signOut } = useApp();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const initials = (profile?.full_name || profile?.email || '?')
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <button className="brand" onClick={() => go('machines')} aria-label="Hashyard home">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="1.5" y="5" width="21" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="8" cy="12" r="3.1" stroke="var(--accent)" strokeWidth="1.6" />
            <circle cx="16" cy="12" r="3.1" stroke="var(--accent)" strokeWidth="1.6" />
          </svg>
          <span>HASH<em>YARD</em></span>
        </button>

        <nav className="site-nav" aria-label="Main">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}>{label}</button>
          ))}
        </nav>

        <div className="header-right">
          {session && (
            <button className="balance-chip" onClick={() => go('wallet')}>
              <span className="k">Earnings to withdraw</span>
              <span className="v">{money(balance)} {config.ticker}</span>
            </button>
          )}

          <div className="themer" role="group" aria-label="Appearance">
            {['light', 'system', 'dark'].map((t) => (
              <button key={t} onClick={() => setTheme(t)} title={t} aria-pressed={theme === t} aria-label={t}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                  strokeLinecap="round" strokeLinejoin="round">{ICON[t]}</svg>
              </button>
            ))}
          </div>

          {session ? (
            <div className="menu-wrap" ref={menuRef}>
              <button className="avatar" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Account menu">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
                  : initials}
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <b>{profile?.full_name || 'Your account'}</b>
                    <span className="small dim">{profile?.email}</span>
                  </div>
                  <button role="menuitem" onClick={() => { setMenu(false); go('wallet'); }}>Wallet &amp; settings</button>
                  {isAdmin && <button role="menuitem" onClick={() => { setMenu(false); go('admin'); }}>Operator console</button>}
                  <button role="menuitem" onClick={() => { setMenu(false); signOut(); go('machines'); }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn small-btn" onClick={() => signIn(window.location.hash)}>Log in</button>
          )}
        </div>
      </div>
    </header>
  );
}
