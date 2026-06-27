import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import InviteActivation from './components/InviteActivation';
import { applyStoredTheme } from './utils/themeManager';
import './App.css';

function App() {
  const [inviteType, setInviteType] = useState('');
  const [inviteToken, setInviteToken] = useState('');

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

  if (inviteToken) {
    return <InviteActivation inviteType={inviteType} inviteToken={inviteToken} />;
  }

  return <Dashboard />;
}

export default App;
