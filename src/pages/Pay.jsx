import React, { useEffect, useState } from 'react';
import { CopyButton, Countdown, ErrorNote, Loading, Qr, SignInGate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { exact, money } from '../lib/economics.js';
import { tronscanTx } from '../api/mappers.js';

/**
 * The payment screen for one order. It listens for the order to change, so
 * the moment the scanner confirms the transfer this page flips to "paid" by
 * itself - no refresh, no "I've paid" button needed.
 */
function PayInner({ id, go }) {
  const { api, config, machines, live } = useApp();
  const { data: loaded, error, loading } = useLoad(() => api.getOrder(id), [id]);
  const [order, setOrder] = useState(null);
  const [txid, setTxid] = useState('');
  const [claimState, setClaimState] = useState({ busy: false, error: null, done: false });

  useEffect(() => { if (loaded) setOrder(loaded); }, [loaded]);
  useEffect(() => api.watchOrder(id, (o) => setOrder((prev) => ({ ...prev, ...o }))), [api, id]);

  // ask the scanner to look now, then every 20s while this page is open
  useEffect(() => {
    if (order?.status !== 'awaiting_payment') return undefined;
    api.pokeScanner();
    const t = setInterval(() => api.pokeScanner(), 20000);
    return () => clearInterval(t);
  }, [api, order?.status]);

  if (loading && !order) return <div className="page narrow"><Loading label="Loading your order…" /></div>;
  if (error) return <div className="page narrow"><ErrorNote error={error} /></div>;
  if (!order) return null;

  const rig = machines.find((m) => m.id === order.machine_id);
  const amount = exact(order.pay_amount);

  const claim = async (e) => {
    e.preventDefault();
    setClaimState({ busy: true, error: null, done: false });
    try {
      await api.claimPayment(order.id, txid);
      setClaimState({ busy: false, error: null, done: true });
    } catch (err) {
      setClaimState({ busy: false, error: err, done: false });
    }
  };

  if (order.status === 'paid') {
    return (
      <div className="page narrow">
        <div className="panel success">
          <span className="tick" aria-hidden="true">✓</span>
          <h1>Payment received</h1>
          <p className="lede">{rig?.model} is yours. It starts earning from tomorrow, and you&apos;ll get an email each morning with what it made.</p>
          <dl className="specs two">
            <div><dt>Paid</dt><dd>{money(Number(order.paid_amount))}<small>{config.ticker}</small></dd></div>
            <div><dt>Plan</dt><dd>{Math.round(order.split * 100)}%<small>you keep</small></dd></div>
          </dl>
          {Number(order.refund_due) > 0 && (
            <div className="notice info">
              You sent {money(Number(order.refund_due))} {config.ticker} more than the price. We&apos;ll send it back to the
              wallet you paid from within 24 hours.
            </div>
          )}
          {order.tx_hash && (
            <a className="small" href={tronscanTx(order.tx_hash)} target="_blank" rel="noreferrer">View the transaction on Tronscan</a>
          )}
          <div className="row gap">
            <button className="btn primary" onClick={() => go('dashboard')}>Go to my dashboard</button>
            <button className="btn" onClick={() => go('machines')}>Buy another</button>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === 'needs_review') {
    return (
      <div className="page narrow">
        <div className="panel">
          <h1>We received a payment and are checking it</h1>
          <p className="lede">
            {order.review_note === 'underpaid'
              ? `The amount that arrived (${money(Number(order.paid_amount))} ${config.ticker}) is less than the price. `
              : 'Something about this payment needs a person to look at it. '}
            Our team will sort it out within a day and email you. You don&apos;t need to do anything.
          </p>
        </div>
      </div>
    );
  }

  if (order.status === 'cancelled') {
    return (
      <div className="page narrow">
        <div className="panel">
          <h1>This order was cancelled</h1>
          <button className="btn primary" onClick={() => go('machine', order.machine_id)}>Start again</button>
        </div>
      </div>
    );
  }

  const expired = order.status === 'expired';

  return (
    <div className="page narrow">
      <h1>{expired ? 'This order has expired' : 'Send your payment'}</h1>

      {expired ? (
        <div className="notice warn">
          The hour to pay has passed and the machine was released. <b>If you already sent the money, it isn&apos;t lost</b> —
          paste your transaction ID below and we&apos;ll match it.
        </div>
      ) : (
        <div className="row pay-timer">
          <span className="small dim">For <b>{rig?.model}</b>. Reserved for you for</span>
          <Countdown until={order.expires_at} onDone={() => setOrder((o) => ({ ...o, status: 'expired' }))} />
        </div>
      )}

      {!expired && (
        <div className="panel pay-panel">
          <div className="pay-step">
            <span className="eyebrow">1 · Send exactly</span>
            <div className="pay-amount">
              <span className="mono">{amount}</span> <small>{config.ticker}</small>
              <CopyButton text={amount} label="Copy amount" />
            </div>
            <p className="small dim">
              The last digits identify your order. Please send this exact amount — if your exchange takes its fee
              out of it, use the box at the bottom instead. If you send more, we refund the difference to the
              wallet it came from (differences under 1 {config.ticker} are not refunded, as the network fee would be higher).
            </p>
          </div>

          <div className="pay-step">
            <span className="eyebrow">2 · To this address, on {config.network}</span>
            <div className="pay-qr-row">
              <Qr text={order.pay_address} />
              <div className="stack gap-sm pay-address">
                <span className="mono">{order.pay_address}</span>
                <CopyButton text={order.pay_address} label="Copy address" />
              </div>
            </div>
          </div>

          <div className="pay-status" role="status">
            <span className="spinner" aria-hidden="true" /> Waiting for your payment. This page updates by itself.
          </div>
        </div>
      )}

      {!expired && (
        <div className="notice warn">
          <b>Only {config.network}.</b> USDT sent on any other network (ERC-20, BEP-20…) to this address cannot be recovered.
        </div>
      )}

      {!live && !expired && (
        <button className="btn" onClick={() => api.demoPay(order.id)}>Simulate the payment arriving (demo only)</button>
      )}

      <form className="panel stack gap-sm" onSubmit={claim}>
        <h2>Already paid?</h2>
        <p className="small dim">
          Paste the transaction ID (also called TXID or hash) from your wallet or exchange. We&apos;ll find your payment
          even if the amount was rounded.
        </p>
        <div className="row gap">
          <input className="input grow" value={txid} onChange={(e) => setTxid(e.target.value)}
            placeholder="64 characters, e.g. 3f9a…c21b" spellCheck="false" autoComplete="off" />
          <button className="btn" disabled={claimState.busy || !txid.trim()}>{claimState.busy ? 'Checking…' : 'Find my payment'}</button>
        </div>
        {claimState.done && <p className="small ok">Got it. We&apos;re checking the blockchain — this page will update as soon as it&apos;s confirmed.</p>}
        <ErrorNote error={claimState.error} />
      </form>

      {!expired && (
        <button className="btn linkish-btn" onClick={async () => { await api.cancelOrder(order.id); setOrder((o) => ({ ...o, status: 'cancelled' })); }}>
          Cancel this order
        </button>
      )}
    </div>
  );
}

export default function Pay(props) {
  return (
    <SignInGate why="to see your order">
      <PayInner {...props} />
    </SignInGate>
  );
}
