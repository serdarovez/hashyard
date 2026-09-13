import React, { useMemo, useState } from 'react';
import MachineCard from '../components/MachineCard.jsx';
import { RIGS } from '../data/catalog.js';
import { usePlatform } from '../state/PlatformContext.jsx';
import { econ, money, round } from '../lib/economics.js';

const KIND_FILTERS = [
  ['all', 'All'],
  ['share', 'Shares'],
  ['unit', 'Machines']
];

const SORTS = [
  ['price', 'Price'],
  ['yield', 'Daily net'],
  ['eff', 'Efficiency']
];

export default function Machines({ go }) {
  const { config } = usePlatform();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('price');

  const rigs = useMemo(() => {
    const list = RIGS.filter((r) => filter === 'all' || r.kind === filter);
    const key = {
      price: (r) => r.price,
      yield: (r) => -econ(r, config.splitStandard, config).you,
      eff: (r) => (r.unit === 'TH/s' ? r.watts / r.hash : r.watts / (r.hash * 1000))
    }[sort];
    return [...list].sort((a, b) => key(a) - key(b));
  }, [filter, sort, config]);

  const cheapest = Math.min(...RIGS.map((r) => r.price));

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Hosted mining · {config.network}</span>
          <h1>Own the machine. Keep what it mines.</h1>
          <p>
            Buy a whole ASIC or a share of one, racked in Kazakhstan and Paraguay.
            You are paid every morning in {config.ticker} — your machine&apos;s real output,
            less its metered power, at the split you choose. From {round(cheapest)} {config.ticker}.
          </p>
          <div className="hero-stats">
            <div><span className="n">{RIGS.length}</span><span className="l">machines listed</span></div>
            <div><span className="n">{Math.round(config.uptimeSLA * 100)}%</span><span className="l">uptime guarantee</span></div>
            <div><span className="n">${money(config.powerRate).slice(0, 5)}</span><span className="l">per kWh, all-in</span></div>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="seg">
          {KIND_FILTERS.map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}<b>{k === 'all' ? RIGS.length : RIGS.filter((r) => r.kind === k).length}</b>
            </button>
          ))}
        </div>
        <label className="sorter">
          <span className="eyebrow">Sort</span>
          <select value={sort} onChange={(ev) => setSort(ev.target.value)}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      <p className="note-line">
        {filter === 'share'
          ? `A share is a hashrate slice of a machine already racked — same hardware, same tariff, same split.`
          : filter === 'unit'
            ? `A whole machine, racked under your name with its own serial and metered PDU port.`
            : `Daily figures are today's real output less power at $${config.powerRate.toFixed(3)}/kWh, at the Standard ${Math.round(config.splitStandard * 100)}/${Math.round((1 - config.splitStandard) * 100)} split. They move with hashprice.`}
      </p>

      <div className="grid machines-grid">
        {rigs.map((r) => <MachineCard key={r.id} rig={r} onOpen={(id) => go('machine', id)} />)}
      </div>
    </div>
  );
}
