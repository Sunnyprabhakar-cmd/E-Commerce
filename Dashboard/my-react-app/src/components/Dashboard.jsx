import { useEffect, useMemo, useState } from 'react';
import Auth from './Auth';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import Cart from './Cart';
import Orders from './Orders';
import AdminOverview from './AdminOverview';
import StockManager from './StockManager';
import EmployeeManager from './EmployeeManager';
import CustomInvoice from './CustomInvoice';
import InvoiceDesigner from './InvoiceDesigner';
import SettingsCenter from './SettingsCenter';
import AccountSecurity from './AccountSecurity';
import { fetchCartInfo } from '../services/cartService';
import DashboardLayout from './layout/DashboardLayout';
import { dashboardHomeView, getNavigationItems } from '../constants/navigation';
import { refreshAuthToken } from '../services/authService';
import LoadingSpinner from './common/LoadingSpinner';

const getInitialSidebarState = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.innerWidth >= 1024;
};

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

const isJwtExpired = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded?.exp) {
      return false;
    }
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
};

const Dashboard = () => {
  const existingToken = localStorage.getItem('token');
  const [isLoggedIn, setIsLoggedIn] = useState(!!existingToken);
  const [authReady, setAuthReady] = useState(!existingToken);
  const [session, setSession] = useState(() => decodeToken(existingToken));
  const userRole = session?.role || null;
  const permissions = session?.permissions || {};
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || dashboardHomeView(userRole);
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);

  const canManageProducts = userRole === 'admin' || permissions.can_create_product || permissions.can_update_product || permissions.can_delete_product;
  const isAdmin = userRole === 'admin';

  const navItems = useMemo(() => getNavigationItems({ role: userRole, cartCount }), [cartCount, userRole]);

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
    const allowedInitialView = dashboardHomeView(nextSession?.role);
    setCurrentView(allowedInitialView);
    localStorage.setItem('currentView', allowedInitialView);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentView');
    setIsLoggedIn(false);
    setSession(null);
    setCurrentView(dashboardHomeView(null));
    setEditingProduct(null);
    setCartCount(0);
  };

  const refreshCartCount = async () => {
    if (isAdmin) {
      setCartCount(0);
      return;
    }

    try {
      const response = await fetchCartInfo();
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

  const visibleViews = isAdmin
    ? ['overview', 'list', 'form', 'orders', 'custom-invoice', 'settings/invoice-designer', 'stock', 'employees', 'account', 'settings']
    : ['list', 'cart', 'orders', 'account'];

  useEffect(() => {
    if (!visibleViews.includes(currentView)) {
      const fallbackView = dashboardHomeView(userRole);
      setCurrentView(fallbackView);
      localStorage.setItem('currentView', fallbackView);
    }
  }, [currentView, isAdmin]);

  useEffect(() => {
    if (!authReady || !isLoggedIn) {
      return;
    }
    refreshCartCount();
  }, [authReady, isAdmin, isLoggedIn]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      if (!existingToken) {
        setAuthReady(true);
        return;
      }

      if (!isJwtExpired(existingToken)) {
        setAuthReady(true);
        return;
      }

      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        handleLogout();
        setAuthReady(true);
        return;
      }

      try {
        const response = await refreshAuthToken({ refreshToken: refreshTokenValue });
        const nextToken = response.data?.token;
        if (!nextToken) {
          throw new Error('Missing refreshed token');
        }
        localStorage.setItem('token', nextToken);
        const nextSession = decodeToken(nextToken);
        if (!cancelled) {
          setSession(nextSession);
          setIsLoggedIn(true);
          setCurrentView(dashboardHomeView(nextSession?.role));
          localStorage.setItem('currentView', dashboardHomeView(nextSession?.role));
        }
      } catch {
        if (!cancelled) {
          handleLogout();
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
    // Existing token is intentionally read once on mount for bootstrapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const syncSidebar = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    syncSidebar();
    window.addEventListener('resize', syncSidebar, { passive: true });
    return () => window.removeEventListener('resize', syncSidebar);
  }, []);

  useEffect(() => {
    const handleOpenInvoiceDesigner = () => {
      handleViewChange('settings/invoice-designer');
    };

    window.addEventListener('erp:open-invoice-designer', handleOpenInvoiceDesigner);
    return () => {
      window.removeEventListener('erp:open-invoice-designer', handleOpenInvoiceDesigner);
    };
  }, []);

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

  if (!authReady) {
    return <LoadingSpinner className="mt-5" label="Preparing your session..." />;
  }

  const title = isAdmin ? 'Admin workspace' : 'Shopping workspace';

  return (
    <DashboardLayout
      sidebarOpen={sidebarOpen}
      navItems={navItems}
      currentView={currentView}
      session={session}
      userRole={userRole}
      title={title}
      onNavigate={handleViewChange}
      onLogout={handleLogout}
      onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      onHome={() => handleViewChange(dashboardHomeView(userRole))}
    >
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
      ) : currentView === 'custom-invoice' ? (
        <CustomInvoice />
      ) : currentView === 'settings/invoice-designer' ? (
        <InvoiceDesigner />
      ) : currentView === 'stock' ? (
        <StockManager />
      ) : currentView === 'employees' ? (
        <EmployeeManager mode="records" />
      ) : currentView === 'account' ? (
        <AccountSecurity session={session} />
      ) : currentView === 'settings' ? (
        <SettingsCenter />
      ) : null}
    </DashboardLayout>
  );
};

export default Dashboard;