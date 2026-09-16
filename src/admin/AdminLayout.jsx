import React from 'react';
import { Loading, SignInGate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';

const SECTIONS = [
  ['admin', 'Overview'],
  ['admin-results', 'Daily profit'],
  ['admin-machines', 'Machines'],
  ['admin-orders', 'Orders'],
  ['admin-withdrawals', 'Withdrawals'],
  ['admin-users', 'Customers'],
  ['admin-settings', 'Settings']
];

function Console({ page, go, children }) {
  const { api, isAdmin, accountReady, live } = useApp();
  const { data: ov } = useLoad(() => (isAdmin ? api.admin.overview() : Promise.resolve(null)), [isAdmin, page]);

  if (!accountReady) return <div className="page"><Loading /></div>;
  if (!isAdmin) {
    return (
      <div className="page narrow">
        <h1>Operators only</h1>
        <p className="lede">Your account doesn&apos;t have access to the console.</p>
        <button className="btn" onClick={() => go('machines')}>Back to the site</button>
      </div>
    );
  }

  const badge = {
    'admin-withdrawals': ov?.pending_withdrawals || null,
    'admin-orders': (ov?.needs_review || 0) + (ov?.refunds_due || 0) || null
  };

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
        {!live && <div className="admin-dirty">Demo mode — changes are not saved anywhere and reset on reload.</div>}
        <button className="admin-exit" onClick={() => go('machines')}>← Back to the site</button>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}

export default function AdminLayout(props) {
  return <SignInGate why="to open the console"><Console {...props} /></SignInGate>;
}
