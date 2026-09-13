import React, { useState } from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
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
  const { config } = usePlatform();
  const [hover, setHover] = useState(null);
  const max = Math.max(...series.map((s) => s.paid));
  const credited = series.reduce((a, b) => a + b.credit, 0);

  return (
    <div className="chart-block">
      <div className="chart" role="img"
        aria-label={`Daily payout over seven days, ${money(series[0].paid)} to ${money(series[6].paid)} ${config.ticker}`}>
        {series.map((s, i) => (
          <button key={s.d} className={'chart-col' + (i === 6 ? ' is-today' : '')}
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
          <span key={s.d} className={i === 6 ? 'is-today' : undefined}>
            {s.credit > 0 ? '◦ ' : ''}{i === 6 ? 'Today' : s.d}
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
