import React, { useState } from 'react';
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
                      <td className="right"><button className="btn tiny" onClick={() => setOpen(open === u.id ? null : u.id)}>{open === u.id ? 'Close' : 'Adjust'}</button></td>
                    </tr>
                    {open === u.id && (
                      <tr><td colSpan={7}><Adjust user={u} onDone={() => { setOpen(null); reload(); }} /></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small dim">
        Adjustments add or remove {config.ticker} from a balance with a reason the customer can see, and are written to the
        audit log. To make someone an operator, run this once in the Supabase SQL editor:
        <code> update profiles set role = &apos;admin&apos; where email = &apos;them@gmail.com&apos;;</code>
      </p>
    </div>
  );
}
