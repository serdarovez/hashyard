import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { ME, REF_TOTAL } from '../data/account.js';
import { money } from '../lib/economics.js';

export default function Referrals() {
  const { config } = usePlatform();
  const ownerPct = Math.round(config.splitStandard * 100);
  const platformPct = Math.round((1 - config.splitStandard) * 100);
  const yourCut = (1 - config.splitStandard) * config.referralShare * 100;
  const theirs = platformPct - yourCut;

  return (
    <div className="page narrow">
      <h1>Invite &amp; earn</h1>

      <div className="grid tiles two">
        <div className="tile">
          <span className="eyebrow">Earned from referrals</span>
          <span className="tile-value accent">{money(REF_TOTAL)}<small> {config.ticker}</small></span>
          <span className="tile-sub">{ME.invites.filter((i) => i.live).length} active · paid daily</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Your cut</span>
          <span className="tile-value">{Math.round(config.referralShare * 100)}<small> %</small></span>
          <span className="tile-sub">of our fee, for as long as their machine runs</span>
        </div>
      </div>

      <div className="panel stack gap-sm">
        <h2>How it pays</h2>
        <p>
          When someone you invited runs a machine, you get{' '}
          <b className="accent">{Math.round(config.referralShare * 100)}% of the platform&apos;s fee</b> on
          it — every day, for as long as it hashes. It comes out of our cut of real mining revenue,
          never out of their deposit and never out of their payout.
        </p>
        <div className="prop" role="img"
          aria-label={`Of net revenue: ${ownerPct}% to the owner, ${theirs.toFixed(0)}% to Hashyard, ${yourCut.toFixed(0)}% to you`}>
          <i className="yours" style={{ width: `${ownerPct}%` }} />
          <i className="cost" style={{ width: `${theirs}%` }} />
          <i className="fee" style={{ width: `${yourCut}%` }} />
        </div>
        <div className="row">
          <span className="eyebrow">Owner {ownerPct}%</span>
          <span className="eyebrow">Hashyard {theirs.toFixed(0)}%</span>
          <span className="eyebrow">You {yourCut.toFixed(0)}%</span>
        </div>
      </div>

      <div className="field">
        <label>Your invite link</label>
        <span className="val">hashyard.io/r/{ME.handle}</span>
      </div>
      <div className="row gap">
        <button className="btn">Copy link</button>
        <button className="btn primary">Share</button>
      </div>

      <h2 className="section-head">Invited · {ME.invites.length}</h2>
      <table className="table">
        <thead>
          <tr><th>Person</th><th>Joined</th><th>Machines</th><th className="right">Earned</th><th>Status</th></tr>
        </thead>
        <tbody>
          {ME.invites.map((v) => (
            <tr key={v.n}>
              <td><span className="avatar sm">{v.i}</span> {v.n}</td>
              <td className="mono small dim">{v.since}</td>
              <td className="mono small">{v.rigs || '—'}</td>
              <td className={'right mono ' + (v.earned ? 'accent' : 'dim')}>
                {v.earned ? '+' + money(v.earned) : '—'}
              </td>
              <td><span className={'pill ' + (v.live ? 'run' : 'mute')}>{v.live ? 'Earning' : 'Idle'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="small dim">
        No bonus is paid for a deposit on its own — only for hardware that actually runs. A referral
        who never buys a machine earns nothing, for you or for us. That is what keeps this an
        affiliate programme rather than a recruitment scheme.
      </p>
    </div>
  );
}
