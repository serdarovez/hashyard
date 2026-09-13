import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { econ, money, round, priceFor } from '../lib/economics.js';

/**
 * Two plans, and the trade between them is a real one: Pro costs more to buy
 * and pays more every month. If both cost the same, nobody would ever choose
 * Standard and the control would be theatre - so each option carries its own
 * price, its own monthly earnings, and how long the extra takes to come back.
 */
export default function SplitSelector({ rig, value, onChange }) {
  const { config } = usePlatform();

  const build = (share, name, blurb) => {
    const e = econ(rig, share, config);
    return { share, name, blurb, price: priceFor(rig, share, config), monthly: e.you * 30.44 };
  };

  const std = build(config.splitStandard, 'Standard', 'Costs less to start.');
  const pro = build(config.splitPro, 'Pro', 'Costs more, pays more every month.');

  const extraCost = pro.price - std.price;
  const extraMonthly = pro.monthly - std.monthly;
  const breakEven = extraMonthly > 0 ? Math.round(extraCost / extraMonthly) : null;

  return (
    <div className="stack gap-sm">
      <span className="eyebrow">Choose your plan</span>

      {[std, pro].map((o) => (
        <button key={o.name} className="plan-option"
          aria-pressed={value === o.share} onClick={() => onChange(o.share)}>
          <span className="plan-head">
            <span className="plan-name">{o.name}</span>
            <span className="plan-keep">You keep {Math.round(o.share * 100)}%</span>
          </span>
          <span className="plan-numbers">
            <span className="plan-price">{round(o.price)} <small>{config.ticker}</small></span>
            <span className="plan-monthly">{money(o.monthly)} / month</span>
          </span>
          <span className="plan-blurb">{o.blurb}</span>
        </button>
      ))}

      {breakEven && (
        <p className="small dim">
          Pro costs {round(extraCost)} {config.ticker} more and earns about {money(extraMonthly)} more
          a month, so the difference comes back in roughly <b>{breakEven} months</b>. If you plan to
          sell sooner than that, Standard is the better buy.
        </p>
      )}
    </div>
  );
}
