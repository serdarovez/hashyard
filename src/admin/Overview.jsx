import React, { useMemo } from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { byId } from '../data/catalog.js';
import { dayEcon, econ, money, round } from '../lib/economics.js';
import { WEEK } from '../data/account.js';

/**
 * The operator's daily P&L, computed from the same functions the customer
 * pages use. Fee income and SLA liability come out of one model, so the
 * margin here can never disagree with what a customer is shown.
 */
export default function Overview({ go }) {
  const { config, fleet, withdrawals, users, orders } = usePlatform();

  const kpi = useMemo(() => {
    let hash = 0, watts = 0, gross = 0, power = 0, fee = 0, credit = 0, owed = 0;
    for (const unit of fleet) {
      const rig = byId(unit.rigId);
      if (!rig) continue;
      const share = unit.owner === 'pool' ? 1 : config.splitStandard;
      const day = dayEcon({ hp: 1, up: unit.online ? unit.uptime : 0 }, rig, share, config);
      hash += rig.unit === 'TH/s' ? rig.hash * (unit.online ? unit.uptime : 0) : 0;
      watts += unit.online ? rig.watts : 0;
      gross += day.gross;
      power += day.power;
      owed += day.paid;
      if (unit.owner !== 'pool') {
        fee += day.fee;
        credit += day.credit;
      }
    }
    return { hash, watts, gross, power, fee, credit, owed, margin: fee - credit };
  }, [fleet, config]);

  const pending = withdrawals.filter((w) => w.status === 'pending');
  const pendingValue = pending.reduce((a, b) => a + b.amount, 0);
  const down = fleet.filter((r) => !r.online);

  const tiles = [
    { l: 'Fleet hashrate', v: round(kpi.hash), u: 'TH/s', s: `${fleet.filter((f) => f.online).length} of ${fleet.length} online` },
    { l: 'Power draw', v: (kpi.watts / 1000).toFixed(1), u: 'kW', s: `${money((kpi.watts / 1000) * 24 * config.powerRate)} per day` },
    { l: 'Mined today', v: money(kpi.gross), u: config.ticker, s: `less ${money(kpi.power)} power` },
    { l: 'Owed to customers', v: money(kpi.owed), u: config.ticker, s: 'settles 00:07 UTC' },
    { l: 'Fee income', v: money(kpi.fee), u: config.ticker, s: `${Math.round((1 - config.splitStandard) * 100)}% of customer net`, tone: 'ok' },
    { l: 'SLA credits', v: money(kpi.credit), u: config.ticker, s: 'paid out of fee', tone: kpi.credit > 0 ? 'warn' : undefined },
    { l: 'Margin today', v: money(Math.abs(kpi.margin)), u: config.ticker, s: kpi.margin < 0 ? 'LOSS' : 'fee less credits', tone: kpi.margin < 0 ? 'neg' : 'ok' },
    { l: 'Withdrawals queued', v: pending.length, u: '', s: `${money(pendingValue)} ${config.ticker}`, tone: pending.length ? 'warn' : undefined }
  ];

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">9 September 2026</span>
          <h1>Overview</h1>
        </div>
        <span className="pill run"><i className="dot" />Settlement healthy</span>
      </div>

      <div className="grid tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.l}>
            <span className="eyebrow">{t.l}</span>
            <span className={'tile-value' + (t.tone ? ' ' + t.tone : '')}>
              {t.v}{t.u && <small> {t.u}</small>}
            </span>
            <span className="tile-sub">{t.s}</span>
          </div>
        ))}
      </div>

      {(down.length > 0 || pending.length > 0) && (
        <div className="admin-alerts">
          {down.map((r) => (
            <div className="notice warn" key={r.sn}>
              <b>{r.sn} is offline.</b> {byId(r.rigId)?.model} at {r.site}, {(r.uptime * 100).toFixed(1)}%
              uptime this week — below the {Math.round(config.uptimeSLA * 100)}% floor, so it is accruing
              SLA credits against your fee. <button className="linkish" onClick={() => go('admin-fleet')}>Open fleet</button>
            </div>
          ))}
          {pending.length > 0 && (
            <div className="notice info">
              <b>{pending.length} withdrawal{pending.length > 1 ? 's' : ''} waiting.</b>{' '}
              {money(pendingValue)} {config.ticker} total.{' '}
              <button className="linkish" onClick={() => go('admin-withdrawals')}>Review queue</button>
            </div>
          )}
        </div>
      )}

      <div className="split-2">
        <section className="panel">
          <h2>Week to date</h2>
          <table className="table">
            <thead>
              <tr><th>Day</th><th className="right">Fee</th><th className="right">Credits</th><th className="right">Margin</th></tr>
            </thead>
            <tbody>
              {WEEK.map((d) => {
                const rig = byId('s21pro');
                const paying = fleet.filter((f) => f.owner !== 'pool').length;
                const one = dayEcon(d, rig, config.splitStandard, config);
                const f = one.fee * paying, c = one.credit * paying, m = f - c;
                return (
                  <tr key={d.d}>
                    <td>{d.d} <span className="dim small">{d.date}</span></td>
                    <td className="right mono">{money(f)}</td>
                    <td className={'right mono ' + (c > 0 ? 'warn' : 'dim')}>{c > 0 ? '−' + money(c) : '—'}</td>
                    <td className={'right mono ' + (m < 0 ? 'neg' : 'ok')}>{m < 0 ? '−' : '+'}{money(Math.abs(m))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small dim">
            Modelled across the {fleet.filter((f) => f.owner !== 'pool').length} customer-owned units.
            Pool-owned machines pay no fee because you already keep all of their output.
          </p>
        </section>

        <section className="panel">
          <h2>Recent orders</h2>
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th className="right">Value</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono small">{o.id}<span className="dim"> · {o.when}</span></td>
                  <td>{o.user}</td>
                  <td className="right mono">{round(o.amount)}</td>
                  <td><span className={'pill ' + (o.status === 'filled' ? 'run' : o.status === 'cancelled' ? 'mute' : 'hot')}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <span className="eyebrow">{users.length} customers</span>
            <button className="linkish" onClick={() => go('admin-users')}>All customers →</button>
          </div>
        </section>
      </div>
    </div>
  );
}
