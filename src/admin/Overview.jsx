import React from 'react';
import { ErrorNote, Loading, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money, round } from '../lib/economics.js';

const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export default function Overview({ go }) {
  const { api, config } = useApp();
  const { data: ov, error, loading } = useLoad(() => api.admin.overview(), []);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const behind = !ov.last_published || ov.last_published < yesterday();
  const tiles = [
    ['Customers', ov.users, ''],
    ['Machines earning', ov.active_holdings, ''],
    ['Sales to date', round(Number(ov.sales_total)), config.ticker],
    ['Owed to customers', money(Number(ov.owed_to_customers)), config.ticker],
    ['Unpaid orders', ov.open_orders, ''],
    ['Withdrawals to send', ov.pending_withdrawals, ov.pending_withdrawals ? `${money(Number(ov.pending_amount))} ${config.ticker}` : '']
  ];

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Today</span>
          <h1>Overview</h1>
        </div>
      </div>

      <div className="admin-alerts">
        {behind && (
          <div className="notice warn">
            <b>Yesterday isn&apos;t published yet.</b> Customers aren&apos;t paid for a day until you enter its results
            and publish it. Last published: {ov.last_published ? fmtDate(ov.last_published) : 'never'}.{' '}
            <button className="linkish" onClick={() => go('admin-results')}>Enter results</button>
          </div>
        )}
        {ov.pending_withdrawals > 0 && (
          <div className="notice info">
            <b>{ov.pending_withdrawals} withdrawal{ov.pending_withdrawals > 1 ? 's' : ''} to send</b> — {money(Number(ov.pending_amount))} {config.ticker} in total.
            Customers were told within 24 hours.{' '}
            <button className="linkish" onClick={() => go('admin-withdrawals')}>Open queue</button>
          </div>
        )}
        {ov.refunds_due > 0 && (
          <div className="notice warn">
            <b>{ov.refunds_due} refund{ov.refunds_due > 1 ? 's' : ''} to send</b> — {money(Number(ov.refunds_amount))} {config.ticker} customers overpaid.
            That money is theirs, so send it back.{' '}
            <button className="linkish" onClick={() => go('admin-orders')}>Open refunds</button>
          </div>
        )}
        {ov.needs_review > 0 && (
          <div className="notice warn">
            <b>{ov.needs_review} payment{ov.needs_review > 1 ? 's' : ''} need a look</b> — the amount was wrong or it arrived after the order expired.{' '}
            <button className="linkish" onClick={() => go('admin-orders')}>Review</button>
          </div>
        )}
        {!config.receiveAddress && (
          <div className="notice warn">
            <b>No receiving wallet set.</b> Nobody can buy until you add one.{' '}
            <button className="linkish" onClick={() => go('admin-settings')}>Add it in Settings</button>
          </div>
        )}
      </div>

      <div className="grid tiles">
        {tiles.map(([l, v, u]) => (
          <div className="tile" key={l}>
            <span className="eyebrow">{l}</span>
            <span className="tile-value">{v}</span>
            {u && <span className="tile-sub">{u}</span>}
          </div>
        ))}
      </div>

      <div className="panel stack gap-sm">
        <h2>Your daily routine</h2>
        <ol className="routine">
          <li><b>Morning:</b> enter yesterday&apos;s profit for each machine in <b>Daily profit</b>, then <b>publish</b>. That pays everyone and sends the daily emails.</li>
          <li><b>Withdrawals:</b> send each one from your wallet, paste the transaction ID, mark it sent.</li>
          <li><b>Orders:</b> send back any overpayments, and check payments that arrived short.</li>
        </ol>
      </div>
    </div>
  );
}
