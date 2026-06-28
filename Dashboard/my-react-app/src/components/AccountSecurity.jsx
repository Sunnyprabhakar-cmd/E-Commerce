import { useState } from 'react';
import { HiOutlineArrowRight, HiOutlineLockClosed, HiOutlineShieldCheck } from 'react-icons/hi2';
import { changeAccountPassword } from '../services/authService';
import { notify } from '../utils/notify';

const AccountSecurity = ({ session }) => {
  const [formData, setFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('Fill all password fields.');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must contain at least 8 characters.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await changeAccountPassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      const successMessage = response.data?.message || 'Password updated successfully.';
      setMessage(successMessage);
      notify(successMessage, 'success');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (changeError) {
      const nextError = changeError.response?.data?.message || changeError.message || 'Failed to update password';
      setError(nextError);
      notify(nextError, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="settings-center-shell account-security-shell">
      <div className="card shadow-sm border-0 rounded-4 mb-4">
        <div className="card-body p-4 p-lg-5 d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-start align-items-lg-center">
          <div>
            <div className="text-uppercase small fw-bold opacity-75">Account settings</div>
            <h2 className="mb-1">Change your password</h2>
            <p className="mb-0 text-muted">This updates the current {session?.role || 'account'} login for {session?.name || 'the signed-in user'}.</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="badge rounded-pill text-bg-dark">Secure access</span>
            <span className="badge rounded-pill text-bg-secondary">Applies to admins and employees</span>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`alert ${error ? 'alert-danger' : 'alert-success'} mb-4`} role="status">
          {error || message}
        </div>
      )}

      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex gap-3 align-items-start mb-4">
            <div className="account-security-icon"><HiOutlineShieldCheck /></div>
            <div>
              <h3 className="h5 mb-1">Password update</h3>
              <p className="text-muted mb-0">Enter your current password, then choose a new one. Old refresh tokens will be revoked after the update.</p>
            </div>
          </div>

          <form className="row g-3" onSubmit={handleSubmit}>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Current password</label>
              <div className="input-group">
                <span className="input-group-text"><HiOutlineLockClosed /></span>
                <input className="form-control" type="password" value={formData.currentPassword} onChange={(event) => setFormData((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" />
              </div>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">New password</label>
              <div className="input-group">
                <span className="input-group-text"><HiOutlineLockClosed /></span>
                <input className="form-control" type="password" value={formData.newPassword} onChange={(event) => setFormData((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" />
              </div>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Confirm new password</label>
              <div className="input-group">
                <span className="input-group-text"><HiOutlineLockClosed /></span>
                <input className="form-control" type="password" value={formData.confirmPassword} onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" />
              </div>
            </div>
            <div className="col-12 d-flex justify-content-end">
              <button type="submit" className="btn btn-dark d-inline-flex align-items-center gap-2" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update password'}
                {!submitting && <HiOutlineArrowRight />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AccountSecurity;