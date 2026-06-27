const AppCard = ({ title, subtitle, children, actions, className = '' }) => (
  <div className={`app-card-shell card shadow-sm border-0 ${className}`.trim()}>
    {(title || subtitle || actions) && (
      <div className="app-card-header card-header bg-transparent border-0 d-flex justify-content-between align-items-start gap-3">
        <div>
          {title && <h3 className="app-card-title mb-1">{title}</h3>}
          {subtitle && <p className="app-card-subtitle mb-0">{subtitle}</p>}
        </div>
        {actions && <div className="app-card-actions">{actions}</div>}
      </div>
    )}
    <div className="card-body app-card-body">{children}</div>
  </div>
);

export default AppCard;
