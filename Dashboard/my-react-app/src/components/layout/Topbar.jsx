import { useEffect, useState } from 'react';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2';

const Topbar = ({ sidebarOpen, title, userName, userRole, onToggleSidebar, notifications }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const syncScroll = () => setIsScrolled(window.scrollY > 4);

    syncScroll();
    window.addEventListener('scroll', syncScroll, { passive: true });
    return () => window.removeEventListener('scroll', syncScroll);
  }, []);

  return (
    <header className={`dashboard-topbar ${isScrolled ? 'is-scrolled' : ''}`}>
      <button
        type="button"
        className={`sidebar-toggle topbar-toggle ${sidebarOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <HiOutlineChevronLeft className="sidebar-toggle-icon" /> : <HiOutlineChevronRight className="sidebar-toggle-icon" />}
      </button>
      <div className="dashboard-topbar-title">{title}</div>
      <div className="dashboard-topbar-meta">
        <span>{userName || 'Signed in user'}</span>
        <span className="dashboard-topbar-meta-separator">·</span>
        <span>Role: {userRole || 'unknown'}</span>
      </div>
      <div className="dashboard-topbar-notifications" aria-label="Notifications">
        {notifications}
      </div>
    </header>
  );
};

export default Topbar;
