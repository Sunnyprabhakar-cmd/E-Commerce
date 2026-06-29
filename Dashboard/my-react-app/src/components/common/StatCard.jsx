const StatCard = ({ label, value, description, className = '' }) => (
  <div className={`app-card-shell card shadow-sm border-0 ${className}`.trim()}>
    <div className="card-body stat-card-body">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {description && <div className="stat-card-description">{description}</div>}
    </div>
  </div>
);

export default StatCard;
