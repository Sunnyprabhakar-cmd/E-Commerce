import { useState } from 'react';
import Auth from './Auth';
import ProductList from './ProductList';
import ProductForm from './ProductForm';

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
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'form'
  const [editingProduct, setEditingProduct] = useState(null);

  const handleLogin = () => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(true);
    setUserRole(getRoleFromToken(token));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
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
    setCurrentView('list');
    setEditingProduct(null);
  };

  const handleCancel = () => {
    setCurrentView('list');
    setEditingProduct(null);
  };

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <a className="navbar-brand" href="#">Product Dashboard</a>
          <span className="navbar-text text-light me-3">
            Role: {userRole || 'unknown'}
          </span>
          <button
            className="btn btn-outline-light"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      {currentView === 'list' ? (
        <ProductList onEdit={handleEdit} canManageProducts={userRole === 'admin'} />
      ) : (
        <ProductForm
          key={editingProduct?.id || 'new'}
          product={editingProduct}
          canManageProducts={userRole === 'admin'}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default Dashboard;