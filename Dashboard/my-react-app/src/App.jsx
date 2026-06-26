import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import api from './api/client';
import './App.css';

function App() {
  const [inviteToken, setInviteToken] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const match = window.location.pathname.match(/^\/employee-invite\/([^/]+)/);
    if (match?.[1]) {
      setInviteToken(match[1]);
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post(`/employee-invites/${inviteToken}/activate`, form);
      setMessage(response.data?.message || 'Account created');
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to activate invite');
    }
  };

  if (inviteToken) {
    return (
      <div className="dashboard-shell d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="card shadow-sm" style={{ width: 'min(720px, 94vw)' }}>
          <div className="card-body p-4 p-md-5">
            <h1 className="h3 mb-2">Employee account setup</h1>
            <p className="text-muted mb-4">Complete your login details to activate your employee account.</p>
            {message && <div className="alert alert-info">{message}</div>}
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
