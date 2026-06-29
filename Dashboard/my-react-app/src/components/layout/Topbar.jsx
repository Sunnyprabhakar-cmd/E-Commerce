import { useEffect, useRef, useState } from 'react';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineCog6Tooth,
  HiOutlineUserCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';

const Topbar = ({ sidebarOpen, title, userName, userRole, onToggleSidebar, notifications, onNavigate, onLogout }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const syncScroll = () => setIsScrolled(window.scrollY > 4);

    syncScroll();
    window.addEventListener('scroll', syncScroll, { passive: true });
    return () => window.removeEventListener('scroll', syncScroll);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
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
        {sidebarOpen ? <HiOutlineXMark className="sidebar-toggle-icon" /> : <HiOutlineBars3 className="sidebar-toggle-icon" />}
      </button>
      <div className="dashboard-topbar-title">{title}</div>
      <div className="dashboard-topbar-actions">
        <div className="dashboard-topbar-notifications" aria-label="Notifications">
          {notifications}
        </div>
        <div className="dashboard-topbar-profile" ref={menuRef}>
          <button
            type="button"
            className="dashboard-topbar-profile-button"
            aria-label={`Open profile menu for ${userName || 'signed in user'}`}
            aria-expanded={menuOpen}
            title={`${userName || 'Signed in user'} · ${userRole || 'user'}`}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <HiOutlineUserCircle className="dashboard-topbar-profile-icon" />
          </button>
          {menuOpen && (
            <div className="dashboard-topbar-menu" role="menu" aria-label="Profile menu">
              <button type="button" className="dashboard-topbar-menu-item" onClick={() => { setMenuOpen(false); onNavigate?.('account'); }} role="menuitem">
                <HiOutlineUserCircle />
                <span>Profile</span>
              </button>
              <button type="button" className="dashboard-topbar-menu-item" onClick={() => { setMenuOpen(false); onNavigate?.('settings'); }} role="menuitem">
                <HiOutlineCog6Tooth />
                <span>Settings</span>
              </button>
              <button type="button" className="dashboard-topbar-menu-item danger" onClick={() => { setMenuOpen(false); onLogout?.(); }} role="menuitem">
                <HiOutlineArrowRightOnRectangle />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
