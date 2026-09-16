import React, { useMemo } from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import PayoutChart from '../components/PayoutChart.jsx';
import { Empty, Loading, SignInGate, fmtDate } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { exact, money, round } from '../lib/economics.js';

const EARN = new Set(['earning', 'sla_credit', 'referral']);

function Tile({ label, value, unit, sub, tone }) {
  return (
    <div className="tile">
      <span className="eyebrow">{label}</span>
      <span className={'tile-value' + (tone ? ' ' + tone : '')}>{value}{unit && <small> {unit}</small>}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

function DashboardInner({ go }) {
  const { config, profile, balance, ledger, holdings, orders, machines, accountReady } = useApp();

  // one bar per paid day: machine earnings, with the guarantee top-up marked
  const series = useMemo(() => {
    const byDay = new Map();
    for (const l of ledger) {
      if (!l.day || !EARN.has(l.kind)) continue;
      const d = byDay.get(l.day) || { paid: 0, credit: 0 };
      d.paid += Number(l.amount);
      if (l.kind === 'sla_credit') d.credit += Number(l.amount);
      byDay.set(l.day, d);
    }
    return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, v]) => ({ key: day, day, d: fmtDate(day), ...v }));
  }, [ledger]);
  const last7 = series.slice(-7);

  if (!accountReady) return <div className="page"><Loading label="Loading your account…" /></div>;

  const earnedTotal = ledger.filter((l) => Number(l.amount) > 0 && l.kind !== 'withdrawal_reversal')
    .reduce((a, l) => a + Number(l.amount), 0);
  const week = last7.reduce((a, s) => a + s.paid, 0);
  const unpaid = orders.filter((o) => o.status === 'awaiting_payment');
  const bought = orders.filter((o) => o.status === 'paid').reduce((a, o) => a + Number(o.price), 0);
  const earnedBy = (hid) => ledger.filter((l) => l.holding_id === hid && EARN.has(l.kind))
    .reduce((a, l) => a + Number(l.amount), 0);
  const first = (profile?.full_name || '').split(' ')[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Your dashboard</span>
          <h1>{first ? `Hi, ${first}` : 'Welcome'}</h1>
        </div>
        {holdings.length > 0 && <span className="pill run"><i className="dot" />{holdings.length} machine{holdings.length > 1 ? 's' : ''} earning</span>}
      </div>

      <div className="grid tiles">
        <Tile label="Machines bought" value={round(bought)} unit={config.ticker}
          sub={holdings.length ? `${holdings.length} machine${holdings.length > 1 ? 's' : ''} you own` : 'none yet'} />
        <Tile label="Earnings to withdraw" value={money(balance)} unit={config.ticker} tone="accent" sub="profit your machines made, not yet withdrawn" />
        <Tile label="Last 7 paid days" value={money(week)} unit={config.ticker} />
        <Tile label="Earned so far" value={money(earnedTotal)} unit={config.ticker} sub="including cashback" />
      </div>

      {unpaid.length > 0 && (
        <section className="panel stack gap-sm">
          <h2>Waiting for your payment</h2>
          {unpaid.map((o) => (
            <div className="row" key={o.id}>
              <span>{machines.find((m) => m.id === o.machine_id)?.model || o.machine_id} · {exact(o.pay_amount)} {config.ticker}</span>
              <button className="btn tiny primary" onClick={() => go('pay', o.id)}>Continue payment</button>
            </div>
          ))}
        </section>
      )}

      <button className="panel board-teaser" onClick={() => go('leaderboard')}>
        <div className="stack gap-sm">
          <h2>Leaderboard</h2>
          <span className="small dim">The biggest buyers on Hashyard. You appear anonymously unless you choose otherwise.</span>
        </div>
        <span className="dim">→</span>
      </button>

      {holdings.length === 0 ? (
        <Empty title="You don't own any machines yet"
          action={<button className="btn primary" onClick={() => go('machines')}>Browse machines</button>}>
          Buy a whole machine or a share of one, and it starts earning the next day.
        </Empty>
      ) : (
        <>
          <section className="panel">
            <div className="row"><h2>Daily payouts</h2><span className="mono accent">+{money(week)}</span></div>
            {last7.length ? (
              <PayoutChart series={last7} />
            ) : (
              <p className="small dim">Your first payout appears here the morning after your machine&apos;s first full day.</p>
            )}
          </section>

          {series.length > 0 && (
            <section className="panel">
              <h2>Earnings history</h2>
              <div className="history">
                {[...series].reverse().slice(0, 30).map((s) => (
                  <div className="history-row" key={s.day}>
                    <span>{fmtDate(s.day)}</span>
                    <span className="v">+{money(s.paid)} {config.ticker}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel stack">
            <h2>Your machines</h2>
            {holdings.map((h) => {
              const rig = machines.find((m) => m.id === h.machine_id);
              return (
                <div className="rig-row" key={h.id}>
                  {rig && <div className="media thumb"><RigDrawing rig={rig} /></div>}
                  <div className="stack">
                    <h3>{rig?.model || h.machine_id}</h3>
                    <span className="small dim">You keep {Math.round(h.split * 100)}% · earning since {fmtDate(h.started_on)}</span>
                  </div>
                  <div className="stack end">
                    <span className="yield">+{money(earnedBy(h.id))}</span>
                    <span className="eyebrow">earned so far</span>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

export default function Dashboard(props) {
  return <SignInGate why="to see your dashboard"><DashboardInner {...props} /></SignInGate>;
}
