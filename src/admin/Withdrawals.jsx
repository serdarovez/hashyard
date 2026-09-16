import React, { useState } from 'react';
import { CopyButton, ErrorNote, Loading, fmtDateTime, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money } from '../lib/economics.js';
import { TXID, tronscanTx } from '../api/mappers.js';

/**
 * The manual withdrawal queue. You send the USDT from your own wallet - this
 * page never moves money - then paste the transaction ID so the customer can
 * see it. Rejecting puts the amount back into their balance.
 */
function Pending({ w, onDone }) {
  const { api, config } = useApp();
  const [txid, setTxid] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState(null);   // null | 'reject'
  const [state, setState] = useState({ busy: false, error: null });
  const send = Math.max(0, Number(w.amount) - Number(w.fee));
  const hours = Math.floor((Date.now() - Date.parse(w.requested_at)) / 3600e3);

  const run = async (fn) => {
    setState({ busy: true, error: null });
    try { await fn(); onDone(); } catch (e) { setState({ busy: false, error: e }); }
  };

  return (
    <div className={'panel stack gap-sm withdraw-card' + (hours >= 20 ? ' is-late' : '')}>
      <div className="row">
        <div className="stack gap-sm">
          <b>{w.profiles?.full_name || w.profiles?.email}</b>
          <span className="small dim">{w.profiles?.email} · requested {fmtDateTime(w.requested_at)}</span>
        </div>
        <span className={'pill ' + (hours >= 20 ? 'hot' : 'mute')}>{hours < 1 ? 'just now' : `${hours}h ago`}</span>
      </div>

      <div className="send-box">
        <div className="row">
          <span className="small dim">Send</span>
          <span><b className="mono">{send.toFixed(2)}</b> {config.ticker} <CopyButton text={send.toFixed(2)} label="Copy" /></span>
        </div>
        <div className="row">
          <span className="small dim">To</span>
          <span className="mono small addr">{w.address} <CopyButton text={w.address} label="Copy" /></span>
        </div>
        <span className="small dim">{money(Number(w.amount))} requested − {money(Number(w.fee))} network fee · on {config.network}</span>
      </div>

      {mode === 'reject' ? (
        <div className="row gap">
          <input className="input grow" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (the customer sees this)" />
          <button className="btn tiny" disabled={state.busy || !reason.trim()} onClick={() => run(() => api.admin.reject(w.id, reason.trim()))}>Return to balance</button>
          <button className="btn tiny" onClick={() => setMode(null)}>Back</button>
        </div>
      ) : (
        <div className="row gap">
          <input className="input grow mono" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Transaction ID after you've sent it" />
          <button className="btn tiny primary" disabled={state.busy || !TXID.test(txid.trim())}
            onClick={() => run(() => api.admin.markSent(w.id, txid))}>Mark as sent</button>
          <button className="btn tiny" onClick={() => setMode('reject')}>Reject</button>
        </div>
      )}
      <ErrorNote error={state.error} />
    </div>
  );
}

export default function Withdrawals() {
  const { api } = useApp();
  const pending = useLoad(() => api.admin.withdrawals('pending'), []);
  const done = useLoad(() => api.admin.withdrawals(), []);
  const refresh = () => { pending.reload(); done.reload(); };

  return (
    <div className="admin-page">
      <div className="page-head">
        <div><span className="eyebrow">Sent by hand</span><h1>Withdrawals</h1></div>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>

      <p className="small dim">
        Customers are told withdrawals arrive within 24 hours. Cards turn orange after 20 hours. Check the address before
        sending — TRON transfers can&apos;t be reversed.
      </p>

      {pending.loading ? <Loading /> : pending.error ? <ErrorNote error={pending.error} /> : pending.data.length === 0 ? (
        <div className="notice info">Nothing to send. You&apos;re all caught up.</div>
      ) : (
        <div className="stack">
          {pending.data.map((w) => <Pending key={w.id} w={w} onDone={refresh} />)}
        </div>
      )}

      <section className="panel">
        <h2>History</h2>
        {done.loading ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Requested</th><th>Customer</th><th className="right">Amount</th><th>Status</th><th>Transaction</th></tr></thead>
              <tbody>
                {(done.data || []).filter((w) => w.status !== 'pending').map((w) => (
                  <tr key={w.id}>
                    <td className="small">{fmtDateTime(w.requested_at)}</td>
                    <td className="small">{w.profiles?.email}</td>
                    <td className="right mono">{money(Number(w.amount))}</td>
                    <td><span className={'pill ' + (w.status === 'sent' ? 'run' : 'mute')}>{w.status}</span></td>
                    <td className="small">{w.tx_hash ? <a href={tronscanTx(w.tx_hash)} target="_blank" rel="noreferrer">View</a> : w.admin_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
