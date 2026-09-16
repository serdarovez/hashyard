import React from 'react';
import RigDrawing from './RigDrawing.jsx';
import { useApp } from '../state/AppContext.jsx';
import { econ, money, round, paybackMonths } from '../lib/economics.js';

/**
 * A buyer is choosing between machines, so the card answers only the three
 * questions that decision turns on: what does it cost, what does it pay, and
 * how long until it has paid for itself.
 *
 * Hashrate, wattage and J/TH are real and they matter - but they matter to
 * someone comparing hardware, not to someone deciding to buy. Those live on
 * the detail page under "Technical details".
 */
export default function MachineCard({ rig, onOpen }) {
  const { config } = useApp();
  const e = econ(rig, config.splitStandard, config);
  const months = paybackMonths(rig, config.splitStandard, config);
  const isShare = rig.kind === 'share';

  return (
    <button className="machine-card" onClick={() => onOpen(rig.id)}>
      <div className="row card-top">
        <div className="stack">
          <span className="eyebrow">{rig.brand}</span>
          <h3>{rig.model}</h3>
        </div>
        <span className={'pill ' + (isShare ? 'hot' : 'mute')}>
          {isShare ? 'Part of a machine' : 'Whole machine'}
        </span>
      </div>

      <div className="media">
        <RigDrawing rig={rig} />
      </div>

      <div className="card-money">
        <div className="row">
          <span className="k">Price</span>
          <span className="v">{round(rig.price)} <small>{config.ticker}</small></span>
        </div>
        <div className="row">
          <span className="k">You earn</span>
          <span className={'v ' + (e.viable ? 'earn' : 'neg')}>
            {e.viable ? `${money(e.you * 30.44)} / month` : 'nothing right now'}
          </span>
        </div>
      </div>

      <div className="card-note">
        {e.viable && months
          ? <span>Pays for itself in about <b>{months} months</b></span>
          : <span>Electricity costs more than this machine mines today</span>}
      </div>
    </button>
  );
}
