import React from 'react';
import { WEEK, ME } from '../data/account.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { dayEcon, econ, breakEvenUptime, hashpriceLabel, money } from '../lib/economics.js';

export default function Settlement({ day, setDay }) {
  const { config, myRig } = usePlatform();
  const share = ME.owned.share;
  const s = dayEcon(WEEK[day], myRig, share, config);
  const hours = s.up * 24;
  const margin = s.fee - s.credit;
  const kwh = (myRig.watts / 1000) * 24 * s.up;

  return (
    <div className="page narrow">
      <h1>Settlement</h1>

      <div className="seg wide">
        {WEEK.map((w, i) => (
          <button key={w.d} aria-pressed={i === day} onClick={() => setDay(i)}>{w.d}</button>
        ))}
      </div>

      <div className="stack gap-sm">
        <span className="eyebrow">{s.date} 2026 · 00:00–23:59 UTC</span>
        <div className="big-price accent">+{money(s.paid)} <small>{config.ticker}</small></div>
        <span className="mono dim small">Credited to balance at 00:07 UTC</span>
      </div>

      <div className="panel stack gap-sm">
        <div className="ledger-row">
          <span className="k">{myRig.coin} mined @ {hashpriceLabel(myRig, config)} × {s.hp.toFixed(2)}</span>
          <span className="v">{money(s.gross)}</span>
        </div>
        <div className="ledger-row">
          <span className="k">Power · {kwh.toFixed(1)} kWh @ ${config.powerRate.toFixed(3)}</span>
          <span className="v dim">− {money(s.power)}</span>
        </div>
        <div className="ledger-row">
          <span className="k">Platform fee · {Math.round((1 - share) * 100)}% of net</span>
          <span className="v dim">− {money(s.fee)}</span>
        </div>
        {s.credit > 0 && (
          <div className="ledger-row">
            <span className="k accent">Uptime credit · SLA {Math.round(config.uptimeSLA * 100)}%</span>
            <span className="v accent">+ {money(s.credit)}</span>
          </div>
        )}
        <hr className="rule" />
        <div className="ledger-row total">
          <span className="k">Your payout</span>
          <span className="v">{money(s.paid)} {config.ticker}</span>
        </div>
      </div>

      <div className="panel stack gap-sm">
        <div className="row">
          <span className="eyebrow">Uptime</span>
          <span className={'pill ' + (s.up >= config.uptimeSLA ? 'run' : 'hot')}>
            <i className="dot" />{(s.up * 100).toFixed(1)}% · {Math.floor(hours)}h {Math.round((hours % 1) * 60)}m
          </span>
        </div>
        <div className="frac">
          <span className="track"><i style={{ width: `${(s.up * 100).toFixed(1)}%` }} /></span>
          <span className="lbl">SLA {Math.round(config.uptimeSLA * 100)}%</span>
        </div>
        <div className="ledger-row"><span className="k">Event</span><span className="v small">{s.note}</span></div>
      </div>

      {s.credit > 0 && (
        <>
          <div className="notice info">
            <b>The guarantee paid {money(s.credit)} today.</b> Your machine hashed {(s.up * 100).toFixed(1)}%
            of the day; we topped the payout up to what {Math.round(config.uptimeSLA * 100)}% uptime would
            have earned at today&apos;s hashprice. It covers downtime only — never a fall in hashprice.
          </div>

          <div className="panel stack gap-sm">
            <span className="eyebrow">Who paid for it</span>
            <div className="ledger-row"><span className="k">Hashyard&apos;s fee today</span><span className="v">{money(s.fee)}</span></div>
            <div className="ledger-row"><span className="k">Credit paid to you</span><span className="v">− {money(s.credit)}</span></div>
            <hr className="rule" />
            <div className="ledger-row">
              <span className="k"><b>Hashyard&apos;s margin</b></span>
              <span className={'v ' + (margin < 0 ? 'neg' : 'ok')}>
                {margin < 0 ? '−' : '+'} {money(Math.abs(margin))}
              </span>
            </div>
            <p className="small dim">
              Claims come out of our fee, not a separate reserve. Below {(breakEvenUptime(share, config) * 100).toFixed(1)}%
              uptime — your split times the SLA — we earn nothing and pay the difference ourselves.
              We show it so you can check the guarantee has a real source.
            </p>
          </div>
        </>
      )}

      <div className="panel stack gap-sm">
        <span className="eyebrow">How it was measured</span>
        <div className="ledger-row"><span className="k">Accepted shares</span><span className="v">{(myRig.hash * 0.99 * s.up).toFixed(1)} TH/s avg</span></div>
        <div className="ledger-row"><span className="k">Pool</span><span className="v">Braiins · FPPS</span></div>
        <div className="ledger-row"><span className="k">Metered draw</span><span className="v">{kwh.toFixed(1)} kWh</span></div>
      </div>

      <p className="small dim">
        Settlement is FPPS: you are paid for the shares your machine submitted, not for blocks the
        pool happened to find. Power is metered at the PDU, not estimated.
      </p>
    </div>
  );
}
