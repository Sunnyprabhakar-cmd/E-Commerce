const PageHeader = ({ kicker, title, description, actions }) => (
  <div className="page-header-shell">
    <div>
      {kicker && <div className="toolbar-kicker">{kicker}</div>}
      <h1 className="page-header-title mb-1">{title}</h1>
      {description && <p className="page-header-description mb-0">{description}</p>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>
);

export default PageHeader;
