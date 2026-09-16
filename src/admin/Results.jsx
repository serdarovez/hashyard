import React, { useEffect, useMemo, useState } from 'react';
import { ErrorNote, Loading, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { grossPerDay, money } from '../lib/economics.js';
import { toRig } from '../api/mappers.js';

const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const fix = (n, d = 2) => (Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : '');

/**
 * Each morning: how much profit ONE machine of each model made yesterday,
 * after electricity. That single number is what owners are paid from.
 *
 * A negative profit is allowed (power cost more than it mined) and pays owners
 * nothing that day. "Running" is only needed when a machine was down: below
 * the uptime guarantee, owners are topped up for the missing hours.
 *
 * Shares are worked out from their parent machine, so only whole machines
 * need typing in. Publishing pays every owner and sends the daily emails.
 */
export default function Results() {
  const { api, config } = useApp();
  const [day, setDay] = useState(yesterday());
  const [form, setForm] = useState({});
  const [state, setState] = useState({ busy: false, error: null, message: null });

  const { data, loading, error, reload } = useLoad(async () => {
    const [machines, results, published] = await Promise.all([
      api.admin.machines(), api.admin.results(day), api.admin.publishedDays()
    ]);
    return { machines: machines.filter((m) => m.active), results, published };
  }, [day]);

  const units = useMemo(() => (data?.machines || []).filter((m) => m.kind === 'unit'), [data]);
  const shares = useMemo(() => (data?.machines || []).filter((m) => m.kind === 'share'), [data]);

  // prefill with the saved figure, or today's estimate if nothing is saved yet
  useEffect(() => {
    if (!data) return;
    const next = {};
    for (const m of units) {
      const saved = data.results.find((r) => r.machine_id === m.id);
      const rig = toRig(m);
      next[m.id] = saved
        ? { profit: fix(+saved.revenue - +saved.power_cost), running: fix(+saved.uptime * 100, 1), saved: true }
        : { profit: fix(grossPerDay(rig, config) - (rig.watts / 1000) * 24 * config.powerRate), running: '100', saved: false };
    }
    setForm(next);
  }, [data, units, config]);

  const publishedRow = data?.published.find((p) => p.day === day);
  const tooEarly = day >= new Date().toISOString().slice(0, 10);

  // profit is stored as mined/electricity so the payout maths stays unchanged:
  // a profit of 5 is mined 5, electricity 0; a loss of 2 is mined 0, electricity 2
  const toRow = (machineId, profit, up, note) => ({
    day, machine_id: machineId,
    revenue: Math.max(profit, 0), power_cost: Math.max(-profit, 0), uptime: up,
    ...(note ? { note } : {})
  });

  const rowsToSave = () => {
    const out = [];
    for (const m of units) {
      const f = form[m.id];
      if (!f) continue;
      const profit = Number(f.profit);
      const up = Number(f.running) / 100;
      if (!Number.isFinite(profit)) throw new Error(`Enter a profit for ${m.model} (it can be negative).`);
      if (!Number.isFinite(up) || up < 0 || up > 1) throw new Error(`Running for ${m.model} must be 0–100%.`);
      out.push(toRow(m.id, profit, up));
    }
    for (const s of shares) {
      const parent = units.find((u) => u.model === s.parent_model);
      const f = parent && form[parent.id];
      if (!f) continue;
      const k = Number(s.hash) / Number(s.parent_hash);
      out.push(toRow(s.id, Number(f.profit) * k, Number(f.running) / 100, `Part of ${parent.model}`));
    }
    return out;
  };

  const save = async (publish) => {
    setState({ busy: true, error: null, message: null });
    try {
      const rows = rowsToSave();
      await api.admin.saveResults(rows);
      if (publish) {
        if (!window.confirm(`Publish ${fmtDate(day)}? This pays every owner for that day and sends the daily emails.`)) {
          setState({ busy: false, error: null, message: 'Saved as a draft. Not published yet.' });
          reload();
          return;
        }
        const r = await api.admin.publishDay(day);
        setState({ busy: false, error: null, message: `Published. ${r.holdings} machines paid, ${money(Number(r.total))} ${config.ticker} in total.` });
      } else {
        setState({ busy: false, error: null, message: 'Saved as a draft. Customers can’t see drafts.' });
      }
      reload();
    } catch (e) {
      setState({ busy: false, error: e, message: null });
    }
  };

  const set = (id, key, value) => setForm((f) => ({ ...f, [id]: { ...f[id], [key]: value } }));

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">What owners get paid</span>
          <h1>Daily profit</h1>
        </div>
        <label className="sorter">
          <span className="eyebrow">Day (UTC)</span>
          <input className="input" type="date" value={day} max={yesterday()} onChange={(e) => setDay(e.target.value)} />
        </label>
      </div>

      {publishedRow ? (
        <div className="notice info">
          <b>{fmtDate(day)} is published</b> — {publishedRow.holdings_paid} machines paid, {money(Number(publishedRow.total_paid))} {config.ticker}.
          You can correct a number and publish again: payouts are updated, never paid twice.
        </div>
      ) : (
        <div className="notice warn"><b>{fmtDate(day)} is not published.</b> Nobody is paid for this day until you publish it.</div>
      )}

      <p className="small dim">
        For each machine, enter the profit <b>one</b> machine made that day after electricity, in {config.ticker}. Owners get their
        plan&apos;s share of it. Leave &quot;Running&quot; at 100 unless a machine was down. New days start filled with an estimate — replace
        it with the real number.
      </p>

      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table results-table">
              <thead>
                <tr><th>Machine</th><th className="right">Profit (USDT)</th><th className="right">Running %</th><th className="right">Owner gets ({Math.round(config.splitStandard * 100)}%)</th><th /></tr>
              </thead>
              <tbody>
                {units.map((m) => {
                  const f = form[m.id] || {};
                  const p = Number(f.profit);
                  return (
                    <tr key={m.id}>
                      <td>{m.model}</td>
                      <td className="right">
                        <input className={'input num' + (p < 0 ? ' is-neg' : '')} inputMode="decimal" value={f.profit ?? ''}
                          onChange={(e) => set(m.id, 'profit', e.target.value)} aria-label={`Profit for ${m.model}`} />
                      </td>
                      <td className="right">
                        <input className="input num short" inputMode="decimal" value={f.running ?? ''}
                          onChange={(e) => set(m.id, 'running', e.target.value)} aria-label={`Running percent for ${m.model}`} />
                      </td>
                      <td className="right mono">{Number.isFinite(p) ? money(Math.max(p, 0) * config.splitStandard) : '—'}</td>
                      <td className="small dim">{f.saved ? 'saved' : 'estimate'}</td>
                    </tr>
                  );
                })}
                {shares.map((s) => {
                  const parent = units.find((u) => u.model === s.parent_model);
                  const f = parent && form[parent.id];
                  const k = Number(s.hash) / Number(s.parent_hash);
                  const p = f ? Number(f.profit) * k : NaN;
                  return (
                    <tr key={s.id} className="derived">
                      <td>{s.model}</td>
                      <td className="right mono small">{Number.isFinite(p) ? fix(p, 4) : '—'}</td>
                      <td className="right mono small">{f ? f.running : '—'}</td>
                      <td className="right mono small">{Number.isFinite(p) ? money(Math.max(p, 0) * config.splitStandard) : '—'}</td>
                      <td className="small dim">{parent ? `from ${parent.model}` : 'parent machine missing'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ErrorNote error={state.error} />
      {state.message && <div className="notice info">{state.message}</div>}

      <div className="row gap">
        <button className="btn" disabled={state.busy || loading} onClick={() => save(false)}>Save draft</button>
        <button className="btn primary" disabled={state.busy || loading || tooEarly} onClick={() => save(true)}>
          {state.busy ? 'Working…' : publishedRow ? 'Save and publish again' : 'Save and publish'}
        </button>
      </div>
    </div>
  );
}
