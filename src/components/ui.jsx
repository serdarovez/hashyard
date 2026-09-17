import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state/AppContext.jsx';
import { rememberReturn } from '../lib/afterLogin.js';

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

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

/**
 * Sign in with Google: one button, no passwords or codes. The first sign-in
 * creates the account. Google sends people back to the home page, so the page
 * they were on is remembered first and AppContext returns them to it.
 */
export function LoginForm({ title = 'Sign in', subtitle = 'Use your Google account — there is no password to remember.' }) {
  const { api, live } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const go = async () => {
    setError(null);
    setBusy(true);
    const here = window.location.hash;
    rememberReturn(here && !/^#\/(login|signin)/.test(here) ? here : null);
    try {
      await api.signInWithGoogle();
      if (!live) setBusy(false); // the live site is on its way to Google
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="panel signin-card">
      <h1>{title}</h1>
      <p className="lede">{subtitle}</p>
      <button type="button" className="btn wide btn-google" onClick={go} disabled={busy}>
        <GoogleMark />
        <span>{busy ? 'Opening Google…' : 'Continue with Google'}</span>
      </button>
      <p className="small dim">
        {live
          ? 'The first time, this creates your Hashyard account. We only receive your name and email address from Google.'
          : 'Demo mode: this signs you straight in as the sample customer.'}
      </p>
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
