import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';

const SECTIONS = [
  ['admin', 'Overview'],
  ['admin-fleet', 'Fleet'],
  ['admin-withdrawals', 'Withdrawals'],
  ['admin-users', 'Customers'],
  ['admin-pricing', 'Pricing & risk']
];

export default function AdminLayout({ page, go, children }) {
  const { withdrawals, fleet, dirty } = usePlatform();
  const pending = withdrawals.filter((w) => w.status === 'pending').length;
  const down = fleet.filter((r) => !r.online).length;

  const badge = { 'admin-withdrawals': pending || null, 'admin-fleet': down || null };

  return (
    <div className="admin">
      <aside className="admin-nav">
        <div className="admin-brand">
          <span className="eyebrow">Hashyard</span>
          <strong>Operator console</strong>
        </div>
        <nav>
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}>
              <span>{label}</span>
              {badge[id] ? <em className="count">{badge[id]}</em> : null}
            </button>
          ))}
        </nav>
        {dirty && (
          <div className="admin-dirty">
            Live config edited — customer pages are showing your values.
          </div>
        )}
        <button className="admin-exit" onClick={() => go('machines')}>← Back to the site</button>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
