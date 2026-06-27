import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import InviteActivation from './components/InviteActivation';
import LandingPage from './components/LandingPage';
import { applyStoredTheme } from './utils/themeManager';
import './App.css';

function App() {
  const [inviteType, setInviteType] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [hasSession, setHasSession] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    const pathname = window.location.pathname;
    const employeeMatch = pathname.match(/^\/employee-invite\/([^/]+)/);
    const customerMatch = pathname.match(/^\/customer-invite\/([^/]+)/);

    if (employeeMatch?.[1]) {
      setInviteType('employee');
      setInviteToken(employeeMatch[1]);
    } else if (customerMatch?.[1]) {
      setInviteType('customer');
      setInviteToken(customerMatch[1]);
    }
  }, []);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  useEffect(() => {
    const syncSession = () => setHasSession(Boolean(localStorage.getItem('token')));
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  if (inviteToken) {
    return <InviteActivation inviteType={inviteType} inviteToken={inviteToken} />;
  }

  if (!hasSession) {
    return <LandingPage onLogin={() => setHasSession(true)} />;
  }

  return <Dashboard />;
}

export default App;
