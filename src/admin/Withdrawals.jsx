import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { REVIEW_THRESHOLD } from '../data/admin.js';
import { money } from '../lib/economics.js';

const TONE = { pending: 'hot', approved: 'run', sent: 'run', rejected: 'mute' };

export default function Withdrawals() {
  const { withdrawals, decideWithdrawal, config } = usePlatform();
  const pending = withdrawals.filter((w) => w.status === 'pending');
  const queued = pending.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{pending.length} awaiting a decision</span>
          <h1>Withdrawals</h1>
        </div>
        <span className={'pill ' + (pending.length ? 'hot' : 'run')}>
          {money(queued)} {config.ticker} queued
        </span>
      </div>

      <div className="notice info">
        <b>Approving sends real funds on {config.network}, and it cannot be undone.</b> Two things
        are worth checking before you click: that the customer&apos;s identity check has passed, and
        that the destination address matches one they have used before. Anything over{' '}
        {money(REVIEW_THRESHOLD)} {config.ticker} is held for a human on purpose.
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Ref</th><th>Customer</th><th className="right">Amount</th>
              <th>Destination</th><th>Identity</th><th>Status</th><th className="right">Decision</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => {
              const big = w.amount >= REVIEW_THRESHOLD;
              const blocked = w.kyc !== 'approved';
              return (
                <tr key={w.id}>
                  <td className="mono small">{w.id}<span className="dim"> · {w.when}</span></td>
                  <td>{w.user}</td>
                  <td className={'right mono ' + (big ? 'warn' : '')}>
                    {money(w.amount)}{big && <span className="dim small"> review</span>}
                  </td>
                  <td className="mono small dim">{w.address.slice(0, 6)}…{w.address.slice(-4)}</td>
                  <td>
                    <span className={'pill ' + (w.kyc === 'approved' ? 'run' : 'hot')}>{w.kyc}</span>
                  </td>
                  <td><span className={'pill ' + (TONE[w.status] || 'mute')}>{w.status}</span></td>
                  <td className="right">
                    {w.status === 'pending' ? (
                      <div className="row-actions">
                        <button className="btn tiny" onClick={() => decideWithdrawal(w.id, 'rejected')}>
                          Reject
                        </button>
                        <button className="btn tiny primary" disabled={blocked}
                          title={blocked ? 'Identity check has not passed' : undefined}
                          onClick={() => decideWithdrawal(w.id, 'approved')}>
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="dim small">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid tiles">
        {['pending', 'approved', 'sent', 'rejected'].map((s) => (
          <div className="tile" key={s}>
            <span className="eyebrow">{s}</span>
            <span className="tile-value">{withdrawals.filter((w) => w.status === s).length}</span>
            <span className="tile-sub">
              {money(withdrawals.filter((w) => w.status === s).reduce((a, b) => a + b.amount, 0))} {config.ticker}
            </span>
          </div>
        ))}
      </div>

      <p className="small dim">
        The approve button is disabled while a customer&apos;s identity check is outstanding — that is
        a deliberate block, not a loading state. Jemal O.&apos;s request stays queued until their check
        clears.
      </p>
    </div>
  );
}
