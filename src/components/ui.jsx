import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state/AppContext.jsx';

export function Loading({ label = 'Loading…' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small dim">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="notice warn" role="alert">{String(error.message || error)}</div>;
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* old browsers: the text is selectable */ }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return <button type="button" className="btn tiny" onClick={copy}>{done ? 'Copied' : label}</button>;
}

/** A real, scannable QR code (unlike the old placeholder pattern). */
export function Qr({ text, size = 184 }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => { alive = false; };
  }, [text]);
  return (
    <div className="qr-real" style={{ width: size, height: size }}
      aria-label={`QR code for ${text}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

export function Countdown({ until, onDone }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  useEffect(() => { if (left === 0 && onDone) onDone(); }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <span className="mono">{m}:{String(s).padStart(2, '0')}</span>;
}

/**
 * Email login in two steps: type your email, get a 6-digit code, type the code.
 * No passwords, so nothing to forget, reset or leak. The first login creates
 * the account.
 */
export function LoginForm({ title = 'Sign in', subtitle = 'Enter your email and we will send you a 6-digit code.' }) {
  const { api, live } = useApp();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const friendly = (err) => {
    const m = String(err?.message || err);
    if (/expired|invalid|otp/i.test(m)) return new Error('That code is wrong or has expired. Check the latest email, or send a new code.');
    if (/rate|security purposes|too many/i.test(m)) return new Error('Too many attempts. Please wait a minute and try again.');
    return err;
  };

  const send = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(new Error('Enter a valid email address.')); return; }
    setBusy(true);
    try {
      await api.sendLoginCode(email);
      setStep('code');
      setCode('');
      setWait(60);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6,8}$/.test(code.trim())) { setError(new Error('The code is the 6 digits from the email.')); return; }
    setBusy(true);
    try {
      await api.verifyLoginCode(email, code);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  };

  return (
    <div className="panel signin-card">
      <h1>{title}</h1>
      {step === 'email' ? (
        <form className="stack gap-sm login-form" onSubmit={send} noValidate>
          <p className="lede">{subtitle}</p>
          <label className="field-row">
            <span className="eyebrow">Email</span>
            <input className="input" type="email" inputMode="email" autoComplete="email" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn primary wide" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
          {!live && <p className="small dim">Demo mode: use any email. The code is <b className="mono">123456</b>.</p>}
        </form>
      ) : (
        <form className="stack gap-sm login-form" onSubmit={verify}>
          <p className="lede">We sent a code to <b>{email.trim()}</b>. It can take a minute — check spam too.</p>
          <label className="field-row">
            <span className="eyebrow">6-digit code</span>
            <input className="input code-input mono" inputMode="numeric" autoComplete="one-time-code" autoFocus
              maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </label>
          <button className="btn primary wide" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="row">
            <button type="button" className="linkish" onClick={() => { setStep('email'); setError(null); }}>Use a different email</button>
            <button type="button" className="linkish" disabled={wait > 0 || busy} onClick={() => send()}>
              {wait > 0 ? `Send again in ${wait}s` : 'Send a new code'}
            </button>
          </div>
        </form>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

/** Wraps pages that need an account: shows the login form in place until signed in. */
export function SignInGate({ children, why = 'to see your account' }) {
  const { session, authReady } = useApp();
  if (!authReady) return <div className="page narrow"><Loading /></div>;
  if (session) return children;
  return (
    <div className="page narrow">
      <LoginForm title={`Sign in ${why}`} />
    </div>
  );
}

/** Loads async data for a page and exposes { data, error, loading, reload }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false })
    );
    return () => { alive = false; };
  }, [...deps, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: () => setN((x) => x + 1) };
}

export const LEDGER_LABEL = {
  earning: 'Daily earnings',
  sla_credit: 'Uptime guarantee',
  referral: 'Referral share',
  cashback: 'First-purchase cashback',
  overpayment: 'Overpayment returned to balance',
  withdrawal: 'Withdrawal',
  withdrawal_reversal: 'Withdrawal returned',
  adjustment: 'Adjustment'
};

export const ORDER_STATUS = {
  awaiting_payment: ['Waiting for payment', 'hot'],
  paid: ['Paid', 'run'],
  expired: ['Expired', 'mute'],
  cancelled: ['Cancelled', 'mute'],
  needs_review: ['Being checked', 'hot']
};

export const fmtDate = (d) =>
  !d ? '—' : new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtDateTime = (d) =>
  !d ? '—' : new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * One page crashing must not blank the whole site. Keyed by route in App.jsx,
 * so moving to another page clears the error.
 */
export class PageBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page narrow">
        <div className="panel stack gap-sm">
          <h1>Something went wrong on this page</h1>
          <p className="lede">Your account and money are not affected. Try again, or go back to the machines.</p>
          <p className="small dim mono">{String(this.state.error.message || this.state.error)}</p>
          <div className="row gap">
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn" onClick={() => { window.location.hash = '#/machines'; }}>Machines</button>
          </div>
        </div>
      </div>
    );
  }
}
