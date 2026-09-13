import React from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { byId } from '../data/catalog.js';
import { dayEcon, money } from '../lib/economics.js';

export default function Customers() {
  const { users, fleet, config, withdrawals } = usePlatform();

  const rowsFor = (name) => fleet.filter((f) => f.owner === name);

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{users.length} accounts</span>
          <h1>Customers</h1>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th><th>Joined</th><th>Identity</th><th className="right">Balance</th>
              <th className="right">Machines</th><th className="right">Owed / day</th>
              <th className="right">Fee / day</th><th>Referred by</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const owned = rowsFor(u.name);
              let owed = 0, fee = 0;
              for (const unit of owned) {
                const rig = byId(unit.rigId);
                if (!rig) continue;
                const d = dayEcon({ hp: 1, up: unit.online ? unit.uptime : 0 }, rig, config.splitStandard, config);
                owed += d.paid;
                fee += d.fee - d.credit;
              }
              return (
                <tr key={u.id}>
                  <td>
                    <span className="avatar sm">{u.name.split(' ').map((s) => s[0]).join('')}</span>
                    {u.name}<span className="dim small"> @{u.handle}</span>
                  </td>
                  <td className="small dim">{u.joined}</td>
                  <td>
                    <span className={'pill ' + (u.kyc === 'approved' ? 'run' : u.kyc === 'pending' ? 'hot' : 'mute')}>
                      {u.kyc}
                    </span>
                  </td>
                  <td className="right mono">{money(u.balance)}</td>
                  <td className="right mono">{owned.length}</td>
                  <td className="right mono">{money(owed)}</td>
                  <td className={'right mono ' + (fee < 0 ? 'neg' : 'ok')}>
                    {fee < 0 ? '−' : '+'}{money(Math.abs(fee))}
                  </td>
                  <td className="small dim">{u.referredBy ? '@' + u.referredBy : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="split-2">
        <section className="panel">
          <h2>Referral graph</h2>
          <p className="small dim">
            Every account except the first arrived through one referrer. That concentration is worth
            watching: a referral tree this narrow means your growth and your biggest fee-payer are
            the same person.
          </p>
          <ul className="tree">
            {users.filter((u) => !u.referredBy).map((root) => (
              <li key={root.id}>
                <b>{root.name}</b> <span className="dim small">@{root.handle}</span>
                <ul>
                  {users.filter((u) => u.referredBy === root.handle).map((child) => (
                    <li key={child.id}>
                      {child.name}
                      <span className="dim small"> · {rowsFor(child.name).length} machines · {child.kyc}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Identity checks</h2>
          <table className="table">
            <thead><tr><th>State</th><th className="right">Accounts</th><th className="right">Blocked payouts</th></tr></thead>
            <tbody>
              {['approved', 'pending', 'none'].map((k) => {
                const names = users.filter((u) => u.kyc === k).map((u) => u.name);
                const blocked = withdrawals.filter((w) => w.status === 'pending' && names.includes(w.user));
                return (
                  <tr key={k}>
                    <td><span className={'pill ' + (k === 'approved' ? 'run' : k === 'pending' ? 'hot' : 'mute')}>{k}</span></td>
                    <td className="right mono">{names.length}</td>
                    <td className="right mono">
                      {k === 'approved' ? '—' : blocked.length ? money(blocked.reduce((a, b) => a + b.amount, 0)) : '0.00'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small dim">
            A withdrawal cannot be approved while its owner&apos;s check is outstanding. That is the
            one place in this console where the block is enforced rather than advisory.
          </p>
        </section>
      </div>
    </div>
  );
}
