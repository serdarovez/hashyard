import React, { useState } from 'react';
import { CopyButton, Loading, SignInGate, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { econ, money, round } from '../lib/economics.js';

/**
 * What an invited customer's machines should pay the referrer, at today's
 * hashprice and full running time: the machines' profit after electricity,
 * Hashyard's fee on it (1 - split), and the referral share of that fee.
 * Settlement pays the same formula from each day's published profit.
 */
function estimateFor(holdings, rigs, config) {
  let profit = 0, fee = 0;
  for (const h of holdings || []) {
    const rig = rigs.find((r) => r.id === h.machine_id);
    if (!rig) continue;
    const net = Math.max(econ(rig, Number(h.split), config).net, 0);
    profit += net;
    fee += net * (1 - Number(h.split));
  }
  const perDay = fee * config.referralShare;
  return { profit, fee, perDay, perMonth: perDay * 30, perYear: perDay * 365 };
}

function Breakdown({ person, est, config }) {
  const t = config.ticker;
  const standardFee = Math.round((1 - config.splitStandard) * 100);
  const proFee = Math.round((1 - config.splitPro) * 100);
  const sharePct = Math.round(config.referralShare * 100);
  return (
    <section className="panel stack gap-sm">
      <h2>What {person.name} brings you</h2>
      <p className="lede">
        {person.name} bought <b>{round(Number(person.bought))} {t}</b> of machines
        ({person.machines} {person.machines === 1 ? 'machine' : 'machines'}).
      </p>
      <div className="history">
        <div className="history-row"><span>Their machines make, after electricity</span><span className="mono">about {money(est.profit)} a day</span></div>
        <div className="history-row"><span>Hashyard&apos;s fee on that ({standardFee}% on Standard, {proFee}% on Pro)</span><span className="mono">{money(est.fee)} a day</span></div>
        <div className="history-row"><span>Your {sharePct}% of the fee</span><span className="v">{money(est.perDay)} a day</span></div>
        <div className="history-row"><span>That adds up to about</span><span className="v">{money(est.perMonth)} a month · {money(est.perYear)} a year</span></div>
        <div className="history-row"><span>Paid to you so far</span><span className="mono">{money(Number(person.earned))} {t}</span></div>
      </div>
      <p className="small dim">
        {Number(person.earned) > 0
          ? 'An estimate at today\'s bitcoin price. What you are actually paid follows each day\'s published profit, so it moves with the price.'
          : `${person.name}'s machines start mining the day after purchase, so your first share arrives once that day's profit is published. The figures above are an estimate at today's bitcoin price.`}
      </p>
    </section>
  );
}

function ReferralsInner() {
  const { api, config, profile, ledger, machines: rigs } = useApp();
  const { data: people, loading } = useLoad(() => api.myReferrals(), []);
  const [picked, setPicked] = useState(null);

  const link = `${window.location.origin}${window.location.pathname}?ref=${profile?.referral_code || ''}`;
  const earned = ledger.filter((l) => l.kind === 'referral').reduce((a, l) => a + Number(l.amount), 0);
  const ownerPct = Math.round(config.splitStandard * 100);
  const yourCut = (1 - config.splitStandard) * config.referralShare * 100;

  const rows = (people || []).map((p) => ({ ...p, est: estimateFor(p.holdings, rigs, config) }));
  const bought = rows.reduce((a, p) => a + Number(p.bought || 0), 0);
  const perMonth = rows.reduce((a, p) => a + p.est.perMonth, 0);
  // show the breakdown for the chosen person, or whoever bought the most
  const selected = rows.find((p, i) => i === picked)
    || rows.reduce((best, p) => (!best || Number(p.bought) > Number(best.bought) ? p : best), null);

  return (
    <div className="page narrow">
      <h1>Invite &amp; earn</h1>

      <div className="grid tiles">
        <div className="tile">
          <span className="eyebrow">Earned from referrals</span>
          <span className="tile-value accent">{money(earned)}<small> {config.ticker}</small></span>
          <span className="tile-sub">paid into your balance every day</span>
        </div>
        <div className="tile">
          <span className="eyebrow">People you invited</span>
          <span className="tile-value">{people ? people.length : '—'}</span>
          <span className="tile-sub">{rows.filter((p) => p.machines > 0).length} own a machine</span>
        </div>
        <div className="tile">
          <span className="eyebrow">They bought</span>
          <span className="tile-value">{round(bought)}<small> {config.ticker}</small></span>
          <span className="tile-sub">about {money(perMonth)} a month for you</span>
        </div>
      </div>

      <div className="panel stack gap-sm">
        <h2>Your invite link</h2>
        <div className="row gap">
          <span className="mono grow invite-link">{link}</span>
          <CopyButton text={link} label="Copy link" />
        </div>
        <p className="small dim">Or share your code: <b className="mono">{profile?.referral_code}</b></p>
      </div>

      <section className="panel">
        <h2>Invited</h2>
        {loading ? <Loading /> : !rows.length ? (
          <p className="small dim">Nobody yet. Share your link to get started.</p>
        ) : (
          <div className="table-wrap">
            <table className="table ref-table">
              <thead>
                <tr>
                  <th>Name</th><th className="opt">Joined</th><th className="right">Bought</th>
                  <th className="right opt">Machines</th><th className="right">You earned</th><th className="right">Per month</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={i} className={p === selected ? 'is-picked' : undefined}>
                    <td>
                      <button type="button" className="linkish" onClick={() => setPicked(i)} aria-pressed={p === selected}>{p.name}</button>
                    </td>
                    <td className="small dim opt">{fmtDate(p.joined)}</td>
                    <td className="right mono">{Number(p.bought) > 0 ? round(Number(p.bought)) : '—'}</td>
                    <td className="right mono opt">{p.machines || '—'}</td>
                    <td className={'right mono ' + (Number(p.earned) > 0 ? 'accent' : 'dim')}>
                      {Number(p.earned) > 0 ? '+' + money(Number(p.earned)) : '—'}
                    </td>
                    <td className="right mono dim">{p.est.perMonth > 0 ? '≈ ' + money(p.est.perMonth) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 1 && <p className="small dim">Tap a name to see how their share is worked out.</p>}
      </section>

      {selected && selected.machines > 0 && <Breakdown person={selected} est={selected.est} config={config} />}

      <div className="panel stack gap-sm">
        <h2>How it pays</h2>
        <p>
          When someone joins through your link and buys a machine, you get <b className="accent">{Math.round(config.referralShare * 100)}% of our fee</b> on
          it — every day, for as long as it runs. It comes from our share, never from theirs.
        </p>
        <div className="prop" role="img" aria-label={`Of each day's earnings: ${ownerPct}% to the owner, the rest to Hashyard, of which ${yourCut.toFixed(0)}% goes to you`}>
          <i className="yours" style={{ width: `${ownerPct}%` }} />
          <i className="cost" style={{ width: `${100 - ownerPct - yourCut}%` }} />
          <i className="fee" style={{ width: `${yourCut}%` }} />
        </div>
        <div className="row">
          <span className="eyebrow">Owner {ownerPct}%</span>
          <span className="eyebrow">Hashyard {(100 - ownerPct - yourCut).toFixed(0)}%</span>
          <span className="eyebrow">You {yourCut.toFixed(0)}%</span>
        </div>
      </div>

      <p className="small dim">
        Nothing is paid for someone just signing up or sending money — only for machines that actually run.
      </p>
    </div>
  );
}

export default function Referrals() {
  return <SignInGate why="to invite friends"><ReferralsInner /></SignInGate>;
}
