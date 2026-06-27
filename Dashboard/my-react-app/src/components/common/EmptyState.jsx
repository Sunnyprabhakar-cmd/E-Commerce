const EmptyState = ({ title, description, action }) => (
  <div className="empty-state-panel">
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
);

export default EmptyState;
