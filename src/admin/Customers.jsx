import React, { useEffect, useState } from 'react';
import { ErrorNote, Loading, fmtDate, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money, round } from '../lib/economics.js';

function Adjust({ user, onDone }) {
  const { api } = useApp();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: null });

  const save = async () => {
    setState({ busy: true, error: null });
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) throw new Error('Enter an amount, e.g. 5 to add or -5 to remove.');
      await api.admin.adjust(user.id, n, note);
      onDone();
    } catch (e) {
      setState({ busy: false, error: e });
    }
  };

  return (
    <div className="stack gap-sm">
      <div className="row gap">
        <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+5 or -5" inputMode="decimal" />
        <input className="input grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason — shown to the customer" />
        <button className="btn tiny primary" disabled={state.busy} onClick={save}>Apply</button>
      </div>
      <ErrorNote error={state.error} />
    </div>
  );
}

const todayUTC = () => new Date().toISOString().slice(0, 10);
const nextDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);

/**
 * A sale paid outside the website - cash, bank, or a transfer before the site
 * existed. It becomes paid orders and machines, the same as buying on the
 * site, and earns from the day after the payment date once that day's profit
 * is published.
 */
function RecordSale({ user, onDone }) {
  const { api, config } = useApp();
  const { data: machines } = useLoad(() => api.admin.machines(), []);
  const [f, setF] = useState({ machineId: '', plan: 'standard', price: '', quantity: '1', paidOn: todayUTC(), note: '', cashback: false });
  const [state, setState] = useState({ busy: false, error: null, done: null });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const m = (machines || []).find((x) => x.id === f.machineId);
  // the catalogue price for the chosen machine and plan, which you can change to what was actually paid
  useEffect(() => {
    if (!m) return;
    const price = f.plan === 'pro' ? Math.round(Number(m.price) * (1 + config.proPremium)) : Number(m.price);
    setF((x) => ({ ...x, price: String(price) }));
  }, [f.machineId, f.plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const each = Number(f.price), n = Number(f.quantity);
  const firstPurchase = !(Number(user.paid_total) > 0);
  const cashbackAmount = Math.min(each * config.cashbackRate, config.cashbackCap);
  const ready = m && each > 0 && Number.isInteger(n) && n >= 1 && f.paidOn && f.note.trim().length >= 3;

  const save = async () => {
    setState({ busy: true, error: null, done: null });
    try {
      const r = await api.admin.recordSale({
        userId: user.id, machineId: f.machineId, plan: f.plan, price: each, quantity: n,
        paidOn: f.paidOn, note: f.note.trim(), cashback: firstPurchase && f.cashback
      });
      setState({ busy: false, error: null, done: r });
    } catch (e) {
      setState({ busy: false, error: e, done: null });
    }
  };

  if (state.done) {
    return (
      <div className="stack gap-sm record-sale">
        <p className="notice info">
          Recorded {state.done.orders} × {m?.model} for {user.full_name || user.email} — {money(Number(state.done.total))} {config.ticker}.
          {' '}{Number(state.done.cashback) > 0 && `Cashback ${money(Number(state.done.cashback))} added. `}
          Earns from {fmtDate(state.done.starts_on)} once that day&apos;s profit is published.
        </p>
        <div className="row gap"><button className="btn tiny" onClick={onDone}>Done</button></div>
      </div>
    );
  }

  return (
    <div className="stack gap-sm record-sale">
      <p className="small dim">
        For a sale paid outside the website. It becomes a paid machine for this customer, counts as bought, and earns from the
        day after the payment date — only from the daily profit you publish.
      </p>
      <div className="form-grid">
        <label className="field-row"><span className="eyebrow">Machine</span>
          <select className="input" value={f.machineId} onChange={set('machineId')}>
            <option value="">Choose…</option>
            {(machines || []).map((x) => (
              <option key={x.id} value={x.id}>{x.model} — {round(Number(x.price))} ({x.stock} in stock){x.active ? '' : ' · hidden'}</option>
            ))}
          </select>
        </label>
        <label className="field-row"><span className="eyebrow">Plan</span>
          <select className="input" value={f.plan} onChange={set('plan')}>
            <option value="standard">Standard — keeps {Math.round(config.splitStandard * 100)}%</option>
            <option value="pro">Pro — keeps {Math.round(config.splitPro * 100)}%</option>
          </select>
        </label>
        <label className="field-row"><span className="eyebrow">Price paid for one ({config.ticker})</span>
          <input className="input" inputMode="decimal" value={f.price} onChange={set('price')} />
        </label>
        <label className="field-row"><span className="eyebrow">How many</span>
          <input className="input" inputMode="numeric" value={f.quantity} onChange={set('quantity')} />
        </label>
        <label className="field-row"><span className="eyebrow">Paid on</span>
          <input className="input" type="date" max={todayUTC()} value={f.paidOn} onChange={set('paidOn')} />
        </label>
        <label className="field-row"><span className="eyebrow">How it was paid</span>
          <input className="input" value={f.note} onChange={set('note')} maxLength={300} placeholder="e.g. cash on 12 July, or the TRON transaction ID" />
        </label>
      </div>
      {firstPurchase && config.cashbackRate > 0 && each > 0 && (
        <label className="check">
          <input type="checkbox" checked={f.cashback} onChange={set('cashback')} />
          Give the first-purchase cashback ({money(cashbackAmount)} {config.ticker}) — only if you promised it
        </label>
      )}
      {ready && (
        <p className="small">
          <b>{n} × {m.model}</b> ({f.plan === 'pro' ? 'Pro' : 'Standard'}) for {user.full_name || user.email}:{' '}
          <b className="mono">{money(each * n)} {config.ticker}</b>, earning from {fmtDate(nextDay(f.paidOn))}.
        </p>
      )}
      <ErrorNote error={state.error} />
      <div className="row gap">
        <button className="btn tiny primary" disabled={!ready || state.busy} onClick={save}>{state.busy ? 'Recording…' : 'Record sale'}</button>
      </div>
    </div>
  );
}

export default function Customers() {
  const { api, config } = useApp();
  const { data, loading, error, reload } = useLoad(() => api.admin.users(), []);
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');

  const rows = (data || []).filter((u) => !q || `${u.email} ${u.full_name || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="admin-page">
      <div className="page-head">
        <div><span className="eyebrow">{data ? data.length : '…'} accounts</span><h1>Customers</h1></div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" />
      </div>

      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Customer</th><th>Joined</th><th className="right">Machines</th><th className="right">Bought</th><th className="right">Balance</th><th>Invited by</th><th /></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <React.Fragment key={u.id}>
                    <tr>
                      <td>{u.full_name || '—'}<br /><span className="small dim">{u.email}</span>{u.role === 'admin' && <span className="pill hot"> admin</span>}</td>
                      <td className="small dim">{fmtDate(u.created_at)}</td>
                      <td className="right mono">{u.holdings}</td>
                      <td className="right mono">{round(Number(u.paid_total))}</td>
                      <td className="right mono">{money(Number(u.balance))}</td>
                      <td className="small dim">{u.referred_by_email || '—'}</td>
                      <td className="right">
                        <span className="row-actions">
                          <button className="btn tiny" onClick={() => setOpen(open?.id === u.id && open.mode === 'sale' ? null : { id: u.id, mode: 'sale' })}>
                            {open?.id === u.id && open.mode === 'sale' ? 'Close' : 'Record a sale'}
                          </button>
                          <button className="btn tiny" onClick={() => setOpen(open?.id === u.id && open.mode === 'adjust' ? null : { id: u.id, mode: 'adjust' })}>
                            {open?.id === u.id && open.mode === 'adjust' ? 'Close' : 'Adjust'}
                          </button>
                        </span>
                      </td>
                    </tr>
                    {open?.id === u.id && (
                      <tr><td colSpan={7}>
                        {open.mode === 'sale'
                          ? <RecordSale user={u} onDone={() => { setOpen(null); reload(); }} />
                          : <Adjust user={u} onDone={() => { setOpen(null); reload(); }} />}
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small dim">
        A customer appears here after signing in with Google once. <b>Record a sale</b> is for machines paid for outside the
        website. Adjustments add or remove {config.ticker} from a balance with a reason the customer can see. Both are written to
        the audit log. To make someone an operator, run this once in the Supabase SQL editor:
        <code> update profiles set role = &apos;admin&apos; where email = &apos;them@gmail.com&apos;;</code>
      </p>
    </div>
  );
}
