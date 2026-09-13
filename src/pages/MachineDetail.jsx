import React from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import SplitSelector from '../components/SplitSelector.jsx';
import Ledger from '../components/Ledger.jsx';
import { byId } from '../data/catalog.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { econ, efficiency, money, round, priceFor, paybackMonths } from '../lib/economics.js';

export default function MachineDetail({ id, split, setSplit, go }) {
  const { config } = usePlatform();
  const rig = byId(id);
  if (!rig) {
    return (
      <div className="page narrow">
        <h1>Machine not found</h1>
        <button className="btn" onClick={() => go('machines')}>Back to machines</button>
      </div>
    );
  }

  const e = econ(rig, split, config);
  const ef = efficiency(rig);
  const share = rig.kind === 'share';
  const price = priceFor(rig, split, config);
  const months = paybackMonths(rig, split, config);

  return (
    <div className="page">
      <button className="crumb" onClick={() => go('machines')}>← All machines</button>

      <div className="detail">
        <div className="detail-main">
          <div className="media large"><RigDrawing rig={rig} /></div>

          <div className="stack gap-sm">
            <span className="eyebrow">{rig.brand} · {rig.algo} · mines {rig.coin} · {rig.cool}-cooled</span>
            <h1>{rig.model}</h1>
            <p className="lede">Hosted at {rig.site}.</p>
          </div>

          {share && (
            <div className="panel stack gap-sm">
              <div className="row">
                <span className="eyebrow">What you are buying</span>
                <span className="mono accent">{((rig.hash / rig.of.hash) * 100).toFixed(1)}% of a machine</span>
              </div>
              <div className="frac">
                <span className="track"><i style={{ width: `${((rig.hash / rig.of.hash) * 100).toFixed(1)}%` }} /></span>
                <span className="lbl">{rig.hash} of {rig.of.hash} {rig.unit}</span>
              </div>
              <p className="small">
                You are buying a share of one <b>{rig.of.model}</b> that is already running in our
                facility. You pay the same rate per unit of mining power as someone buying the whole
                machine, and electricity is charged the same way, so you earn the same percentage on
                your money. You simply own a smaller piece.
              </p>
            </div>
          )}

          <div className="panel">
            <div className="stack gap-sm">
              <h2>Technical details</h2>
              <p className="small dim">
                For comparing hardware. You do not need any of this to buy, because the earnings
                above already account for it.
              </p>
            </div>
            <dl className="specs">
              <div><dt>Mining power</dt><dd>{rig.hash}<small>{rig.unit}</small></dd></div>
              <div><dt>Electricity used</dt><dd>{((rig.watts / 1000) * 24).toFixed(0)}<small>kWh / day</small></dd></div>
              <div><dt>Power rating</dt><dd>{round(rig.watts)}<small>watts</small></dd></div>
              <div><dt>Efficiency</dt><dd>{ef.v}<small>{ef.u}</small></dd></div>
            </dl>
            <p className="small dim">
              Efficiency is electricity used per unit of mining power. Lower is better, and it is
              the number that decides whether a machine stays profitable when prices fall.
            </p>
          </div>

          <div className="panel">
            <h2>Where your money comes from</h2>
            <p className="small dim">
              What this machine mined today, minus the electricity it used and our fee.
            </p>
            <Ledger rig={rig} e={e} share={split} />
          </div>
        </div>

        <aside className="detail-side">
          <div className="panel buy-panel">
            <div className="row">
              <span className="eyebrow">Price</span>
              <span className={'pill ' + (rig.stock > 10 ? 'mute' : 'hot')}>
                {rig.stock > 0 ? `${rig.stock} available` : 'Sold out'}
              </span>
            </div>
            <div className="big-price">{round(price)} <small>{config.ticker}</small></div>

            <SplitSelector rig={rig} value={split} onChange={setSplit} />

            <dl className="specs two">
              <div><dt>You earn</dt><dd>{money(e.you * 30.44)}<small>per month</small></dd></div>
              <div><dt>Pays for itself in</dt><dd>{months || '—'}<small>months</small></dd></div>
            </dl>

            {e.viable ? (
              <>
                <div className="notice info">
                  <b>We guarantee it runs {Math.round(config.uptimeSLA * 100)}% of the time.</b> If
                  your machine is down more than that, we pay you for the missing hours ourselves.
                  What nobody can promise is the bitcoin price — when it falls, everyone&apos;s
                  earnings fall, ours included.
                </div>
                <button className="btn primary" onClick={() => go('checkout', rig.id)}>
                  Buy for {round(price)} {config.ticker}
                </button>
              </>
            ) : (
              <>
                <div className="notice warn">
                  <b>Not offered.</b> At {ef.v} {ef.u} this machine draws {money(e.power)} of power
                  a day and mines {money(e.gross)} — it loses {money(Math.abs(e.net))} a day before
                  anyone&apos;s split. We keep it listed so you can see what efficiency decides.
                </div>
                <button className="btn" onClick={() => go('machines')}>Back to machines</button>
              </>
            )}

            <p className="small dim">
              Estimates track network difficulty and coin price and will change daily, up and down.
              Payback assumes today&apos;s hashprice holds, which it will not. Hardware depreciates.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
