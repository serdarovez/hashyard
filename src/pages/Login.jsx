import React from 'react';
import { LoginForm, Loading } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function Login({ go }) {
  const { session, authReady } = useApp();
  if (!authReady) return <div className="page narrow"><Loading /></div>;
  if (session) {
    // AppContext sends a freshly signed-in visitor back where they came from;
    // this covers someone who opens #/login while already signed in
    return (
      <div className="page narrow">
        <div className="panel signin-card">
          <h1>You&apos;re signed in</h1>
          <button className="btn primary" onClick={() => go('dashboard')}>Go to my dashboard</button>
        </div>
      </div>
    );
  }
  return (
    <div className="page narrow">
      <LoginForm title="Sign in to Hashyard" />
    </div>
  );
}
