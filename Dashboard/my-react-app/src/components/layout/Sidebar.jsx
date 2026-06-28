import { dashboardNavigationMark } from '../../constants/navigation';

const Sidebar = ({ items, activeView, sidebarOpen, sessionName, userRole, onNavigate, onLogout, onHome, onNavigateAndClose }) => {
  const BrandIcon = dashboardNavigationMark;

  return (
    <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="sidebar-header">
        <button type="button" className="sidebar-brand" onClick={onHome} title="Pearry's Dashboard">
          <span className="sidebar-brand-mark" aria-hidden="true">
            <BrandIcon />
          </span>
          <span className="sidebar-brand-text">Pearry's Dashboard</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`sidebar-link ${activeView === item.view ? 'active' : ''}`}
            onClick={() => (onNavigateAndClose || onNavigate)(item.view)}
            title={item.label}
            data-tooltip={item.label}
          >
            <span className="sidebar-link-icon" aria-hidden="true">
              <item.icon />
            </span>
            <span className="sidebar-link-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-session">
          <div className="sidebar-session-name">{sessionName || 'Signed in user'}</div>
          <div className="sidebar-session-role">Role: {userRole || 'unknown'}</div>
        </div>
        <button type="button" className="btn btn-outline-light w-100" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
