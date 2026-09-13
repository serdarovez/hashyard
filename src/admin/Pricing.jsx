import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { CONFIG } from '../data/config.js';
import { RIGS, byId } from '../data/catalog.js';
import { breakEvenUptime, dayEcon, econ, money } from '../lib/economics.js';
import { WEEK } from '../data/account.js';

const CONTROLS = [
  { k: 'btcHashprice', label: 'BTC hashprice', unit: '$/PH·day', min: 15, max: 90, step: 0.1,
    help: 'What a petahash earns per day. Set by BTC price and network difficulty — you do not control it, but every figure on the site follows it.' },
  { k: 'powerRate', label: 'Power tariff', unit: '$/kWh', min: 0.02, max: 0.14, step: 0.001,
    help: 'Your all-in hosting cost. The single number that decides which machines are worth running.' },
  { k: 'splitStandard', label: 'Standard split', unit: 'to owner', min: 0.6, max: 0.95, step: 0.01, pct: true,
    help: 'The owner keeps this share of net revenue; you keep the rest. It also sets your SLA break-even.' },
  { k: 'splitPro', label: 'Pro split', unit: 'to owner', min: 0.7, max: 0.98, step: 0.01, pct: true,
    help: 'The 12-month tier. A higher number here halves the fee that funds your guarantee.' },
  { k: 'uptimeSLA', label: 'Uptime guarantee', unit: 'floor', min: 0.85, max: 0.999, step: 0.005, pct: true,
    help: 'Hash fewer hours than this and you credit the shortfall. Raising it raises your break-even uptime one-for-one.' },
  { k: 'referralShare', label: 'Referral share', unit: 'of your fee', min: 0, max: 0.3, step: 0.01, pct: true,
    help: 'Paid from the platform fee on a referred machine — never from their deposit.' },
  { k: 'firstDeposit', label: 'First-deposit credit', unit: 'of deposit', min: 0, max: 0.25, step: 0.01, pct: true,
    help: 'Hosting credit, not withdrawable cash. Capped at ' + CONFIG.firstDepCap + ' USDT.' }
];

export default function Pricing() {
  const { config, setConfigValue, resetConfig, dirty, fleet } = usePlatform();

  const sellable = RIGS.filter((r) => econ(r, config.splitStandard, config).viable);
  const underwater = RIGS.length - sellable.length;
  const paying = fleet.filter((f) => f.owner !== 'pool');

  const exposure = [config.splitStandard, config.splitPro].map((sp) => {
    const be = breakEvenUptime(sp, config);
    const thu = dayEcon(WEEK[3], byId('s21pro'), sp, config);
    const week = WEEK.reduce((a, d) => {
      const x = dayEcon(d, byId('s21pro'), sp, config);
      return a + x.fee - x.credit;
    }, 0);
    return { sp, be, thu, week, fleetWeek: week * paying.length };
  });

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Live — the customer site reads these values</span>
          <h1>Pricing &amp; risk</h1>
        </div>
        <button className="btn" onClick={resetConfig} disabled={!dirty}>
          {dirty ? 'Reset to shipped values' : 'At shipped values'}
        </button>
      </div>

      <div className="notice info">
        <b>These controls are wired, not decorative.</b> Move any slider and the marketplace,
        the machine pages, the dashboard and the settlement ledger all recompute — there is one
        source of truth for the economy, and this is it.
      </div>

      <div className="split-2">
        <section className="panel">
          <h2>Economy</h2>
          <div className="controls">
            {CONTROLS.map((c) => {
              const v = config[c.k];
              const changed = CONFIG[c.k] !== v;
              return (
                <div className="control" key={c.k}>
                  <div className="row">
                    <label htmlFor={'c-' + c.k}>
                      {c.label}
                      {changed && <em className="edited">edited</em>}
                    </label>
                    <span className="mono val">
                      {c.pct ? (v * 100).toFixed(c.step < 0.01 ? 1 : 0) + '%' : v.toFixed(c.step < 0.01 ? 3 : 2)}
                      <small> {c.unit}</small>
                    </span>
                  </div>
                  <input id={'c-' + c.k} type="range" min={c.min} max={c.max} step={c.step} value={v}
                    onChange={(e) => setConfigValue(c.k, parseFloat(e.target.value))} />
                  <p className="small dim">{c.help}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <h2>What the catalogue looks like now</h2>
            <div className="grid tiles">
              <div className="tile">
                <span className="eyebrow">Sellable</span>
                <span className="tile-value ok">{sellable.length}<small> of {RIGS.length}</small></span>
                <span className="tile-sub">net positive after power</span>
              </div>
              <div className="tile">
                <span className="eyebrow">Underwater</span>
                <span className={'tile-value ' + (underwater > 1 ? 'neg' : '')}>{underwater}</span>
                <span className="tile-sub">burn more than they mine</span>
              </div>
            </div>
            {underwater > 0 && (
              <div className="notice warn">
                <b>{underwater} machine{underwater > 1 ? "s are" : " is"} now underwater.</b> At ${config.powerRate.toFixed(3)}/kWh
                and ${config.btcHashprice.toFixed(2)}/PH·day these cannot be sold, and any already
                racked are costing their owners money every day:{' '}
                {RIGS.filter((r) => !econ(r, config.splitStandard, config).viable)
                  .map((r) => r.model).join(', ')}.
              </div>
            )}
            <table className="table">
              <thead><tr><th>Machine</th><th className="right">Owner / day</th><th className="right">Your fee</th></tr></thead>
              <tbody>
                {['sh-s21pro-14', 's21pro', 's21xph', 's19kpro'].map((id) => {
                  const r = byId(id);
                  const e = econ(r, config.splitStandard, config);
                  return (
                    <tr key={id}>
                      <td className="small">{r.model}</td>
                      <td className={'right mono ' + (e.viable ? '' : 'neg')}>
                        {e.viable ? '+' : '−'}{money(Math.abs(e.you))}
                      </td>
                      <td className={'right mono ' + (e.fee > 0 ? 'ok' : 'neg')}>
                        {e.fee > 0 ? '+' : '−'}{money(Math.abs(e.fee))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Guarantee exposure</h2>
            <p className="small dim">
              SLA credits come out of your fee. Below <b>owner split × SLA</b> a machine costs more in
              credits than it earns you — the identity cancels hashprice, model and power cost, so
              these two numbers are the whole risk model.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th><th className="right">Break-even</th><th className="right">Thu margin</th>
                  <th className="right">Week, fleet</th>
                </tr>
              </thead>
              <tbody>
                {exposure.map((x) => {
                  const m = x.thu.fee - x.thu.credit;
                  return (
                    <tr key={x.sp}>
                      <td>{Math.round(x.sp * 100)}/{Math.round((1 - x.sp) * 100)}</td>
                      <td className="right mono warn">{(x.be * 100).toFixed(1)}%</td>
                      <td className={'right mono ' + (m < 0 ? 'neg' : 'ok')}>
                        {m < 0 ? '−' : '+'}{money(Math.abs(m))}
                      </td>
                      <td className={'right mono ' + (x.fleetWeek < 0 ? 'neg' : 'ok')}>
                        {x.fleetWeek < 0 ? '−' : '+'}{money(Math.abs(x.fleetWeek))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {exposure[1].be > 0.9 && (
              <div className="notice warn">
                <b>The Pro tier is the exposed one.</b> At a {Math.round(config.splitPro * 100)}%
                owner split you need {(exposure[1].be * 100).toFixed(1)}% uptime just to break even on
                the guarantee, while collecting half the fee that funds it. Consider offering the
                guarantee on Standard only, or giving Pro a lower floor.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
