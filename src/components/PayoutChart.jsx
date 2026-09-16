import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { money } from '../lib/economics.js';

/**
 * Seven days of payout, one series.
 *
 * A day that drew an SLA credit is drawn as two steps of the SAME hue rather
 * than two colours: a second colour here would be a categorical palette, and
 * a categorical palette needs to survive colour-blind separation checks for a
 * distinction this small. Same hue, different lightness, plus a marked label
 * and a tooltip, carries it without that cost.
 */
export default function PayoutChart({ series, onPickDay }) {
  const { config } = useApp();
  const [hover, setHover] = useState(null);
  const last = series.length - 1;
  const max = Math.max(0.000001, ...series.map((s) => s.paid));
  const credited = series.reduce((a, b) => a + b.credit, 0);
  if (!series.length) return null;

  return (
    <div className="chart-block">
      <div className="chart" role="img"
        aria-label={`Daily payout over ${series.length} days, ${money(series[0].paid)} to ${money(series[last].paid)} ${config.ticker}`}>
        {series.map((s, i) => (
          <button key={s.key || s.d} className={'chart-col' + (i === last ? ' is-today' : '')}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            onClick={() => onPickDay && onPickDay(i)}
            aria-label={`${s.d}: ${money(s.paid)}${s.credit ? `, includes ${money(s.credit)} uptime credit` : ''}`}>
            {hover === i && (
              <span className="chart-tip">
                {s.d} · {money(s.paid)}
                {s.credit > 0 && <em> incl. {money(s.credit)} credit</em>}
              </span>
            )}
            <span className="chart-bar" style={{ height: `${(s.paid / max) * 100}%` }}>
              {s.credit > 0 && (
                <span className="chart-topup" style={{ height: `${(s.credit / s.paid) * 100}%` }} />
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="chart-axis">
        {series.map((s, i) => (
          <span key={s.key || s.d} className={i === last ? 'is-today' : undefined}>
            {s.credit > 0 ? '◦ ' : ''}{s.d}
          </span>
        ))}
      </div>

      {credited > 0 && (
        <div className="row chart-foot">
          <span className="eyebrow">{'◦'} Uptime credit applied</span>
          <span className="mono dim">+{money(credited)} this week</span>
        </div>
      )}
    </div>
  );
}
