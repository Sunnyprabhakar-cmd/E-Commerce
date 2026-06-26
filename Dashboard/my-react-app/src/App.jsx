import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import api from './api/client';
import './App.css';

function App() {
  const [inviteType, setInviteType] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [notifications, setNotifications] = useState([]);

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
    const handleNotify = (event) => {
      const detail = event.detail || {};
      const id = detail.id || crypto.randomUUID();
      const message = detail.message || 'Notification';
      const type = detail.type || 'info';
      setNotifications((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
      }, detail.timeout || 5000);
    };

    window.addEventListener('app:notify', handleNotify);
    return () => window.removeEventListener('app:notify', handleNotify);
  }, []);

  const notify = (message, type = 'info') => {
    window.dispatchEvent(new CustomEvent('app:notify', { detail: { message, type } }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const endpoint = inviteType === 'customer'
        ? `/customer-invites/${inviteToken}/activate`
        : `/employee-invites/${inviteToken}/activate`;
      const response = await api.post(endpoint, form);
      notify(response.data?.message || 'Account created', 'success');
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      if (response.data?.token || response.data?.refreshToken) {
        window.location.href = '/';
      }
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to activate invite', 'danger');
    }
  };

  if (inviteToken) {
    return (
      <div className="dashboard-shell d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="notification-stack">
          {notifications.map((notification) => (
            <div key={notification.id} className={`notification-pill ${notification.type}`}>
              <span>{notification.message}</span>
              <button type="button" className="btn-close btn-close-white ms-3" aria-label="Close" onClick={() => setNotifications((prev) => prev.filter((item) => item.id !== notification.id))} />
            </div>
          ))}
        </div>
        <div className="card shadow-sm" style={{ width: 'min(720px, 94vw)' }}>
          <div className="card-body p-4 p-md-5">
            <h1 className="h3 mb-2">{inviteType === 'customer' ? 'Customer account setup' : 'Employee account setup'}</h1>
            <p className="text-muted mb-4">Complete your login details to activate your {inviteType === 'customer' ? 'customer' : 'employee'} account.</p>
            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input className="form-control" name="email" type="email" value={form.email} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Password</label>
                <input className="form-control" name="password" type="password" value={form.password} onChange={handleChange} required />
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button className="btn btn-primary">Activate account</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

export default App;
