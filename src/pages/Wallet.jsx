import React, { useEffect, useState } from 'react';
import { ErrorNote, LEDGER_LABEL, Loading, SignInGate, fmtDateTime } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { money } from '../lib/economics.js';
import { TRON_ADDRESS, tronscanTx } from '../api/mappers.js';

const W_STATUS = { pending: ['Being sent', 'hot'], sent: ['Sent', 'run'], rejected: ['Returned to balance', 'mute'] };

function WalletInner() {
  const { api, config, profile, balance, ledger, withdrawals, accountReady, reloadAccount } = useApp();
  const [address, setAddress] = useState('');
  const [addrState, setAddrState] = useState({ busy: false, error: null, saved: false });
  const [amount, setAmount] = useState('');
  const [wState, setWState] = useState({ busy: false, error: null, done: false });

  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState(null);
  useEffect(() => { setAddress(profile?.payout_address || ''); }, [profile?.payout_address]);
  useEffect(() => { setName(profile?.full_name || ''); }, [profile?.full_name]);

  if (!accountReady) return <div className="page narrow"><Loading /></div>;

  const pending = withdrawals.find((w) => w.status === 'pending');
  const sentTotal = withdrawals.filter((w) => w.status === 'sent').reduce((a, w) => a + Number(w.amount), 0);
  const n = Number(amount);
  const receive = n > 0 ? Math.max(0, n - config.withdrawFee) : 0;
  const addressOk = TRON_ADDRESS.test(address.trim());

  const saveAddress = async (e) => {
    e.preventDefault();
    setAddrState({ busy: true, error: null, saved: false });
    try {
      if (!addressOk) throw new Error('That is not a TRON address. It starts with T and is 34 characters long.');
      await api.updateProfile({ payout_address: address.trim() });
      await reloadAccount();
      setAddrState({ busy: false, error: null, saved: true });
    } catch (err) {
      setAddrState({ busy: false, error: err, saved: false });
    }
  };

  const withdraw = async (e) => {
    e.preventDefault();
    setWState({ busy: true, error: null, done: false });
    try {
      await api.requestWithdrawal(n);
      await reloadAccount();
      setAmount('');
      setWState({ busy: false, error: null, done: true });
    } catch (err) {
      setWState({ busy: false, error: err, done: false });
    }
  };

  const toggleEmails = async () => {
    await api.updateProfile({ email_updates: !profile.email_updates });
    reloadAccount();
  };

  return (
    <div className="page narrow">
      <h1>Wallet</h1>

      <div className="grid tiles two">
        <div className="tile">
          <span className="eyebrow">Earnings to withdraw</span>
          <span className="tile-value accent">{money(balance)}<small> {config.ticker}</small></span>
          <span className="tile-sub">what your machines earned, not yet withdrawn</span>
        </div>
        <div className="tile">
          <span className="eyebrow">Sent to you so far</span>
          <span className="tile-value">{money(sentTotal)}<small> {config.ticker}</small></span>
          <span className="tile-sub">{withdrawals.filter((w) => w.status === 'sent').length} withdrawals</span>
        </div>
      </div>

      <p className="small dim">
        What you paid for machines is not part of this balance — it bought the machines, which are yours and earn every
        day. This balance is only what they have earned.
      </p>

      <form className="panel stack gap-sm" onSubmit={async (e) => {
        e.preventDefault();
        setNameError(null);
        try {
          await api.updateProfile({ full_name: name.trim().slice(0, 60) || null });
          await reloadAccount();
          setNameSaved(true);
        } catch (err) {
          setNameError(err);
        }
      }}>
        <h2>Your name</h2>
        <p className="small dim">Signed in as <b>{profile?.email}</b>. Your name is only shown on the leaderboard if you choose that below.</p>
        <div className="row gap">
          <input className="input grow" value={name} maxLength={60} autoComplete="name"
            onChange={(e) => { setName(e.target.value); setNameSaved(false); }} placeholder="First and last name" />
          <button className="btn" disabled={name.trim() === (profile?.full_name || '')}>Save</button>
        </div>
        {nameSaved && <p className="small ok">Saved.</p>}
        <ErrorNote error={nameError} />
      </form>

      <form className="panel stack gap-sm" onSubmit={saveAddress}>
        <h2>Your wallet for withdrawals</h2>
        <p className="small dim">A TRON address you control, for receiving {config.ticker} on {config.network}. Check it carefully — we send to exactly this.</p>
        <div className="row gap">
          <input className="input grow mono" value={address} onChange={(e) => { setAddress(e.target.value); setAddrState({ busy: false, error: null, saved: false }); }}
            placeholder="T…" spellCheck="false" autoComplete="off" />
          <button className="btn" disabled={addrState.busy || address.trim() === (profile?.payout_address || '')}>
            {addrState.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {address && !addressOk && <p className="small neg">A TRON address starts with T and is 34 characters long.</p>}
        {addrState.saved && <p className="small ok">Saved.</p>}
        <ErrorNote error={addrState.error} />
      </form>

      <form className="panel stack gap-sm" onSubmit={withdraw}>
        <h2>Withdraw</h2>
        {pending ? (
          <div className="notice info">
            <b>{money(Number(pending.amount))} {config.ticker} is on its way.</b> We send withdrawals by hand within 24 hours
            of your request. You&apos;ll see the transaction here once it&apos;s sent.
          </div>
        ) : !profile?.payout_address ? (
          <p className="small dim">Save your wallet address above first.</p>
        ) : (
          <>
            <div className="row gap">
              <input className="input grow mono" type="number" min={config.withdrawMin} step="0.01" max={balance}
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`At least ${config.withdrawMin}`} />
              <button type="button" className="btn" onClick={() => setAmount(String(Math.floor(balance * 100) / 100))}>Max</button>
            </div>
            <div className="ledger-row"><span className="k">Network fee</span><span className="v dim">− {money(config.withdrawFee)}</span></div>
            <div className="ledger-row total"><span className="k">You receive</span><span className="v">{money(receive)} {config.ticker}</span></div>
            <p className="small dim">Minimum {money(config.withdrawMin)} {config.ticker}. Sent to <span className="mono">{profile.payout_address}</span> within 24 hours.</p>
            <button className="btn primary wide" disabled={wState.busy || !(n >= config.withdrawMin) || n > balance}>
              {wState.busy ? 'Sending request…' : n > balance ? 'More than your balance' : 'Request withdrawal'}
            </button>
          </>
        )}
        {wState.done && <p className="small ok">Request received. We&apos;ll send it within 24 hours.</p>}
        <ErrorNote error={wState.error} />
      </form>

      {withdrawals.length > 0 && (
        <section className="panel">
          <h2>Withdrawals</h2>
          <table className="table">
            <thead><tr><th>Requested</th><th className="right">Amount</th><th>Status</th><th>Transaction</th></tr></thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="small">{fmtDateTime(w.requested_at)}</td>
                  <td className="right mono">{money(Number(w.amount))}</td>
                  <td><span className={`pill ${W_STATUS[w.status][1]}`}>{W_STATUS[w.status][0]}</span></td>
                  <td className="small">
                    {w.tx_hash ? <a href={tronscanTx(w.tx_hash)} target="_blank" rel="noreferrer">View</a>
                      : w.admin_note ? <span className="dim">{w.admin_note}</span> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <h2>Activity</h2>
        {ledger.length === 0 ? <p className="small dim">Nothing yet.</p> : (
          <table className="table">
            <tbody>
              {ledger.slice(0, 60).map((l) => (
                <tr key={l.id}>
                  <td>{LEDGER_LABEL[l.kind] || l.kind}{l.kind === 'adjustment' && l.note ? <span className="small dim"> — {l.note}</span> : null}</td>
                  <td className="small dim">{l.day || fmtDateTime(l.created_at)}</td>
                  <td className={'right mono ' + (Number(l.amount) >= 0 ? 'accent' : 'dim')}>
                    {Number(l.amount) >= 0 ? '+' : '−'} {money(Math.abs(Number(l.amount)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel stack gap-sm">
        <h3>Leaderboard</h3>
        <span className="small dim">How you appear to other people on the public leaderboard.</span>
        <div className="seg wide">
          {[['anonymous', 'Anonymous'], ['name', 'Show my name'], ['hidden', 'Keep me off it']].map(([k, l]) => (
            <button key={k} aria-pressed={(profile?.leaderboard || 'anonymous') === k}
              onClick={async () => { await api.updateProfile({ leaderboard: k }); reloadAccount(); }}>{l}</button>
          ))}
        </div>
        <span className="small dim">The board shows how much you have paid for machines, how many you own and what they have earned — never your balance or your email.</span>
      </section>

      <section className="panel row">
        <div className="stack gap-sm">
          <h3>Daily email</h3>
          <span className="small dim">A short note each morning with what your machines earned.</span>
        </div>
        <button className="btn" onClick={toggleEmails}>{profile?.email_updates ? 'Turn off' : 'Turn on'}</button>
      </section>
    </div>
  );
}

export default function Wallet() {
  return <SignInGate why="to see your wallet"><WalletInner /></SignInGate>;
}
