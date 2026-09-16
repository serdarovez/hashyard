import React, { useMemo, useState } from 'react';
import MachineCard from '../components/MachineCard.jsx';
import { Empty, Loading } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { econ, money, round } from '../lib/economics.js';

const KIND_FILTERS = [
  ['all', 'All'],
  ['share', 'Shares'],
  ['unit', 'Machines']
];

const SORTS = [
  ['price', 'Price'],
  ['yield', 'Monthly earnings'],
  ['eff', 'Efficiency']
];

export default function Machines({ go }) {
  const { config, machines, catalogReady } = useApp();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('price');

  const rigs = useMemo(() => {
    const list = machines.filter((r) => filter === 'all' || r.kind === filter);
    const key = {
      price: (r) => r.price,
      yield: (r) => -econ(r, config.splitStandard, config).you,
      eff: (r) => (r.unit === 'TH/s' ? r.watts / r.hash : r.watts / (r.hash * 1000))
    }[sort];
    return [...list].sort((a, b) => key(a) - key(b));
  }, [machines, filter, sort, config]);

  const cheapest = machines.length ? Math.min(...machines.map((r) => r.price)) : null;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Hosted mining · paid in {config.ticker}</span>
          <h1>Own the machine. Keep what it mines.</h1>
          <p>
            Buy a whole mining machine or a share of one, running in our facilities in Kazakhstan and
            Paraguay. Every morning you are paid what it mined, less its electricity, at the plan you
            choose{cheapest ? `. From ${round(cheapest)} ${config.ticker}` : ''}.
          </p>
          <div className="hero-stats">
            <div><span className="n">{machines.length || '—'}</span><span className="l">machines for sale</span></div>
            <div><span className="n">{Math.round(config.uptimeSLA * 100)}%</span><span className="l">uptime guarantee</span></div>
            <div><span className="n">24h</span><span className="l">withdrawals sent within</span></div>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="seg">
          {KIND_FILTERS.map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}<b>{k === 'all' ? machines.length : machines.filter((r) => r.kind === k).length}</b>
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
          ? 'A share is part of a machine that is already running — same hardware, same electricity price, same plan.'
          : filter === 'unit'
            ? 'A whole machine, running under your name.'
            : `Earnings shown are estimates at today's prices. Real payouts come from what each machine actually mined, and change with the bitcoin price.`}
      </p>

      {!catalogReady ? (
        <Loading label="Loading machines…" />
      ) : rigs.length === 0 ? (
        <Empty title="Nothing for sale right now">Check back soon — new machines are added regularly.</Empty>
      ) : (
        <div className="grid machines-grid">
          {rigs.map((r) => <MachineCard key={r.id} rig={r} onOpen={(mid) => go('machine', mid)} />)}
        </div>
      )}
    </div>
  );
}
