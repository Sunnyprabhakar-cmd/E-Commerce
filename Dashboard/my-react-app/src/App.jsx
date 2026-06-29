import { lazy, Suspense, useEffect, useState } from 'react';
import { applyStoredTheme } from './utils/themeManager';
import LoadingSpinner from './components/common/LoadingSpinner';
import './App.css';
import './styles/toolbar.css';

const Dashboard = lazy(() => import('./components/Dashboard'));
const LogoutSuccess = lazy(() => import('./components/LogoutSuccess'));
const InviteActivation = lazy(() => import('./components/InviteActivation'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const PasswordResetFlow = lazy(() => import('./components/PasswordResetFlow'));

function App() {
  const [inviteType, setInviteType] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [hasSession, setHasSession] = useState(Boolean(localStorage.getItem('token')));
  const [screen, setScreen] = useState(Boolean(localStorage.getItem('token')) ? 'dashboard' : 'landing');

  useEffect(() => {
    const pathname = window.location.pathname;
    const employeeMatch = pathname.match(/^\/employee-invite\/([^/]+)/);
    const customerMatch = pathname.match(/^\/customer-invite\/([^/]+)/);
    const searchParams = new URLSearchParams(window.location.search);

    if (employeeMatch?.[1]) {
      setInviteType('employee');
      setInviteToken(employeeMatch[1]);
    } else if (customerMatch?.[1]) {
      setInviteType('customer');
      setInviteToken(customerMatch[1]);
    }

    const resetValue = searchParams.get('reset');
    if (resetValue) {
      setResetToken(resetValue);
    }
  }, []);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  useEffect(() => {
    const syncSession = () => {
      const nextHasSession = Boolean(localStorage.getItem('token'));
      setHasSession(nextHasSession);
      setScreen((current) => (nextHasSession ? 'dashboard' : current === 'dashboard' ? 'landing' : current));
    };
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  if (inviteToken) {
    return (
      <Suspense fallback={<LoadingSpinner className="mt-5" label="Loading invite flow..." />}>
        <InviteActivation inviteType={inviteType} inviteToken={inviteToken} />
      </Suspense>
    );
  }

  if (resetToken) {
    return (
      <Suspense fallback={<LoadingSpinner className="mt-5" label="Loading password reset..." />}>
        <PasswordResetFlow onBack={() => setResetToken('')} initialToken={resetToken} />
      </Suspense>
    );
  }

  if (screen === 'logout') {
    return (
      <Suspense fallback={<LoadingSpinner className="mt-5" label="Preparing logout screen..." />}>
        <LogoutSuccess onLoginAgain={() => setScreen('landing')} onGoHome={() => setScreen('landing')} />
      </Suspense>
    );
  }

  if (!hasSession) {
    return (
      <Suspense fallback={<LoadingSpinner className="mt-5" label="Loading landing page..." />}>
        <LandingPage onLogin={() => { setHasSession(true); setScreen('dashboard'); }} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner className="mt-5" label="Loading dashboard..." />}>
      <Dashboard onLogoutSuccess={() => { setHasSession(false); setScreen('logout'); }} />
    </Suspense>
  );
}

export default App;
