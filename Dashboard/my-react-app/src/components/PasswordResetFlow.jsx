import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineKey,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';
import { confirmPasswordReset, requestPasswordReset, verifyPasswordResetToken } from '../services/authService';
import { notify } from '../utils/notify';

const PasswordResetFlow = ({ onBack, initialToken = '' }) => {
  const [step, setStep] = useState(initialToken ? 'verify' : 'request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resultLink, setResultLink] = useState('');

  const progressLabel = useMemo(() => {
    if (step === 'request') return 'Step 1 of 3';
    if (step === 'verify') return 'Step 2 of 3';
    return 'Step 3 of 3';
  }, [step]);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setStep('verify');
    }
  }, [initialToken]);

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await requestPasswordReset({ email: email.trim() });
      const nextToken = response.data?.resetToken || '';
      const nextLink = response.data?.resetLink || '';
      setResultLink(nextLink);
      if (nextToken) {
        setToken(nextToken);
        setStep('verify');
        setMessage('Reset link created. Verify the token and continue.');
      } else {
        setMessage('Reset link created. Check your email inbox or use the provided token.');
        setStep('verify');
      }
      notify('Password reset link created.', 'success');
    } catch (requestError) {
      const nextMessage = requestError.response?.data?.message || 'Unable to create reset link. Please try again.';
      setError(nextMessage);
      notify(nextMessage, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyToken = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyPasswordResetToken(token.trim());
      setStep('confirm');
      setMessage('Token verified. Choose a new password.');
      notify('Reset token verified.', 'success');
    } catch (verifyError) {
      const nextMessage = verifyError.response?.data?.message || 'Invalid or expired reset token.';
      setError(nextMessage);
      notify(nextMessage, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (newPassword.trim().length < 8) {
      setError('Password must contain at least 8 characters.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      await confirmPasswordReset({ token: token.trim(), password: newPassword.trim() });
      setStep('done');
      setMessage('Your password has been reset successfully.');
      notify('Password reset successfully.', 'success');
    } catch (resetError) {
      const nextMessage = resetError.response?.data?.message || 'Unable to reset password.';
      setError(nextMessage);
      notify(nextMessage, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="auth-card-shell password-reset-shell">
        <div className="auth-card-topline">
          <div className="auth-brand-line auth-card-brand-line">
            <div className="auth-brand-mark" aria-hidden="true"><HiOutlineCheckCircle /></div>
            <div>
              <div className="auth-company-name">Password Reset Complete</div>
              <div className="auth-company-subtitle">You can sign in with your new password now</div>
            </div>
          </div>
        </div>
        <div className="auth-card-header">
          <div className="auth-card-kicker">Success</div>
          <h2>Password updated</h2>
          <p>Your account password is ready. Return to the login screen to continue.</p>
        </div>
        <div className="auth-status-banner success" role="status" aria-live="polite">
          {message}
        </div>
        <div className="auth-step-actions">
          <button type="button" className="auth-secondary-btn" onClick={onBack}>Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card-shell password-reset-shell">
      <div className="auth-card-topline">
        <div className="auth-brand-line auth-card-brand-line">
          <div className="auth-brand-mark" aria-hidden="true"><HiOutlineShieldCheck /></div>
          <div>
            <div className="auth-company-name">Reset your password</div>
            <div className="auth-company-subtitle">Secure account recovery</div>
          </div>
        </div>
        <button type="button" className="auth-link-button" onClick={onBack}>Back to login</button>
      </div>

      <div className="auth-progress">
        <div className="auth-progress-text">{progressLabel}</div>
        <div className="auth-progress-track" aria-hidden="true">
          <span className={`auth-progress-dot ${step !== 'request' ? 'active' : ''}`} />
          <span className={`auth-progress-line ${step === 'confirm' || step === 'done' ? 'active' : ''}`} />
          <span className={`auth-progress-dot ${step === 'confirm' || step === 'done' ? 'active' : ''}`} />
        </div>
      </div>

      <div className="auth-card-header">
        <div className="auth-card-kicker">Forgot Password</div>
        <h2>{step === 'request' ? 'Enter your email' : step === 'verify' ? 'Verify reset token' : 'Create a new password'}</h2>
        <p>
          {step === 'request' && 'We will create a reset link for your account.'}
          {step === 'verify' && 'Paste the token from the link you received to continue.'}
          {step === 'confirm' && 'Choose a secure new password to finish recovery.'}
        </p>
      </div>

      {message && <div className="auth-status-banner success" role="status" aria-live="polite">{message}</div>}
      {error && <div className="auth-status-banner danger" role="alert">{error}</div>}
      {resultLink && step !== 'done' && <div className="auth-status-banner info">Reset link: <span className="text-break">{resultLink}</span></div>}

      {step === 'request' && (
        <form className="auth-form" onSubmit={handleRequestReset} noValidate>
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reset-email">Email</label>
            <div className="auth-field">
              <span className="auth-field-icon" aria-hidden="true"><HiOutlineEnvelope /></span>
              <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required />
            </div>
          </div>
          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            <span className="auth-submit-label">Send Reset Link</span>
            {isLoading ? <span className="auth-spinner" aria-hidden="true" /> : <HiOutlineArrowRight aria-hidden="true" />}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form className="auth-form" onSubmit={handleVerifyToken} noValidate>
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="reset-token">Reset Token</label>
            <div className="auth-field">
              <span className="auth-field-icon" aria-hidden="true"><HiOutlineKey /></span>
              <input id="reset-token" type="text" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste reset token" required />
            </div>
          </div>
          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            <span className="auth-submit-label">Verify Token</span>
            {isLoading ? <span className="auth-spinner" aria-hidden="true" /> : <HiOutlineArrowRight aria-hidden="true" />}
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <form className="auth-form" onSubmit={handleConfirmReset} noValidate>
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="new-password">New password</label>
            <div className="auth-field auth-field-password">
              <span className="auth-field-icon" aria-hidden="true"><HiOutlineLockClosed /></span>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password"
                required
              />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <HiOutlineEyeSlash aria-hidden="true" /> : <HiOutlineEye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="confirm-password">Confirm password</label>
            <div className="auth-field auth-field-password">
              <span className="auth-field-icon" aria-hidden="true"><HiOutlineLockClosed /></span>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            <span className="auth-submit-label">Reset Password</span>
            {isLoading ? <span className="auth-spinner" aria-hidden="true" /> : <HiOutlineArrowRight aria-hidden="true" />}
          </button>
        </form>
      )}
    </div>
  );
};

export default PasswordResetFlow;
