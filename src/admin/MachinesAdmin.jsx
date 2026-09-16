import React, { useState } from 'react';
import RigDrawing from '../components/RigDrawing.jsx';
import { ErrorNote, Loading, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money, round } from '../lib/economics.js';
import { toRig } from '../api/mappers.js';

const BLANK = {
  id: '', kind: 'unit', brand: 'Bitmain', model: '', parent_model: '', parent_hash: '',
  algo: 'SHA-256', coin: 'BTC', hash: '', unit: 'TH/s', watts: '', price: '',
  cool: 'Air', skin: 'bitmain', site: '', stock: 0, active: true, sort: 100
};
const SKINS = ['bitmain', 'bitmain-h', 'microbt', 'microbt-h'];

function Field({ label, children, hint }) {
  return (
    <label className="field-row">
      <span className="eyebrow">{label}</span>
      {children}
      {hint && <span className="small dim">{hint}</span>}
    </label>
  );
}

function Editor({ initial, isNew, onCancel, onSaved }) {
  const { api, reloadCatalog } = useApp();
  const [m, setM] = useState({ ...BLANK, ...initial });
  const [state, setState] = useState({ busy: false, error: null });
  const set = (k) => (e) => setM((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      const row = {
        ...m,
        id: m.id.trim().toLowerCase(),
        hash: +m.hash, watts: +m.watts, price: +m.price, stock: +m.stock, sort: +m.sort,
        parent_model: m.kind === 'share' ? m.parent_model : null,
        parent_hash: m.kind === 'share' ? +m.parent_hash : null
      };
      if (!/^[a-z0-9-]{2,40}$/.test(row.id)) throw new Error('ID: 2–40 lowercase letters, numbers or dashes, e.g. s21-pro');
      if (!row.model.trim()) throw new Error('Give the machine a name.');
      if (!(row.price > 0 && row.hash > 0 && row.watts > 0)) throw new Error('Price, hashrate and power must be above zero.');
      if (row.kind === 'share' && !(row.parent_model && row.parent_hash > 0)) {
        throw new Error('A share needs the name and hashrate of the machine it is part of.');
      }
      await api.admin.saveMachine(row);
      await reloadCatalog();
      onSaved();
    } catch (err) {
      setState({ busy: false, error: err });
    }
  };

  const preview = toRig({ ...BLANK, ...m, hash: +m.hash || 1, watts: +m.watts || 1, price: +m.price || 1, parent_hash: +m.parent_hash || 1 });

  return (
    <form className="panel stack" onSubmit={save}>
      <div className="row"><h2>{isNew ? 'Add a machine' : `Edit ${initial.model}`}</h2>
        <button type="button" className="btn tiny" onClick={onCancel}>Close</button></div>
      <div className="editor-grid">
        <div className="media editor-preview"><RigDrawing rig={preview} /></div>
        <div className="form-grid">
          <Field label="ID" hint="Used in links. Can't be changed later.">
            <input className="input" value={m.id} onChange={set('id')} disabled={!isNew} placeholder="s21-pro" />
          </Field>
          <Field label="Name"><input className="input" value={m.model} onChange={set('model')} placeholder="Antminer S21 Pro" /></Field>
          <Field label="Type">
            <select className="input" value={m.kind} onChange={set('kind')}>
              <option value="unit">Whole machine</option>
              <option value="share">Share of a machine</option>
            </select>
          </Field>
          <Field label="Brand"><input className="input" value={m.brand} onChange={set('brand')} /></Field>
          {m.kind === 'share' && (
            <>
              <Field label="Part of (machine name)" hint="Must match a whole machine's name exactly.">
                <input className="input" value={m.parent_model || ''} onChange={set('parent_model')} placeholder="Antminer S21 Pro" />
              </Field>
              <Field label="That machine's hashrate"><input className="input" inputMode="decimal" value={m.parent_hash || ''} onChange={set('parent_hash')} /></Field>
            </>
          )}
          <Field label="Price (USDT)"><input className="input" inputMode="decimal" value={m.price} onChange={set('price')} /></Field>
          <Field label="In stock"><input className="input" inputMode="numeric" value={m.stock} onChange={set('stock')} /></Field>
          <Field label="Hashrate"><input className="input" inputMode="decimal" value={m.hash} onChange={set('hash')} /></Field>
          <Field label="Unit">
            <select className="input" value={m.unit} onChange={set('unit')}><option>TH/s</option><option>GH/s</option></select>
          </Field>
          <Field label="Power (watts)"><input className="input" inputMode="numeric" value={m.watts} onChange={set('watts')} /></Field>
          <Field label="Algorithm">
            <select className="input" value={m.algo} onChange={set('algo')}><option>SHA-256</option><option>Scrypt</option><option>kHeavyHash</option></select>
          </Field>
          <Field label="Coin"><input className="input" value={m.coin} onChange={set('coin')} /></Field>
          <Field label="Cooling">
            <select className="input" value={m.cool} onChange={set('cool')}><option>Air</option><option>Hydro</option></select>
          </Field>
          <Field label="Drawing style">
            <select className="input" value={m.skin} onChange={set('skin')}>{SKINS.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Location"><input className="input" value={m.site} onChange={set('site')} placeholder="Ekibastuz, KZ" /></Field>
          <Field label="Order in list"><input className="input" inputMode="numeric" value={m.sort} onChange={set('sort')} /></Field>
          <label className="check"><input type="checkbox" checked={!!m.active} onChange={set('active')} /> For sale</label>
        </div>
      </div>
      <ErrorNote error={state.error} />
      <div className="row gap">
        <button className="btn primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save machine'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/**
 * Price cell you can edit in place. Enter saves, Escape cancels. Changing a
 * price only affects new orders: anyone who already bought keeps what they paid.
 */
function PriceCell({ machine, onSaved }) {
  const { api, reloadCatalog } = useApp();
  const [value, setValue] = useState(String(Math.round(+machine.price * 100) / 100));
  const [state, setState] = useState('idle');   // idle | saving | saved | error
  const changed = Number(value) !== +machine.price;

  const save = async () => {
    const n = Number(value);
    if (!changed) return;
    if (!(n > 0)) { setState('error'); return; }
    setState('saving');
    try {
      await api.admin.saveMachine({ ...machine, price: n });
      await reloadCatalog();
      setState('saved');
      onSaved(machine.model, +machine.price, n);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="price-cell">
      <input className={'input num' + (state === 'error' ? ' is-bad' : '')} inputMode="decimal" value={value}
        aria-label={`Price of ${machine.model}`}
        onChange={(e) => { setValue(e.target.value); setState('idle'); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setValue(String(+machine.price)); setState('idle'); }
        }} />
      {changed && state !== 'saving' && <button className="btn tiny primary" onClick={save}>Save</button>}
      {state === 'saving' && <span className="small dim">Saving…</span>}
      {state === 'saved' && !changed && <span className="small ok">Saved</span>}
    </div>
  );
}

export default function MachinesAdmin() {
  const { api, config, reloadCatalog } = useApp();
  const { data, loading, error, reload } = useLoad(
    () => Promise.all([api.admin.machines(), api.admin.machineStats()]), []
  );
  const [editing, setEditing] = useState(null);   // null | 'new' | row
  const [note, setNote] = useState(null);
  const [machines, stats] = data || [[], []];
  const statFor = (id) => stats.find((s) => s.machine_id === id) || {};

  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.model}? If anyone has bought it, it is hidden from sale instead of deleted.`)) return;
    try {
      const r = await api.admin.removeMachine(m.id);
      setNote(r === 'hidden' ? `${m.model} has buyers, so it was hidden from sale. Their machines keep earning.` : `${m.model} deleted.`);
      await reloadCatalog();
      reload();
    } catch (e) {
      setNote(e.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-head">
        <div><span className="eyebrow">Catalogue</span><h1>Machines</h1></div>
        <button className="btn primary" onClick={() => setEditing('new')}>Add a machine</button>
      </div>

      {note && <div className="notice info">{note}</div>}

      {editing && (
        <Editor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? {} : editing}
          isNew={editing === 'new'}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNote('Saved. The shop shows the change straight away.'); reload(); }}
        />
      )}

      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table machines-admin">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th className="right">Price (USDT)</th>
                  <th className="right">Stock</th>
                  <th className="right">Sold</th>
                  <th className="right">Sales</th>
                  <th className="right">Profit paid to owners</th>
                  <th className="right">Last day&apos;s profit</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const st = statFor(m.id);
                  return (
                  <tr key={m.id} className={m.active ? undefined : 'is-down'}>
                    <td>{m.model}<span className="small dim"> · {m.kind === 'share' ? 'share' : 'whole'}</span></td>
                    <td className="right">
                      <PriceCell key={m.id + m.price} machine={m}
                        onSaved={(model, from, to) => { setNote(`${model}: price changed from ${round(from)} to ${round(to)} USDT. New orders use the new price.`); reload(); }} />
                    </td>
                    <td className="right mono">{m.stock}</td>
                    <td className="right mono">{st.sold ?? 0}</td>
                    <td className="right mono">{round(Number(st.sales || 0))}</td>
                    <td className="right mono accent">{money(Number(st.paid_to_owners || 0))}</td>
                    <td className="right mono">
                      {st.last_day ? <>{money(Number(st.last_profit))}<span className="small dim"> · {fmtDate(st.last_day)}</span></> : '—'}
                    </td>
                    <td><span className={'pill ' + (m.active ? (m.stock > 0 ? 'run' : 'hot') : 'mute')}>{m.active ? (m.stock > 0 ? 'For sale' : 'Sold out') : 'Hidden'}</span></td>
                    <td className="right">
                      <div className="row-actions">
                        <button className="btn tiny" onClick={() => setEditing(m)}>Edit</button>
                        <button className="btn tiny" onClick={() => remove(m)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small dim">
        Type a new price and press Enter or Save. Prices are for the Standard plan; Pro is {Math.round(config.proPremium * 100)}% more
        (set in Settings). Changing a price never affects people who already bought. &quot;Profit paid to owners&quot; is
        everything that machine has paid its buyers; &quot;Last day&apos;s profit&quot; is per machine, from Daily results.
      </p>
    </div>
  );
}
