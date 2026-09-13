import React from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import PayoutChart from '../components/PayoutChart.jsx';
import { ME } from '../data/account.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { money } from '../lib/economics.js';

function Tile({ label, value, unit, sub, tone }) {
  return (
    <div className="tile">
      <span className="eyebrow">{label}</span>
      <span className={'tile-value' + (tone ? ' ' + tone : '')}>
        {value}{unit && <small> {unit}</small>}
      </span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

export default function Dashboard({ go, onPickDay }) {
  const { config, myRig, myEcon, series, weekTotal, weekCredit, weekUptime, lifetime } = usePlatform();
  const metSla = weekUptime >= config.uptimeSLA;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Good evening</span>
          <h1>{ME.name}</h1>
        </div>
        <span className="pill run"><i className="dot" />{ME.owned.qty} rig online</span>
      </div>

      <div className="grid tiles">
        <Tile label="Available balance" value={money(ME.balance)} unit={config.ticker}
          sub={`+ ${money(ME.credit)} hosting credit`} />
        <Tile label="Paid this week" value={money(weekTotal)} unit={config.ticker} tone="accent"
          sub={weekCredit > 0 ? `incl. ${money(weekCredit)} uptime credit` : 'no credits needed'} />
        <Tile label="Lifetime payouts" value={money(lifetime)} unit={config.ticker}
          sub={`over ${ME.owned.days} days`} />
        <Tile label="Uptime, 7 days" value={(weekUptime * 100).toFixed(1)} unit="%"
          tone={metSla ? 'ok' : 'warn'}
          sub={metSla ? 'SLA met' : `below ${Math.round(config.uptimeSLA * 100)}% SLA — credited`} />
      </div>

      <div className="split-2">
        <section className="panel">
          <div className="row">
            <h2>Daily payouts</h2>
            <span className="mono accent">+{money(weekTotal)}</span>
          </div>
          <PayoutChart series={series} onPickDay={onPickDay} />
          <p className="small dim">Select any bar to open that day&apos;s settlement.</p>
        </section>

        <section className="panel stack gap-sm">
          <div className="row">
            <h2>Uptime guarantee</h2>
            <span className={'pill ' + (metSla ? 'run' : 'hot')}>
              <i className="dot" />{metSla ? 'Met' : 'Credited'}
            </span>
          </div>
          <div className="frac">
            <span className="track"><i style={{ width: `${(weekUptime * 100).toFixed(1)}%` }} /></span>
            <span className="lbl">SLA {Math.round(config.uptimeSLA * 100)}%</span>
          </div>
          <div className="ledger-row">
            <span className="k">Credited this week</span>
            <span className="v accent">+ {money(weekCredit)} {config.ticker}</span>
          </div>
          <p className="small dim">
            Covers downtime only. Your payout still moves with hashprice — that risk is yours,
            the same as owning the machine outright.
          </p>
        </section>
      </div>

      <section className="panel">
        <h2>Your hardware</h2>
        <div className="rig-row">
          <div className="media thumb"><RigDrawing rig={myRig} /></div>
          <div className="stack">
            <h3>{myRig.model}</h3>
            <span className="mono dim small">SN {ME.owned.serial} · {myRig.site}</span>
            <span className="pill run"><i className="dot" />Hashing</span>
          </div>
          <div className="stack end">
            <span className="yield">+{money(myEcon.you)}</span>
            <span className="eyebrow">per day, net</span>
          </div>
        </div>
        <dl className="specs four">
          <div><dt>Live hashrate</dt><dd className="ok">231.6<small>TH/s</small></dd></div>
          <div><dt>Board temp</dt><dd>64<small>°C</small></dd></div>
          <div><dt>Fan</dt><dd>4250<small>rpm</small></dd></div>
          <div><dt>Split</dt><dd>{Math.round(ME.owned.share * 100)}/{Math.round((1 - ME.owned.share) * 100)}</dd></div>
        </dl>
        <div className="row gap">
          <button className="btn primary" onClick={() => go('settlement')}>Daily settlements</button>
          <button className="btn" onClick={() => go('machines')}>Add another machine</button>
        </div>
      </section>
    </div>
  );
}
