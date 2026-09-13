import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { hashpriceLabel, money, round } from '../lib/economics.js';

export function Row({ k, v, tone }) {
  return (
    <div className="ledger-row">
      <span className="k">{k}</span>
      <span className={'v' + (tone ? ' ' + tone : '')}>{v}</span>
    </div>
  );
}

/**
 * The arithmetic, shown rather than summarised: mined, minus metered power,
 * minus fee, equals payout. The proportion bar underneath is accent-vs-neutral
 * on purpose - it encodes magnitude, not three separate identities.
 */
export default function Ledger({ rig, e, share }) {
  const { config } = usePlatform();
  const kwh = (rig.watts / 1000) * 24;
  return (
    <div className="stack gap-sm">
      <Row k={`${rig.coin} mined @ ${hashpriceLabel(rig, config)}`} v={money(e.gross)} />
      <Row k={`Power · ${kwh.toFixed(1)} kWh @ $${config.powerRate.toFixed(3)}`}
        v={`− ${money(e.power)}`} tone="dim" />
      <Row k={`Platform fee · ${Math.round((1 - share) * 100)}% of net`}
        v={`− ${money(e.fee)}`} tone="dim" />
      <hr className="rule" />
      <div className="ledger-row total">
        <span className="k">Your payout</span>
        <span className="v">{money(e.you !== undefined ? e.you : e.paid)} {config.ticker}</span>
      </div>

      <div className="prop" role="img"
        aria-label={`Of ${money(e.gross)} mined: ${money(e.you)} yours, ${money(e.power)} power, ${money(e.fee)} platform fee`}>
        <i className="yours" style={{ width: `${(e.you / e.gross) * 100}%` }} />
        <i className="cost" style={{ width: `${(e.power / e.gross) * 100}%` }} />
        <i className="fee" style={{ width: `${(e.fee / e.gross) * 100}%` }} />
      </div>
      <div className="row">
        <span className="eyebrow">Yours {Math.round((e.you / e.gross) * 100)}%</span>
        <span className="eyebrow">Power {Math.round((e.power / e.gross) * 100)}%</span>
        <span className="eyebrow">Fee {Math.round((e.fee / e.gross) * 100)}%</span>
      </div>
    </div>
  );
}
