import React, { useState } from 'react';
import Header from './components/Header.jsx';
import Machines from './pages/Machines.jsx';
import MachineDetail from './pages/MachineDetail.jsx';
import Checkout from './pages/Checkout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settlement from './pages/Settlement.jsx';
import Wallet from './pages/Wallet.jsx';
import Referrals from './pages/Referrals.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Overview from './admin/Overview.jsx';
import Fleet from './admin/Fleet.jsx';
import Withdrawals from './admin/Withdrawals.jsx';
import Customers from './admin/Customers.jsx';
import Pricing from './admin/Pricing.jsx';
import { PlatformProvider, usePlatform } from './state/PlatformContext.jsx';
import { useRouter } from './lib/useRouter.js';
import { useTheme } from './lib/useTheme.js';

const ADMIN = {
  admin: Overview,
  'admin-fleet': Fleet,
  'admin-withdrawals': Withdrawals,
  'admin-users': Customers,
  'admin-pricing': Pricing
};

function Site() {
  const { route, go } = useRouter();
  const { theme, setTheme } = useTheme();
  const { config, dirty } = usePlatform();

  // Purchase intent lives above the pages: the split is picked on the machine
  // page and must still be there at checkout.
  const [split, setSplit] = useState(config.splitStandard);
  const [day, setDay] = useState(3); // Thursday - the day the guarantee pays

  const openDay = (i) => { setDay(i); go('settlement'); };

  const AdminPage = ADMIN[route.page];
  if (AdminPage) {
    return (
      <AdminLayout page={route.page} go={go}>
        <AdminPage go={go} />
      </AdminLayout>
    );
  }

  let view;
  switch (route.page) {
    case 'machine':
      view = <MachineDetail id={route.param} split={split} setSplit={setSplit} go={go} />;
      break;
    case 'checkout':
      view = <Checkout id={route.param} split={split} setSplit={setSplit} go={go} />;
      break;
    case 'dashboard':
      view = <Dashboard go={go} onPickDay={openDay} />;
      break;
    case 'settlement':
      view = <Settlement day={day} setDay={setDay} />;
      break;
    case 'wallet':
      view = <Wallet />;
      break;
    case 'referrals':
      view = <Referrals />;
      break;
    default:
      view = <Machines go={go} />;
  }

  return (
    <>
      <Header page={route.page} go={go} theme={theme} setTheme={setTheme} />
      {dirty && (
        <div className="live-banner">
          Showing edited platform values from the operator console.
          <button onClick={() => go('admin-pricing')}>Open pricing</button>
        </div>
      )}
      <main className="shell">{view}</main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <span>Hashyard — prototype. No live wallet, no real funds.</span>
          <span className="mono">
            Hashprice ${config.btcHashprice.toFixed(2)}/PH·day · power ${config.powerRate.toFixed(3)}/kWh ·
            SLA {Math.round(config.uptimeSLA * 100)}%
          </span>
          <button className="linkish" onClick={() => go('admin')}>Operator console →</button>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <Site />
    </PlatformProvider>
  );
}
