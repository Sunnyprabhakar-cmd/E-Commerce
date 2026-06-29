import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const DashboardLayout = ({
  sidebarOpen,
  navItems,
  currentView,
  session,
  userRole,
  title,
  onNavigate,
  onLogout,
  onToggleSidebar,
  onHome,
  children,
  notifications,
}) => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const lockScroll = sidebarOpen && window.innerWidth <= 1023;
    document.body.classList.toggle('dashboard-scroll-lock', lockScroll);

    return () => {
      document.body.classList.remove('dashboard-scroll-lock');
    };
  }, [sidebarOpen]);

  return (
    <div className={`dashboard-shell dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="dashboard-backdrop"
          aria-label="Close navigation menu"
          onClick={onToggleSidebar}
        />
      )}

      <Sidebar
        items={navItems}
        activeView={currentView}
        sidebarOpen={sidebarOpen}
        sessionName={session?.name}
        userRole={userRole}
        onNavigate={onNavigate}
        onNavigateAndClose={(view) => {
          onNavigate(view);
          if (typeof window !== 'undefined' && window.innerWidth <= 1023) {
            onToggleSidebar();
          }
        }}
        onLogout={onLogout}
        onHome={onHome}
      />

      <div className="dashboard-main">
        <Topbar
          sidebarOpen={sidebarOpen}
          title={title}
          userName={session?.name}
          userRole={userRole}
          onToggleSidebar={onToggleSidebar}
          notifications={notifications}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
