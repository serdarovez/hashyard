import React, { useState } from 'react';
import { usePlatform } from '../state/PlatformContext.jsx';
import { byId } from '../data/catalog.js';
import { dayEcon, efficiency, money, round } from '../lib/economics.js';

export default function Fleet() {
  const { fleet, toggleRig, config } = usePlatform();
  const [site, setSite] = useState('all');

  const sites = ['all', ...Array.from(new Set(fleet.map((f) => f.site)))];
  const rows = fleet.filter((f) => site === 'all' || f.site === site);

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{fleet.length} units hosted</span>
          <h1>Fleet</h1>
        </div>
        <div className="seg">
          {sites.map((s) => (
            <button key={s} aria-pressed={site === s} onClick={() => setSite(s)}>
              {s === 'all' ? 'All sites' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Serial</th><th>Model</th><th>Owner</th><th>Site</th>
              <th className="right">Uptime</th><th className="right">Temp</th>
              <th className="right">Credit today</th><th>State</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const rig = byId(u.rigId);
              const share = u.owner === 'pool' ? 1 : config.splitStandard;
              const day = dayEcon({ hp: 1, up: u.online ? u.uptime : 0 }, rig, share, config);
              const breaching = u.online && u.uptime < config.uptimeSLA;
              return (
                <tr key={u.sn} className={!u.online ? 'is-down' : undefined}>
                  <td className="mono small">{u.sn}</td>
                  <td>{rig ? rig.model : '—'}
                    <span className="dim small"> · {rig ? efficiency(rig).v + ' ' + efficiency(rig).u : ''}</span>
                  </td>
                  <td>{u.owner === 'pool' ? <span className="dim">Hashyard</span> : u.owner}</td>
                  <td className="small">{u.site}</td>
                  <td className={'right mono ' + (breaching || !u.online ? 'warn' : '')}>
                    {(u.uptime * 100).toFixed(1)}%
                  </td>
                  <td className="right mono small">{u.online ? u.temp + '°C' : '—'}</td>
                  <td className={'right mono ' + (day.credit > 0 ? 'warn' : 'dim')}>
                    {u.owner === 'pool' ? '—' : day.credit > 0 ? '−' + money(day.credit) : '0.00'}
                  </td>
                  <td>
                    <span className={'pill ' + (!u.online ? 'mute' : breaching ? 'hot' : 'run')}>
                      {!u.online ? 'Offline' : breaching ? 'Below SLA' : 'Hashing'}
                    </span>
                  </td>
                  <td className="right">
                    <button className="btn tiny" onClick={() => toggleRig(u.sn)}>
                      {u.online ? 'Stop' : 'Start'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid tiles">
        <div className="tile">
          <span className="eyebrow">Below SLA</span>
          <span className="tile-value warn">
            {fleet.filter((u) => u.uptime < config.uptimeSLA).length}
            <small> of {fleet.length}</small>
          </span>
          <span className="tile-sub">accruing credits against your fee</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Customer-owned</span>
          <span className="tile-value">{fleet.filter((u) => u.owner !== 'pool').length}</span>
          <span className="tile-sub">the only units that generate fee</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Hashyard-owned</span>
          <span className="tile-value">{fleet.filter((u) => u.owner === 'pool').length}</span>
          <span className="tile-sub">unsold stock, full output to you</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Nameplate draw</span>
          <span className="tile-value">
            {round(fleet.reduce((a, u) => a + (byId(u.rigId)?.watts || 0), 0) / 1000)}<small> kW</small>
          </span>
          <span className="tile-sub">if every unit ran flat out</span>
        </div>
      </div>

      <p className="small dim">
        Stopping a unit here simulates an outage: its uptime stops counting, the customer&apos;s payout
        falls, and the SLA credit that covers the gap appears in the credit column — charged to your
        fee, not to them.
      </p>
    </div>
  );
}
