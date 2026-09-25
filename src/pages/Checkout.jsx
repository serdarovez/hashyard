import React, { useState } from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import SplitSelector from '../components/SplitSelector.jsx';
import { ErrorNote, Loading, SignInGate } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { econ, money, round, priceFor } from '../lib/economics.js';

/**
 * Pick the plan, then create an order. The price shown here is only a preview:
 * the database computes the real price when the order is created, so nothing
 * the browser sends can change what a customer is charged.
 */
function CheckoutInner({ id, split, setSplit, go }) {
  const { api, config, machines, catalogReady, orders } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!catalogReady) return <div className="page narrow"><Loading /></div>;
  const rig = machines.find((m) => m.id === id);
  if (!rig) {
    return (
      <div className="page narrow">
        <h1>Machine not found</h1>
        <button className="btn" onClick={() => go('machines')}>Back to machines</button>
      </div>
    );
  }

  const plan = split >= config.splitPro ? 'pro' : 'standard';
  const price = priceFor(rig, split, config);
  const monthly = econ(rig, split, config).you * 30.44;
  const firstPurchase = !orders.some((o) => o.status === 'paid');
  const cashback = firstPurchase && config.cashbackRate > 0 ? Math.min(price * config.cashbackRate, config.cashbackCap) : 0;

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await api.createOrder(rig.id, plan);
      go('pay', order.id);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <button className="crumb" onClick={() => go('machine', rig.id)}>← Back to {rig.model}</button>
      <h1>Buy this machine</h1>

      <div className="panel row gap">
        <div className="media thumb"><RigDrawing rig={rig} /></div>
        <div className="stack">
          <h3>{rig.model}</h3>
          <span className="small dim">Running in {rig.site}</span>
        </div>
      </div>

      <div className="panel">
        <SplitSelector rig={rig} value={split} onChange={setSplit} />
      </div>

      <div className="panel stack gap-sm">
        <div className="ledger-row"><span className="k">{plan === 'pro' ? 'Pro' : 'Standard'} plan — you keep {Math.round(split * 100)}%</span><span className="v">{money(price)}</span></div>
        <div className="ledger-row"><span className="k">Setup and hosting</span><span className="v ok">Included</span></div>
        <hr className="rule" />
        <div className="ledger-row total"><span className="k">You pay</span><span className="v">{money(price)} {config.ticker}</span></div>
        {cashback > 0 && (
          <div className="ledger-row"><span className="k">First-purchase cashback, added to your balance</span><span className="v ok">+{money(cashback)}</span></div>
        )}
        <p className="small dim">Expected earnings at today&apos;s prices: about {money(monthly)} {config.ticker} a month.</p>
      </div>

      <div className="notice info">
        <b>How payment works.</b> On the next screen you&apos;ll get the exact amount and our wallet address.
        Send it in {config.ticker} over <b>{config.network}</b> from any wallet or exchange. Your machine is yours as
        soon as the payment confirms, usually within a minute or two.
      </div>

      <p className="small dim">
        The figures above are estimates, not a promise. You are paid what this machine actually mines each day, less its
        electricity, so earnings move with the bitcoin price and mining hardware loses value over time.
      </p>

      <ErrorNote error={error} />
      <button className="btn primary wide" onClick={pay} disabled={busy || rig.stock < 1}>
        {rig.stock < 1 ? 'Sold out' : busy ? 'Creating your order…' : `Continue to payment — ${round(price)} ${config.ticker}`}
      </button>
    </div>
  );
}

export default function Checkout(props) {
  return (
    <SignInGate why="to buy a machine">
      <CheckoutInner {...props} />
    </SignInGate>
  );
}
