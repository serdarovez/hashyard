import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { CONFIG } from '../data/config.js';
import { buildAccount } from '../data/account.js';
import { SEED_FLEET, SEED_USERS, SEED_ORDERS, SEED_WITHDRAWALS } from '../data/admin.js';

/**
 * One store for both sides of the product.
 *
 * The admin panel edits `config`; every customer page derives its figures from
 * that same object, so a change to hashprice or the power tariff moves the
 * marketplace, the dashboard and the settlement page in the same render. That
 * is the whole point of keeping the economy in constants rather than scattering
 * numbers through the views.
 */
const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [config, setConfig] = useState(CONFIG);
  const [fleet, setFleet] = useState(SEED_FLEET);
  const [withdrawals, setWithdrawals] = useState(SEED_WITHDRAWALS);
  const [users] = useState(SEED_USERS);
  const [orders] = useState(SEED_ORDERS);

  // Recomputed only when the config actually moves.
  const account = useMemo(() => buildAccount(config), [config]);

  const setConfigValue = useCallback((key, value) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  const resetConfig = useCallback(() => setConfig(CONFIG), []);

  const decideWithdrawal = useCallback((id, status) => {
    setWithdrawals((ws) => ws.map((w) => (w.id === id ? { ...w, status } : w)));
  }, []);

  const toggleRig = useCallback((sn) => {
    setFleet((f) =>
      f.map((r) => (r.sn === sn ? { ...r, online: !r.online, temp: r.online ? 0 : 62 } : r))
    );
  }, []);

  const value = useMemo(
    () => ({
      config, setConfigValue, resetConfig,
      dirty: Object.keys(CONFIG).some((k) => CONFIG[k] !== config[k]),
      ...account,
      fleet, toggleRig,
      withdrawals, decideWithdrawal,
      users, orders
    }),
    [config, account, fleet, withdrawals, users, orders,
     setConfigValue, resetConfig, decideWithdrawal, toggleRig]
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return ctx;
}
