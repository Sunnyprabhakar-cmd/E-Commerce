import { useEffect } from 'react';
import { HiOutlineCheckCircle, HiOutlineHomeModern } from 'react-icons/hi2';

const LogoutSuccess = ({ onLoginAgain, onGoHome }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onGoHome?.();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [onGoHome]);

  return (
    <div className="logout-success-shell">
      <div className="logout-success-card">
        <div className="logout-success-icon">
          <HiOutlineCheckCircle />
        </div>
        <div className="logout-success-copy">
          <div className="auth-card-kicker">Session ended</div>
          <h1>Thank You!</h1>
          <p>You have been logged out successfully.</p>
          <p>Thank you for using our platform. We hope to see you again soon.</p>
        </div>
        <div className="logout-success-actions">
          <button type="button" className="btn btn-primary" onClick={onLoginAgain}>Login Again</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onGoHome}>
            <HiOutlineHomeModern />
            <span>Go Home</span>
          </button>
        </div>
        <div className="logout-success-footer">Have a wonderful day.</div>
      </div>
    </div>
  );
};

export default LogoutSuccess;
