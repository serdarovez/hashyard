import React, { useState } from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import SplitSelector from '../components/SplitSelector.jsx';
import { byId } from '../data/catalog.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { ME } from '../data/account.js';
import { econ, money, round, priceFor } from '../lib/economics.js';

export default function Checkout({ id, split, setSplit, go }) {
  const { config } = usePlatform();
  const [done, setDone] = useState(false);
  const rig = byId(id);
  if (!rig) return null;

  const e = econ(rig, split, config);
  const price = priceFor(rig, split, config);
  const after = ME.balance - price;
  const short = after < 0;

  if (done) {
    return (
      <div className="page narrow">
        <div className="panel success">
          <span className="tick" aria-hidden="true">✓</span>
          <h1>{rig.kind === 'share' ? 'Share allocated' : 'Machine is yours'}</h1>
          <p className="lede">
            {rig.model} · {Math.round(split * 100)}/{Math.round((1 - split) * 100)} split.
            {rig.kind === 'share' ? ' Your slice is already hashing.' : ' Racking begins now.'}
          </p>
          <dl className="specs two">
            <div><dt>Assigned unit</dt><dd>21P-9107-KZ</dd></div>
            <div><dt>Hosting site</dt><dd>{rig.site}</dd></div>
            <div><dt>Powered on</dt><dd>{rig.kind === 'share' ? 'Now' : 'Within 24 h'}</dd></div>
            <div><dt>First settlement</dt><dd>10 Sep, 00:07 UTC</dd></div>
          </dl>
          <div className="row gap">
            <button className="btn primary" onClick={() => go('dashboard')}>View my rigs</button>
            <button className="btn" onClick={() => go('machines')}>Buy another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <button className="crumb" onClick={() => go('machine', rig.id)}>← Back to {rig.model}</button>
      <h1>Confirm purchase</h1>

      <div className="panel row gap">
        <div className="media thumb"><RigDrawing rig={rig} /></div>
        <div className="stack">
          <h3>{rig.model}</h3>
          <span className="mono dim small">{rig.hash} {rig.unit} · {rig.site}</span>
        </div>
      </div>

      <div className="panel">
        <SplitSelector rig={rig} value={split} onChange={setSplit} />
      </div>

      <div className="panel stack gap-sm">
        <div className="ledger-row">
          <span className="k">Machine, {Math.round(split * 100)}% plan</span>
          <span className="v">{money(price)}</span>
        </div>
        <div className="ledger-row"><span className="k">Racking &amp; setup</span><span className="v ok">Included</span></div>
        <div className="ledger-row"><span className="k">Hosting deposit</span><span className="v ok">None</span></div>
        <hr className="rule" />
        <div className="ledger-row total"><span className="k">Pay from balance</span><span className="v">{money(price)} {config.ticker}</span></div>
      </div>

      <div className="panel stack gap-sm">
        <div className="ledger-row"><span className="k">Balance now</span><span className="v">{money(ME.balance)}</span></div>
        <div className="ledger-row">
          <span className="k">Balance after</span>
          <span className={'v' + (short ? ' neg' : '')}>{money(after)}</span>
        </div>
      </div>

      {short ? (
        <>
          <div className="notice warn">
            <b>You are {money(Math.abs(after))} {config.ticker} short.</b> Deposit over {config.network} to
            cover the difference — machines are held for 30 minutes.
          </div>
          <div className="row gap">
            <button className="btn primary" onClick={() => go('wallet')}>
              Deposit {money(Math.abs(after))} {config.ticker}
            </button>
            <button className="btn" onClick={() => go('machines')}>Choose another</button>
          </div>
        </>
      ) : (
        <button className="btn primary wide" onClick={() => setDone(true)}>
          Confirm &amp; start hashing
        </button>
      )}

      <p className="small dim">
        Your unit is powered on within 24 hours and settles from its first full day.
        Payouts begin at {money(e.you)} {config.ticker}/day at today&apos;s hashprice.
      </p>
    </div>
  );
}
