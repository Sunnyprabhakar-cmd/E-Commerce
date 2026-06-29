import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Auth from './Auth';
import { fetchCartInfo } from '../services/cartService';
import DashboardLayout from './layout/DashboardLayout';
import { dashboardHomeView, dashboardViewLabelMap, getNavigationItems } from '../constants/navigation';
import { refreshAuthToken } from '../services/authService';
import LoadingSpinner from './common/LoadingSpinner';

const ProductList = lazy(() => import('./ProductList'));
const ProductForm = lazy(() => import('./ProductForm'));
const Cart = lazy(() => import('./Cart'));
const Orders = lazy(() => import('./Orders'));
const OrderDetailsPage = lazy(() => import('./OrderDetailsPage'));
const Purchases = lazy(() => import('./Purchases'));
const AdminOverview = lazy(() => import('./AdminOverview'));
const StockManager = lazy(() => import('./StockManager'));
const EmployeeManager = lazy(() => import('./EmployeeManager'));
const CustomInvoice = lazy(() => import('./CustomInvoice'));
const SettingsCenter = lazy(() => import('./SettingsCenter'));
const AccountSecurity = lazy(() => import('./AccountSecurity'));

const getInitialSidebarState = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.innerWidth >= 1024;
};

const getInitialView = (role) => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view');
    if (requestedView === 'order-details') {
      return 'order-details';
    }
  }
  return localStorage.getItem('currentView') || dashboardHomeView(role);
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

const Dashboard = ({ onLogoutSuccess }) => {
  const existingToken = localStorage.getItem('token');
  const [isLoggedIn, setIsLoggedIn] = useState(!!existingToken);
  const [authReady, setAuthReady] = useState(!existingToken);
  const [session, setSession] = useState(() => decodeToken(existingToken));
  const userRole = session?.role || null;
  const permissions = session?.permissions || {};
  const [currentView, setCurrentView] = useState(() => {
    return getInitialView(userRole);
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

  const handleLogout = (showSuccess = false) => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentView');
    setIsLoggedIn(false);
    setSession(null);
    setCurrentView(dashboardHomeView(null));
    setEditingProduct(null);
    setCartCount(0);

    if (showSuccess) {
      onLogoutSuccess?.();
    }
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
    ? ['overview', 'list', 'form', 'orders', 'order-details', 'purchases', 'custom-invoice', 'stock', 'employees', 'account', 'settings']
    : ['list', 'cart', 'orders', 'order-details', 'account'];

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
        handleLogout(false);
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
          handleLogout(false);
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
      localStorage.setItem('customInvoiceTab', 'designer');
      handleViewChange('custom-invoice');
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

  const title = currentView === 'order-details'
    ? 'Order details workspace'
    : dashboardViewLabelMap[currentView] || (isAdmin ? 'Admin workspace' : 'Shopping workspace');

  return (
    <DashboardLayout
      sidebarOpen={sidebarOpen}
      navItems={navItems}
      currentView={currentView}
      session={session}
      userRole={userRole}
      title={title}
      onNavigate={handleViewChange}
      onLogout={() => handleLogout(true)}
      onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      onHome={() => handleViewChange(dashboardHomeView(userRole))}
    >
      {currentView === 'overview' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading overview..." />}>
          <AdminOverview onNavigate={handleViewChange} />
        </Suspense>
      ) : currentView === 'list' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading products..." />}>
          <ProductList
            onEdit={handleEdit}
            canManageProducts={canManageProducts}
            onCartChange={refreshCartCount}
          />
        </Suspense>
      ) : currentView === 'form' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading product form..." />}>
          <ProductForm
            key={editingProduct?.id || 'new'}
            product={editingProduct}
            canManageProducts={canManageProducts}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </Suspense>
      ) : currentView === 'cart' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading cart..." />}>
          <Cart onNavigate={handleViewChange} onCartChange={refreshCartCount} />
        </Suspense>
      ) : currentView === 'orders' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading orders..." />}>
          <Orders onNavigate={handleViewChange} userRole={userRole} />
        </Suspense>
      ) : currentView === 'order-details' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading order workspace..." />}>
          <OrderDetailsPage onNavigate={handleViewChange} />
        </Suspense>
      ) : currentView === 'purchases' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading purchases..." />}>
          <Purchases onNavigate={handleViewChange} userRole={userRole} session={session} />
        </Suspense>
      ) : currentView === 'custom-invoice' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading invoice tools..." />}>
          <CustomInvoice />
        </Suspense>
      ) : currentView === 'stock' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading stock manager..." />}>
          <StockManager />
        </Suspense>
      ) : currentView === 'employees' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading employees..." />}>
          <EmployeeManager mode="records" />
        </Suspense>
      ) : currentView === 'account' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading account security..." />}>
          <AccountSecurity session={session} />
        </Suspense>
      ) : currentView === 'settings' ? (
        <Suspense fallback={<LoadingSpinner className="mt-4" label="Loading settings..." />}>
          <SettingsCenter />
        </Suspense>
      ) : null}
    </DashboardLayout>
  );
};

export default Dashboard;