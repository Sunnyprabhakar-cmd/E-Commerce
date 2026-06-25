import { useState } from 'react';
import Auth from './Auth';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import Cart from './Cart';
import Orders from './Orders';
import Wallet from './Wallet';

const getRoleFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.role || null;
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const existingToken = localStorage.getItem('token');
  const [isLoggedIn, setIsLoggedIn] = useState(!!existingToken);
  const [userRole, setUserRole] = useState(getRoleFromToken(existingToken));
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'list';
  });
  const [editingProduct, setEditingProduct] = useState(null);

  const handleViewChange = (view) => {
    setCurrentView(view);
    localStorage.setItem('currentView', view);
  };

  const handleLogin = () => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(true);
    setUserRole(getRoleFromToken(token));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentView');
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentView('list');
    setEditingProduct(null);
  };

  const handleEdit = (product) => {
    if (userRole !== 'admin') return;
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

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">Product Dashboard</a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <button
                  className={`btn nav-link ${currentView === 'list' ? 'active' : ''}`}
                  onClick={() => handleViewChange('list')}
                >
                  Products
                </button>
              </li>
              {userRole !== 'admin' && (
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
              {userRole !== 'admin' && (
                <li className="nav-item">
                  <button
                    className={`btn nav-link ${currentView === 'wallet' ? 'active' : ''}`}
                    onClick={() => handleViewChange('wallet')}
                  >
                    Wallet
                  </button>
                </li>
              )}
              <li className="nav-item">
                <span className="navbar-text text-light me-3">
                  Role: {userRole || 'unknown'}
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

      {currentView === 'list' ? (
        <ProductList onEdit={handleEdit} canManageProducts={userRole === 'admin'} />
      ) : currentView === 'form' ? (
        <ProductForm
          key={editingProduct?.id || 'new'}
          product={editingProduct}
          canManageProducts={userRole === 'admin'}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : currentView === 'cart' ? (
        <Cart onNavigate={handleViewChange} />
      ) : currentView === 'orders' ? (
        <Orders onNavigate={handleViewChange} userRole={userRole} />
      ) : currentView === 'wallet' ? (
        <Wallet onNavigate={handleViewChange} />
      ) : null}
    </div>
  );
};

export default Dashboard;