import React, { useState } from 'react';
import { ME, TX_LABEL } from '../data/account.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { money } from '../lib/economics.js';

const TABS = [
  ['deposit', 'Deposit'],
  ['withdraw', 'Withdraw'],
  ['activity', 'Activity']
];

const TX_FILTERS = [
  ['all', 'All'],
  ['earn', 'Earnings'],
  ['chain', 'On-chain'],
  ['buy', 'Purchases']
];

/** A placeholder mark, not a scannable code. Deterministic from the address. */
function QrMark({ seed }) {
  const N = 25;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const finder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!finder && rnd() > 0.5) cells.push([x, y]);
    }
  }
  const Finder = ({ x, y }) => (
    <g>
      <rect x={x * 4} y={y * 4} width={28} height={28} fill="#000" />
      <rect x={(x + 1) * 4} y={(y + 1) * 4} width={20} height={20} fill="#fff" />
      <rect x={(x + 2) * 4} y={(y + 2) * 4} width={12} height={12} fill="#000" />
    </g>
  );
  return (
    <svg className="qr" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x * 4} y={y * 4} width={4} height={4} fill="#000" />)}
      <Finder x={0} y={0} /><Finder x={N - 7} y={0} /><Finder x={0} y={N - 7} />
    </svg>
  );
}

export default function Wallet() {
  const { config, tx } = usePlatform();
  const [tab, setTab] = useState('deposit');
  const [pct, setPct] = useState(1);
  const [filter, setFilter] = useState('all');

  const amount = ME.balance * pct;
  const below = amount < config.withdrawMin;
  const rows = tx.filter((t) => filter === 'all' || t.on === filter);
  const earned = tx.filter((t) => t.on === 'earn').reduce((a, b) => a + b.amt, 0);

  return (
    <div className="page narrow">
      <h1>Wallet</h1>

      <div className="grid tiles two">
        <div className="tile">
          <span className="eyebrow">Available balance</span>
          <span className="tile-value">{money(ME.balance)}<small> {config.ticker}</small></span>
          <span className="tile-sub">+ {money(ME.credit)} hosting credit (not withdrawable)</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Earned to date</span>
          <span className="tile-value accent">{money(earned)}<small> {config.ticker}</small></span>
          <span className="tile-sub">payouts, uptime credits, referral share</span>
        </div>
      </div>

      <div className="seg wide">
        {TABS.map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'deposit' && (
        <>
          <div className="notice info">
            <b>First deposit bonus.</b> We add {Math.round(config.firstDeposit * 100)}% of your first
            deposit as hosting credit — up to {config.firstDepCap} {config.ticker} — applied against
            your electricity and platform fees.
          </div>
          <div className="panel deposit-panel">
            <span className="pill mute">{config.network}</span>
            <QrMark seed={ME.address} />
            <div className="field">
              <label>Your deposit address</label>
              <span className="val">{ME.address}</span>
            </div>
            <button className="btn">Copy address</button>
          </div>
          <div className="notice warn">
            <b>{config.network} only.</b> Sending {config.ticker} over ERC-20, BEP-20 or any other
            network to this address will lose the funds permanently. There is no recovery.
          </div>
          <div className="panel stack gap-sm">
            <div className="ledger-row"><span className="k">Minimum deposit</span><span className="v">10.00 {config.ticker}</span></div>
            <div className="ledger-row"><span className="k">Confirmations</span><span className="v">19</span></div>
            <div className="ledger-row"><span className="k">Typical arrival</span><span className="v">~1 min</span></div>
            <div className="ledger-row"><span className="k">Deposit fee</span><span className="v ok">None</span></div>
          </div>
        </>
      )}

      {tab === 'withdraw' && (
        <>
          <div className="panel stack center">
            <span className="eyebrow">Amount</span>
            <div className="big-price">{money(amount)}</div>
            <span className="mono dim small">of {money(ME.balance)} available · {config.network}</span>
            <div className="row gap wide-row">
              {[['25%', 0.25], ['50%', 0.5], ['Max', 1]].map(([l, v]) => (
                <button key={l} className="btn" aria-pressed={pct === v} onClick={() => setPct(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Destination address</label>
            <span className="val">{ME.payoutAddress}</span>
          </div>
          <div className="panel stack gap-sm">
            <div className="ledger-row"><span className="k">You withdraw</span><span className="v">{money(amount)}</span></div>
            <div className="ledger-row"><span className="k">Network fee</span><span className="v dim">− {money(config.withdrawFee)}</span></div>
            <hr className="rule" />
            <div className="ledger-row total">
              <span className="k">They receive</span>
              <span className="v">{money(Math.max(0, amount - config.withdrawFee))} {config.ticker}</span>
            </div>
          </div>
          <div className="notice warn">
            Check the address character by character. {config.network} transfers are irreversible and
            cannot be recalled by Hashyard or by Tron.
          </div>
          <button className="btn primary wide" disabled={below}>
            {below ? `Minimum is ${money(config.withdrawMin)} ${config.ticker}` : `Withdraw ${money(amount)} ${config.ticker}`}
          </button>
        </>
      )}

      {tab === 'activity' && (
        <>
          <div className="seg wide">
            {TX_FILTERS.map(([k, l]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Detail</th><th>When</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}>
                  <td>{TX_LABEL[t.t]}</td>
                  <td className="mono small dim">{t.note}{t.hash ? ` · ${t.hash}` : ''}</td>
                  <td className="mono small dim">{t.d}</td>
                  <td className={'right mono ' + (t.amt > 0 ? 'accent' : 'dim')}>
                    {t.amt > 0 ? '+' : '−'} {money(Math.abs(t.amt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small dim">
            On-chain rows carry a Tron transaction hash you can verify on Tronscan yourself.
            Everything else settles inside Hashyard.
          </p>
        </>
      )}
    </div>
  );
}
