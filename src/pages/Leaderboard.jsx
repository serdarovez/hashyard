import React, { useState } from 'react';
import { Empty, Loading, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money, round } from '../lib/economics.js';

const PERIODS = [
  ['all', 'All time'],
  ['30d', 'Last 30 days']
];

/**
 * The biggest buyers. "Deposited" is what a customer has paid for machines:
 * the database counts only PAID orders, so unpaid or disputed orders can never
 * push someone up the board.
 *
 * The ranking is done in the database for the chosen period, rather than by
 * re-sorting the all-time top 20 here - otherwise someone who bought a lot
 * this month but sits outside the all-time top 20 would never appear.
 */
export default function Leaderboard({ go }) {
  const { api, config, session, profile } = useApp();
  const [period, setPeriod] = useState('all');
  const board = useLoad(() => api.leaderboard(period, 20), [period]);
  const stats = useLoad(() => api.platformStats(), []);

  const rows = board.data || [];
  const mine = rows.find((r) => r.is_me);
  const s = stats.data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Paid orders only</span>
          <h1>Leaderboard</h1>
        </div>
        <div className="seg">
          {PERIODS.map(([k, l]) => (
            <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      {s && (
        <div className="grid tiles">
          <div className="tile">
            <span className="eyebrow">Total bought</span>
            <span className="tile-value accent">{round(Number(s.deposited_total))}<small> {config.ticker}</small></span>
            <span className="tile-sub">{round(Number(s.deposited_30d))} in the last 30 days</span>
          </div>
          <div className="tile">
            <span className="eyebrow">Buyers</span>
            <span className="tile-value">{s.buyers}</span>
            <span className="tile-sub">{s.machines} machines running</span>
          </div>
          <div className="tile">
            <span className="eyebrow">Paid out to buyers</span>
            <span className="tile-value">{round(Number(s.paid_total))}<small> {config.ticker}</small></span>
            <span className="tile-sub">over {s.days_paid} published days</span>
          </div>
          {mine && (
            <div className="tile">
              <span className="eyebrow">Your place</span>
              <span className="tile-value accent">#{mine.place}</span>
              <span className="tile-sub">{money(Number(mine.deposited))} {config.ticker} bought</span>
            </div>
          )}
        </div>
      )}

      {board.loading ? <Loading label="Loading the board…" /> : board.error ? (
        <Empty title="Couldn't load the leaderboard">{String(board.error.message)}</Empty>
      ) : !rows.length ? (
        <Empty title={period === '30d' ? 'No purchases in the last 30 days' : 'Nobody is on the board yet'}
          action={<button className="btn primary" onClick={() => go('machines')}>Browse machines</button>}>
          The board fills up as people buy machines.
        </Empty>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table board">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Miner</th>
                  <th className="right">Bought{period === '30d' ? ' (30 days)' : ''}</th>
                  <th className="right">Machines</th>
                  <th className="right">Earned so far</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.alias + r.place} className={r.is_me ? 'is-me' : undefined}>
                    <td><span className={'place' + (r.place <= 3 ? ' top' : '')}>{r.place}</span></td>
                    <td>{r.alias}{r.is_me && <span className="pill hot"> you</span>}</td>
                    <td className="right mono accent">{money(Number(r.deposited))}</td>
                    <td className="right mono">{r.machines}</td>
                    <td className="right mono dim">{money(Number(r.earned_total))}</td>
                    <td className="small dim">{fmtDate(r.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="small dim">
        &quot;Bought&quot; is the total paid for machines over TRC-20 — Hashyard never holds deposits. Everyone appears as an anonymous miner unless they choose to
        show their name, and anyone can leave the board.{' '}
        {session && (
          <>You are shown as <b>{profile?.leaderboard === 'name' ? 'your name' : profile?.leaderboard === 'hidden' ? 'hidden' : 'an anonymous miner'}</b> —{' '}
            <button className="linkish" onClick={() => go('wallet')}>change this in your wallet</button>.</>
        )}
      </p>
    </div>
  );
}
