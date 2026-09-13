import React from 'react';

/**
 * Bottom tab bar, shown only on narrow screens (see .mobile-nav in styles.css).
 *
 * The desktop header links do not fit on a phone, and hiding them without a
 * replacement left mobile users stranded on whichever page they landed on.
 * Tabs sit at the bottom because that is where a thumb reaches.
 */
const TABS = [
  {
    id: 'machines', label: 'Machines', also: ['machine', 'checkout'],
    icon: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="8.5" cy="12" r="2.6" />
        <circle cx="15.5" cy="12" r="2.6" />
      </>
    )
  },
  {
    id: 'dashboard', label: 'Dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="7.5" height="9" rx="1.6" />
        <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
        <rect x="13.5" y="11" width="7.5" height="10" rx="1.6" />
        <rect x="3" y="15" width="7.5" height="6" rx="1.6" />
      </>
    )
  },
  {
    id: 'settlement', label: 'Payouts',
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    )
  },
  {
    id: 'wallet', label: 'Wallet',
    icon: (
      <>
        <path d="M3 7.5A2.5 2.5 0 015.5 5H18a2 2 0 012 2v1" />
        <rect x="3" y="7.5" width="18" height="12.5" rx="2.2" />
        <path d="M16.5 13.8h.01" />
      </>
    )
  },
  {
    id: 'referrals', label: 'Referrals',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.4" />
        <path d="M2.5 20a6.5 6.5 0 0113 0" />
        <path d="M17 8v6M14 11h6" />
      </>
    )
  }
];

export default function MobileNav({ page, go }) {
  return (
    <nav className="mobile-nav" aria-label="Main">
      {TABS.map((t) => {
        const active = page === t.id || (t.also && t.also.includes(page));
        return (
          <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
