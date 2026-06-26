import { useEffect, useState } from 'react';
import Auth from './Auth';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import Cart from './Cart';
import Orders from './Orders';
import AdminOverview from './AdminOverview';
import StockManager from './StockManager';
import EmployeeManager from './EmployeeManager';

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

  const canManageProducts = userRole === 'admin' || permissions.can_create_product || permissions.can_update_product || permissions.can_delete_product;
  const canManageStock = userRole === 'admin' || permissions.can_manage_stock;
  const canManageEmployees = userRole === 'admin' || permissions.can_manage_employees;
  const isAdmin = userRole === 'admin';

  const handleViewChange = (view) => {
    setCurrentView(view);
    localStorage.setItem('currentView', view);
  };

  const handleLogin = () => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(true);
    const nextSession = decodeToken(token);
    setSession(nextSession);
    const allowedInitialView = nextSession?.role === 'admin' ? 'overview' : 'list';
    setCurrentView(allowedInitialView);
    localStorage.setItem('currentView', allowedInitialView);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentView');
    setIsLoggedIn(false);
    setSession(null);
    setCurrentView('list');
    setEditingProduct(null);
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
    ? ['overview', 'list', 'form', 'orders', 'stock', 'employees']
    : ['list', 'cart', 'orders'];

  useEffect(() => {
    if (!visibleViews.includes(currentView)) {
      const fallbackView = isAdmin ? 'overview' : 'list';
      setCurrentView(fallbackView);
      localStorage.setItem('currentView', fallbackView);
    }
  }, [currentView, isAdmin]);

  return (
    <div className="dashboard-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div className="container-fluid">
          <button className="navbar-brand btn btn-link text-white text-decoration-none" type="button" onClick={() => handleViewChange(isAdmin ? 'overview' : 'list')}>
            Pearry's Dashboard
          </button>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              {isAdmin && (
                <li className="nav-item">
                  <button
                    className={`btn nav-link ${currentView === 'overview' ? 'active' : ''}`}
                    onClick={() => handleViewChange('overview')}
                  >
                    Overview
                  </button>
                </li>
              )}
              <li className="nav-item">
                <button
                  className={`btn nav-link ${currentView === 'list' ? 'active' : ''}`}
                  onClick={() => handleViewChange('list')}
                >
                  Products
                </button>
              </li>
              {!isAdmin && (
                <li className="nav-item">
                  <button
                    className={`btn nav-link ${currentView === 'cart' ? 'active' : ''}`}
                    onClick={() => handleViewChange('cart')}
                  >
                    🛒 Cart
                  </button>
                </li>
              )}
              <li className="nav-item">
                <button
                  className={`btn nav-link ${currentView === 'orders' ? 'active' : ''}`}
                  onClick={() => handleViewChange('orders')}
                >
                  Orders
                </button>
              </li>
              {isAdmin && (
                <li className="nav-item">
                  <button
                    className={`btn nav-link ${currentView === 'stock' ? 'active' : ''}`}
                    onClick={() => handleViewChange('stock')}
                  >
                    Stock
                  </button>
                </li>
              )}
              {isAdmin && (
                <li className="nav-item">
                  <button
                    className={`btn nav-link ${currentView === 'employees' ? 'active' : ''}`}
                    onClick={() => handleViewChange('employees')}
                  >
                    Employees
                  </button>
                </li>
              )}
              <li className="nav-item">
                <span className="navbar-text text-light me-3">
                  {session?.name ? `${session.name} · ` : ''}Role: {userRole || 'unknown'}
                </span>
              </li>
              <li className="nav-item">
                <button
                  className="btn btn-outline-light"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {currentView === 'overview' ? (
        <AdminOverview onNavigate={handleViewChange} />
      ) : currentView === 'list' ? (
        <ProductList onEdit={handleEdit} canManageProducts={canManageProducts} />
      ) : currentView === 'form' ? (
        <ProductForm
          key={editingProduct?.id || 'new'}
          product={editingProduct}
          canManageProducts={canManageProducts}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : currentView === 'cart' ? (
        <Cart onNavigate={handleViewChange} />
      ) : currentView === 'orders' ? (
        <Orders onNavigate={handleViewChange} userRole={userRole} />
      ) : currentView === 'stock' ? (
        <StockManager />
      ) : currentView === 'employees' ? (
        <EmployeeManager />
      ) : null}
    </div>
  );
};

export default Dashboard;