import { useEffect, useState } from 'react';
import Auth from './Auth';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import Cart from './Cart';
import Orders from './Orders';
import AdminOverview from './AdminOverview';
import StockManager from './StockManager';
import EmployeeManager from './EmployeeManager';
import api from '../api/client';

const decodeToken = (token) => {
  try {
    if (!token) return null;
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const existingToken = localStorage.getItem('token');
  const [isLoggedIn, setIsLoggedIn] = useState(!!existingToken);
  const [session, setSession] = useState(() => decodeToken(existingToken));
  const userRole = session?.role || null;
  const permissions = session?.permissions || {};
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || (userRole === 'admin' ? 'overview' : 'list');
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const canManageProducts = userRole === 'admin' || permissions.can_create_product || permissions.can_update_product || permissions.can_delete_product;
  const canManageStock = userRole === 'admin' || permissions.can_manage_stock;
  const canManageEmployees = userRole === 'admin' || permissions.can_manage_employees;
  const isAdmin = userRole === 'admin';

  const navItems = [
    isAdmin ? { view: 'overview', label: 'Overview' } : null,
    { view: 'list', label: 'Products' },
    !isAdmin ? { view: 'cart', label: `Cart${cartCount > 0 ? ` (${cartCount})` : ''}` } : null,
    { view: 'orders', label: 'Orders' },
    isAdmin ? { view: 'stock', label: 'Stock' } : null,
    isAdmin ? { view: 'employee-records', label: 'Employees' } : null,
    isAdmin ? { view: 'employee-permissions', label: 'Permissions' } : null,
    isAdmin ? { view: 'employee-salary', label: 'Salary' } : null,
  ].filter(Boolean);

  const handleViewChange = (view) => {
    setCurrentView(view);
    localStorage.setItem('currentView', view);
  };

  const handleLogin = () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    setIsLoggedIn(true);
    const nextSession = decodeToken(token);
    setSession(nextSession);
    const allowedInitialView = nextSession?.role === 'admin' ? 'overview' : 'list';
    setCurrentView(allowedInitialView);
    localStorage.setItem('currentView', allowedInitialView);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentView');
    setIsLoggedIn(false);
    setSession(null);
    setCurrentView('list');
    setEditingProduct(null);
    setCartCount(0);
  };

  const refreshCartCount = async () => {
    if (isAdmin) {
      setCartCount(0);
      return;
    }

    try {
      const response = await api.get('/cartInfo');
      const items = Array.isArray(response.data?.data) ? response.data.data : [];
      const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      setCartCount(totalItems);
    } catch {
      setCartCount(0);
    }
  };

  const handleEdit = (product) => {
    if (!canManageProducts) return;
    setEditingProduct(product);
    setCurrentView('form');
  };

  const handleSave = () => {
    handleViewChange('list');
    setEditingProduct(null);
  };

  const handleCancel = () => {
    handleViewChange('list');
    setEditingProduct(null);
  };

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

  const visibleViews = isAdmin
    ? ['overview', 'list', 'form', 'orders', 'stock', 'employee-records', 'employee-permissions', 'employee-salary']
    : ['list', 'cart', 'orders'];

  useEffect(() => {
    if (!visibleViews.includes(currentView)) {
      const fallbackView = isAdmin ? 'overview' : 'list';
      setCurrentView(fallbackView);
      localStorage.setItem('currentView', fallbackView);
    }
  }, [currentView, isAdmin]);

  useEffect(() => {
    refreshCartCount();
  }, [isAdmin, isLoggedIn]);

  return (
    <div className={`dashboard-shell dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <button type="button" className="sidebar-brand" onClick={() => handleViewChange(isAdmin ? 'overview' : 'list')}>
            Pearry's Dashboard
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`sidebar-link ${currentView === item.view ? 'active' : ''}`}
              onClick={() => handleViewChange(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-session">
            <div className="sidebar-session-name">{session?.name || 'Signed in user'}</div>
            <div className="sidebar-session-role">Role: {userRole || 'unknown'}</div>
          </div>
          <button type="button" className="btn btn-outline-light w-100" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="sidebar-toggle topbar-toggle"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="dashboard-topbar-title">
            {isAdmin ? 'Admin workspace' : 'Shopping workspace'}
          </div>
          <div className="dashboard-topbar-meta">
            {session?.name ? `${session.name} · ` : ''}Role: {userRole || 'unknown'}
          </div>
        </header>

        <main className="dashboard-content">
          {currentView === 'overview' ? (
            <AdminOverview onNavigate={handleViewChange} />
          ) : currentView === 'list' ? (
            <ProductList
              onEdit={handleEdit}
              canManageProducts={canManageProducts}
              onCartChange={refreshCartCount}
            />
          ) : currentView === 'form' ? (
            <ProductForm
              key={editingProduct?.id || 'new'}
              product={editingProduct}
              canManageProducts={canManageProducts}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : currentView === 'cart' ? (
            <Cart onNavigate={handleViewChange} onCartChange={refreshCartCount} />
          ) : currentView === 'orders' ? (
            <Orders onNavigate={handleViewChange} userRole={userRole} />
          ) : currentView === 'stock' ? (
            <StockManager />
          ) : currentView === 'employee-records' ? (
            <EmployeeManager mode="records" />
          ) : currentView === 'employee-permissions' ? (
            <EmployeeManager mode="permissions" />
          ) : currentView === 'employee-salary' ? (
            <EmployeeManager mode="salary" />
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;