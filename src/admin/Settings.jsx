import React, { useEffect, useState } from 'react';
import { ErrorNote, Loading, useLoad } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { TRON_ADDRESS } from '../api/mappers.js';

// [column, label, kind, help]. kind 'pct' is stored as 0.80 and shown as 80.
const GROUPS = [
  ['Payments', [
    ['receive_address', 'Your receiving wallet', 'address', 'Every customer payment goes straight here. Use a wallet only you control.'],
    ['order_ttl_minutes', 'Minutes to pay an order', 'int', 'Stock is held for this long, then released.']
  ]],
  ['Plans', [
    ['split_standard', 'Standard — customer keeps', 'pct', ''],
    ['split_pro', 'Pro — customer keeps', 'pct', ''],
    ['pro_premium', 'Pro costs more by', 'pct', 'Without a price difference nobody would pick Standard.']
  ]],
  ['Guarantee and promotions', [
    ['uptime_sla', 'Uptime guarantee', 'pct', 'Below this, you pay owners for the missing hours out of your fee.'],
    ['referral_share', 'Referral share of your fee', 'pct', ''],
    ['cashback_rate', 'First-purchase cashback', 'pct', 'Set to 0 to turn it off.'],
    ['cashback_cap', 'Cashback limit (USDT)', 'num', '']
  ]],
  ['Withdrawals', [
    ['withdraw_min', 'Minimum withdrawal (USDT)', 'num', 'Sending on TRON costs you roughly 1–4 USDT in TRX each time.'],
    ['withdraw_fee', 'Fee charged to the customer (USDT)', 'num', '']
  ]],
  ['Estimates shown in the shop', [
    ['btc_hashprice', 'BTC hashprice ($ per PH/s per day)', 'num', 'Only for the "you earn about" figures. Real payouts come from Daily results.'],
    ['ltc_hashprice', 'Scrypt hashprice ($ per GH/s per day)', 'num', ''],
    ['kas_hashprice', 'kHeavyHash price ($ per TH/s per day)', 'num', ''],
    ['power_rate', 'Electricity ($ per kWh)', 'num', '']
  ]]
];
const FIELDS = GROUPS.flatMap(([, f]) => f);

export default function Settings() {
  const { api, reloadCatalog } = useApp();
  const { data, loading, error, reload } = useLoad(() => api.admin.settings(), []);
  const [form, setForm] = useState({});
  const [state, setState] = useState({ busy: false, error: null, saved: false });

  useEffect(() => {
    if (!data) return;
    const f = {};
    for (const [k, , kind] of FIELDS) f[k] = kind === 'pct' ? String(Math.round(Number(data[k]) * 10000) / 100) : String(data[k] ?? '');
    setForm(f);
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null, saved: false });
    try {
      const patch = {};
      for (const [k, label, kind] of FIELDS) {
        const v = String(form[k] ?? '').trim();
        if (kind === 'address') {
          if (v && !TRON_ADDRESS.test(v)) throw new Error(`${label}: not a TRON address (starts with T, 34 characters).`);
          patch[k] = v;
        } else {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) throw new Error(`${label}: enter a number.`);
          if (kind === 'pct' && n > 100 && k !== 'pro_premium') throw new Error(`${label}: must be 0–100%.`);
          patch[k] = kind === 'pct' ? n / 100 : kind === 'int' ? Math.round(n) : n;
        }
      }
      if (data.receive_address && patch.receive_address !== data.receive_address &&
          !window.confirm(`Change the receiving wallet to ${patch.receive_address || '(none)'}? New orders will ask customers to pay there.`)) {
        setState({ busy: false, error: null, saved: false });
        return;
      }
      await api.admin.saveSettings(patch);
      await reloadCatalog();
      reload();
      setState({ busy: false, error: null, saved: true });
    } catch (err) {
      setState({ busy: false, error: err, saved: false });
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const pct = (k) => Number(form[k]) / 100;
  const beStd = pct('split_standard') * pct('uptime_sla') * 100;
  const bePro = pct('split_pro') * pct('uptime_sla') * 100;

  return (
    <form className="admin-page" onSubmit={save}>
      <div className="page-head">
        <div><span className="eyebrow">Terms</span><h1>Settings</h1></div>
        <button className="btn primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save settings'}</button>
      </div>

      {!data.receive_address && (
        <div className="notice warn"><b>Add your receiving wallet first.</b> Until you do, customers can browse but can&apos;t buy.</div>
      )}

      {GROUPS.map(([title, fields]) => (
        <section className="panel stack" key={title}>
          <h2>{title}</h2>
          <div className="settings-grid">
            {fields.map(([k, label, kind, help]) => (
              <label className={'field-row' + (kind === 'address' ? ' wide-field' : '')} key={k}>
                <span className="eyebrow">{label}{kind === 'pct' ? ' (%)' : ''}</span>
                <input className={'input' + (kind === 'address' ? ' mono' : '')} value={form[k] ?? ''}
                  inputMode={kind === 'address' ? 'text' : 'decimal'} spellCheck="false"
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                {help && <span className="small dim">{help}</span>}
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="panel stack gap-sm">
        <h2>What the guarantee can cost you</h2>
        <p className="small dim">
          Guarantee payments come out of your fee. Below this much uptime, a machine costs you more in guarantee payments than
          it earns you in fees that day. It depends only on the customer&apos;s share and the guarantee level.
        </p>
        <div className="ledger-row"><span className="k">Standard plan</span><span className="v">{beStd.toFixed(1)}% uptime</span></div>
        <div className="ledger-row"><span className="k">Pro plan</span><span className={'v ' + (bePro > 88 ? 'warn' : '')}>{bePro.toFixed(1)}% uptime</span></div>
        {bePro > 88 && <p className="small warn">The Pro plan is the risky one: you keep less of the fee that pays for the guarantee.</p>}
      </section>

      <ErrorNote error={state.error} />
      {state.saved && <div className="notice info">Saved. The shop and every new order use these values now.</div>}
    </form>
  );
}
