import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, LIVE } from '../api/index.js';
import { CONFIG } from '../data/config.js';

/**
 * Everything the pages share: the catalogue and terms (public), and - once
 * someone signs in - their profile, balance, ledger, machines, orders and
 * withdrawals. Account data reloads by itself when the backend pushes a
 * change, so a payment confirming or a withdrawal being sent shows up
 * without a refresh.
 */
const AppContext = createContext(null);
const EMPTY = { balance: 0, ledger: [], holdings: [], orders: [], withdrawals: [] };
const safe = (fn) => { try { return fn(); } catch { return null; } };

export function AppProvider({ children }) {
  const [config, setConfig] = useState(CONFIG);
  const [machines, setMachines] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(EMPTY);
  const [accountReady, setAccountReady] = useState(false);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async () => {
    try {
      const [settings, list] = await Promise.all([api.getSettings(), api.listMachines()]);
      setConfig((c) => ({ ...c, ...settings }));
      setMachines(list);
    } catch (e) {
      setError(`Could not load the catalogue: ${e.message}`);
    } finally {
      setCatalogReady(true);
    }
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const [p, balance, ledger, holdings, orders, withdrawals] = await Promise.all([
        api.getProfile(), api.myBalance(), api.myLedger(), api.myHoldings(), api.myOrders(), api.myWithdrawals()
      ]);
      setProfile(p);
      setAccount({ balance, ledger, holdings, orders, withdrawals });
    } catch (e) {
      setError(`Could not load your account: ${e.message}`);
    } finally {
      setAccountReady(true);
    }
  }, []);

  // boot: public data, then whoever is signed in
  useEffect(() => {
    loadCatalog();
    api.getSession().then((s) => { setSession(s); setAuthReady(true); });
    const off = api.onAuthChange((s) => setSession(s));

    // a ?ref=CODE link is remembered until the visitor signs in
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) safe(() => localStorage.setItem('hy-ref', ref));
    return off;
  }, [loadCatalog]);

  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) { setProfile(null); setAccount(EMPTY); setAccountReady(false); return undefined; }

    loadAccount();

    const ref = safe(() => localStorage.getItem('hy-ref'));
    if (ref) api.setReferrer(ref).catch(() => {}).finally(() => safe(() => localStorage.removeItem('hy-ref')));

    // signed in from the login page: go back to where they were, or the dashboard
    if (/^#\/(login|signin)/.test(window.location.hash)) {
      const back = safe(() => sessionStorage.getItem('hy-after-login'));
      safe(() => sessionStorage.removeItem('hy-after-login'));
      window.location.hash = back || '#/dashboard';
    }

    let timer;
    const off = api.watchAccount(() => { clearTimeout(timer); timer = setTimeout(loadAccount, 250); });
    return () => { clearTimeout(timer); off(); };
  }, [uid, loadAccount]);

  // opens the login page, remembering where to come back to
  const signIn = useCallback((returnTo) => {
    if (returnTo && !/^#\/login/.test(returnTo)) safe(() => sessionStorage.setItem('hy-after-login', returnTo));
    window.location.hash = '#/login';
  }, []);

  const value = useMemo(() => ({
    api,
    live: LIVE,
    config,
    machines,
    catalogReady,
    reloadCatalog: loadCatalog,
    session,
    authReady,
    profile,
    isAdmin: profile?.role === 'admin',
    ...account,
    accountReady,
    reloadAccount: loadAccount,
    signIn,
    signOut: () => api.signOut(),
    error,
    clearError: () => setError(null)
  }), [config, machines, catalogReady, loadCatalog, session, authReady, profile, account, accountReady,
       loadAccount, signIn, error]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
