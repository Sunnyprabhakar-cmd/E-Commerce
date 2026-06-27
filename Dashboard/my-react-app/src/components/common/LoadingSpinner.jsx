const LoadingSpinner = ({ label = 'Loading…', className = '' }) => (
  <div className={`loading-state ${className}`.trim()} role="status" aria-live="polite">
    <div className="spinner-border text-primary" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export default LoadingSpinner;
