import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const InviteActivation = ({ inviteType = 'employee', inviteToken }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const endpointBase = inviteType === 'customer' ? '/customer-invites' : '/employee-invites';

  useEffect(() => {
    let cancelled = false;

    const loadInvite = async () => {
      try {
        const response = await api.get(`${endpointBase}/${inviteToken}`);
        if (!cancelled) {
          setInvite(response.data?.invite || null);
          setForm((current) => ({
            ...current,
            name: response.data?.invite?.employee_name || current.name,
            email: response.data?.invite?.invite_email || current.email,
            phone: response.data?.invite?.phone || response.data?.invite?.invite_phone || current.phone,
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.response?.data?.message || 'Invite link is invalid or unavailable');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [endpointBase, inviteToken]);

  const status = useMemo(() => {
    if (!invite) return 'pending';
    if (invite.invite_status) return invite.invite_status;
    if (invite.used_at || invite.activated_at) return 'accepted';
    if (invite.invite_expires_at && new Date(invite.invite_expires_at).getTime() < Date.now()) return 'expired';
    return 'pending';
  }, [invite]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`${endpointBase}/${inviteToken}/activate`, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      window.location.href = '/';
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to activate invite');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="invite-shell">
        <div className="invite-card invite-loading">Loading invitation...</div>
      </div>
    );
  }

  return (
    <div className="invite-shell">
      <div className="invite-glow invite-glow-a" />
      <div className="invite-glow invite-glow-b" />
      <div className="invite-panel">
        <div className="invite-brand">
          <div className="invite-mark">ERP</div>
          <div>
            <div className="invite-kicker">Invitation Activation</div>
            <h1>{inviteType === 'customer' ? 'Customer account setup' : 'Employee account setup'}</h1>
            <p>Complete your details, create a password, and activate your account.</p>
          </div>
        </div>

        <div className="invite-status-bar">
          <div>
            <span>Status</span>
            <strong className={`invite-status ${status}`}>{status}</strong>
          </div>
          <div>
            <span>Expires</span>
            <strong>{invite?.invite_expires_at ? new Date(invite.invite_expires_at).toLocaleString() : 'N/A'}</strong>
          </div>
          <div>
            <span>Token</span>
            <strong>{inviteToken.slice(0, 12)}...</strong>
          </div>
        </div>

        {status === 'expired' && (
          <div className="invite-warning">This invitation has expired. Ask the administrator to resend it.</div>
        )}

        {error && <div className="invite-error">{error}</div>}

        <form className="invite-form" onSubmit={handleSubmit}>
          <div className="row g-3">
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
            <div className="col-md-6">
              <label className="form-label">Confirm Password</label>
              <input className="form-control" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required />
            </div>
          </div>
          <div className="d-flex justify-content-end mt-4">
            <button className="btn btn-primary" disabled={submitting || status === 'expired'}>
              {submitting ? 'Activating...' : 'Activate Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteActivation;
