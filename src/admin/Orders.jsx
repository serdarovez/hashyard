import React, { useState } from 'react';
import { CopyButton, ErrorNote, Loading, ORDER_STATUS, fmtDateTime, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money } from '../lib/economics.js';
import { TXID, tronscanTx } from '../api/mappers.js';

const TABS = [
  ['needs_review', 'Needs a look'],
  ['refund', 'Refunds to send'],
  ['awaiting_payment', 'Waiting'],
  ['paid', 'Paid'],
  ['expired', 'Expired'],
  ['', 'All']
];

function ManualConfirm({ order, onDone }) {
  const { api } = useApp();
  const [txid, setTxid] = useState(order.tx_hash || '');
  const [amount, setAmount] = useState(order.paid_amount ? String(order.paid_amount) : String(order.price));
  const [state, setState] = useState({ busy: false, error: null });

  const go = async () => {
    setState({ busy: true, error: null });
    try {
      if (!TXID.test(txid.trim())) throw new Error('Transaction ID must be 64 characters (0-9, a-f).');
      if (!(Number(amount) >= Number(order.price))) throw new Error(`The amount must be at least the price (${order.price}). For a smaller payment, refund it instead.`);
      await api.admin.confirmOrder(order.id, txid, Number(amount));
      onDone();
    } catch (e) {
      setState({ busy: false, error: e });
    }
  };

  return (
    <div className="manual-confirm stack gap-sm">
      <span className="small dim">
        Found the payment yourself on Tronscan? Confirm it here and the customer gets their machine.
        {order.review_note ? ` Reason flagged: ${order.review_note}.` : ''}
      </span>
      <div className="row gap">
        <input className="input grow mono" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Transaction ID" />
        <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        <button className="btn tiny primary" disabled={state.busy} onClick={go}>Confirm</button>
      </div>
      <ErrorNote error={state.error} />
    </div>
  );
}

/** Send the overpayment back from your wallet, then record the transaction here. */
function RefundCard({ order, onDone }) {
  const { api, config } = useApp();
  const [txid, setTxid] = useState('');
  const [state, setState] = useState({ busy: false, error: null });
  const amount = Number(order.refund_due);

  const mark = async () => {
    setState({ busy: true, error: null });
    try {
      await api.admin.markRefundSent(order.id, txid);
      onDone();
    } catch (e) {
      setState({ busy: false, error: e });
    }
  };

  return (
    <div className="panel stack gap-sm withdraw-card">
      <div className="row">
        <div className="stack gap-sm">
          <b>{order.profiles?.full_name || order.profiles?.email}</b>
          <span className="small dim">{order.machines?.model} · paid {money(Number(order.paid_amount))}, asked {money(Number(order.pay_amount))}</span>
        </div>
        <span className="pill hot">overpaid</span>
      </div>
      <div className="send-box">
        <div className="row">
          <span className="small dim">Send back</span>
          <span><b className="mono">{amount.toFixed(2)}</b> {config.ticker} <CopyButton text={amount.toFixed(2)} label="Copy" /></span>
        </div>
        <div className="row">
          <span className="small dim">To (the wallet it came from)</span>
          <span className="mono small addr">{order.from_address || 'unknown — check the transaction'} {order.from_address && <CopyButton text={order.from_address} label="Copy" />}</span>
        </div>
        {order.tx_hash && <a className="small" href={tronscanTx(order.tx_hash)} target="_blank" rel="noreferrer">See their payment on Tronscan</a>}
      </div>
      <div className="row gap">
        <input className="input grow mono" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Transaction ID of your refund" />
        <button className="btn tiny primary" disabled={state.busy || !TXID.test(txid.trim())} onClick={mark}>Mark refund sent</button>
      </div>
      <ErrorNote error={state.error} />
    </div>
  );
}

export default function Orders() {
  const { api, config } = useApp();
  const [tab, setTab] = useState('needs_review');
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useLoad(() => api.admin.orders(tab || undefined), [tab]);

  return (
    <div className="admin-page">
      <div className="page-head">
        <div><span className="eyebrow">Payments</span><h1>Orders</h1></div>
        <button className="btn" onClick={reload}>Refresh</button>
      </div>

      <div className="seg">
        {TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'needs_review' && (
        <p className="small dim">
          Payments land here when the amount was below the price, or when money arrived after the order expired and the
          machine had sold out. Check the transaction, then confirm it or refund the customer from your wallet.
        </p>
      )}

      {tab === 'refund' && (
        <p className="small dim">
          Customers who sent more than the order amount. Their machine is already theirs; the extra is theirs too, so send it back
          from your wallet. Differences under 1 {config.ticker} are not listed — the network fee would be higher than the refund.
        </p>
      )}

      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : !data.length ? (
        <p className="small dim">{tab === 'refund' ? 'No refunds to send.' : 'Nothing here.'}</p>
      ) : tab === 'refund' ? (
        <div className="stack">
          {data.map((o) => <RefundCard key={o.id} order={o} onDone={reload} />)}
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Customer</th><th>Machine</th><th className="right">Asked</th><th className="right">Received</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr>
                      <td className="small">{fmtDateTime(o.created_at)}</td>
                      <td className="small">{o.profiles?.email}</td>
                      <td className="small">{o.machines?.model} <span className="dim">· {o.plan}</span></td>
                      <td className="right mono">{money(Number(o.pay_amount))}</td>
                      <td className="right mono">{o.paid_amount ? money(Number(o.paid_amount)) : '—'}</td>
                      <td>
                        <span className={`pill ${ORDER_STATUS[o.status][1]}`}>{ORDER_STATUS[o.status][0]}</span>
                        {o.tx_hash && <a className="small" href={tronscanTx(o.tx_hash)} target="_blank" rel="noreferrer"> tx</a>}
                      </td>
                      <td className="right">
                        {['needs_review', 'expired', 'awaiting_payment'].includes(o.status) && (
                          <button className="btn tiny" onClick={() => setOpen(open === o.id ? null : o.id)}>
                            {open === o.id ? 'Close' : 'Confirm by hand'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open === o.id && (
                      <tr><td colSpan={7}><ManualConfirm order={o} onDone={() => { setOpen(null); reload(); }} /></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small dim">Payments go straight to your wallet ({config.receiveAddress || 'not set'}). Nothing here moves money — it only records it.</p>
    </div>
  );
}
