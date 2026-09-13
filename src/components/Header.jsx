import React from 'react';
import { ME } from '../data/account.js';
import { usePlatform } from '../state/PlatformContext.jsx';

import { money } from '../lib/economics.js';

const NAV = [
  ['machines', 'Machines'],
  ['dashboard', 'Dashboard'],
  ['settlement', 'Settlement'],
  ['wallet', 'Wallet'],
  ['referrals', 'Referrals']
];

const ICON = {
  light: <path d="M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zM12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4" />,
  system: <path d="M3.5 5h17v11h-17zM8.5 20.5h7" />,
  dark: <path d="M20.5 14.4A8.7 8.7 0 019.6 3.5a8.7 8.7 0 1010.9 10.9z" />
};

export default function Header({ page, go, theme, setTheme }) {
  const { config } = usePlatform();
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
            <button key={id} onClick={() => go(id)}
              aria-current={page === id ? 'page' : undefined}>{label}</button>
          ))}
        </nav>

        <div className="header-right">
          <button className="balance-chip" onClick={() => go('wallet')}>
            <span className="k">Balance</span>
            <span className="v">{money(ME.balance)} {config.ticker}</span>
          </button>

          <div className="themer" role="group" aria-label="Appearance">
            {['light', 'system', 'dark'].map((t) => (
              <button key={t} onClick={() => setTheme(t)} title={t}
                aria-pressed={theme === t} aria-label={t}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICON[t]}</svg>
              </button>
            ))}
          </div>

          <span className="avatar" title={ME.name}>{ME.initials}</span>
        </div>
      </div>
    </header>
  );
}
