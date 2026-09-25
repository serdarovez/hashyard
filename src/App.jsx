import React, { useState } from 'react';
import Header from './components/Header.jsx';
import MobileNav from './components/MobileNav.jsx';
import Machines from './pages/Machines.jsx';
import MachineDetail from './pages/MachineDetail.jsx';
import Checkout from './pages/Checkout.jsx';
import Pay from './pages/Pay.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Wallet from './pages/Wallet.jsx';
import Referrals from './pages/Referrals.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Overview from './admin/Overview.jsx';
import Results from './admin/Results.jsx';
import MachinesAdmin from './admin/MachinesAdmin.jsx';
import Orders from './admin/Orders.jsx';
import Withdrawals from './admin/Withdrawals.jsx';
import Customers from './admin/Customers.jsx';
import Settings from './admin/Settings.jsx';
import { PageBoundary } from './components/ui.jsx';
import { AppProvider, useApp } from './state/AppContext.jsx';
import { useRouter } from './lib/useRouter.js';
import { useTheme } from './lib/useTheme.js';

const ADMIN = {
  admin: Overview,
  'admin-results': Results,
  'admin-machines': MachinesAdmin,
  'admin-orders': Orders,
  'admin-withdrawals': Withdrawals,
  'admin-users': Customers,
  'admin-settings': Settings
};

function Site() {
  const { route, go } = useRouter();
  const { theme, setTheme } = useTheme();
  const { config, live, error, clearError } = useApp();

  // the plan is picked on the machine page and must survive to checkout
  const [split, setSplit] = useState(config.splitStandard);

  const AdminPage = ADMIN[route.page];
  if (AdminPage) {
    return (
      <AdminLayout page={route.page} go={go}>
        <PageBoundary key={route.page}><AdminPage go={go} /></PageBoundary>
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
    case 'pay':
      view = <Pay id={route.param} go={go} />;
      break;
    case 'dashboard':
      view = <Dashboard go={go} />;
      break;
    // the old Payouts page folded into the dashboard; keep old links working
    case 'settlement':
      view = <Dashboard go={go} />;
      break;
    case 'wallet':
      view = <Wallet />;
      break;
    case 'referrals':
      view = <Referrals />;
      break;
    case 'leaderboard':
      view = <Leaderboard go={go} />;
      break;
    case 'login':
    case 'signin':
      view = <Login go={go} />;
      break;
    default:
      view = <Machines go={go} />;
  }

  return (
    <>
      <Header page={route.page} go={go} theme={theme} setTheme={setTheme} />
      {error && (
        <div className="live-banner error-banner" role="alert">
          {error} <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      <main className="shell"><PageBoundary key={route.page + (route.param || '')}>{view}</PageBoundary></main>
      <MobileNav page={route.page} go={go} />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Site />
    </AppProvider>
  );
}
