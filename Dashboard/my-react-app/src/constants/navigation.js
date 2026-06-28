import {
  HiOutlineBanknotes,
  HiOutlineClipboardDocumentList,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineHome,
  HiOutlineKey,
  HiOutlineShieldCheck,
  HiOutlineShoppingCart,
  HiOutlineSquares2X2,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';

const baseNavigation = [
  { view: 'overview', label: 'Overview', icon: HiOutlineSquares2X2, roles: ['admin'] },
  { view: 'list', label: 'Products', icon: HiOutlineCube, roles: ['admin', 'user'] },
  { view: 'cart', label: 'Cart', icon: HiOutlineShoppingCart, roles: ['user'] },
  { view: 'orders', label: 'Orders', icon: HiOutlineClipboardDocumentList, roles: ['admin', 'user'] },
  { view: 'custom-invoice', label: 'Custom Invoice', icon: HiOutlineDocumentText, roles: ['admin'] },
  { view: 'settings/invoice-designer', label: 'Invoice Designer', icon: HiOutlineDocumentText, roles: ['admin'] },
  { view: 'stock', label: 'Stock', icon: HiOutlineBanknotes, roles: ['admin'] },
  { view: 'employees', label: 'Employees', icon: HiOutlineUsers, roles: ['admin'] },
  { view: 'account', label: 'Account', icon: HiOutlineKey, roles: ['admin', 'user'] },
  { view: 'settings', label: 'Settings', icon: HiOutlineCog6Tooth, roles: ['admin'] },
];

export const getNavigationItems = ({ role, cartCount = 0 }) => {
  const resolvedRole = role === 'admin' ? 'admin' : 'user';

  return baseNavigation
    .filter((item) => item.roles.includes(resolvedRole))
    .map((item) => ({
      ...item,
      label: item.view === 'cart' && cartCount > 0 ? `${item.label} (${cartCount})` : item.label,
    }));
};

export const dashboardHomeView = (role) => (role === 'admin' ? 'overview' : 'list');

export const dashboardNavigationMark = HiOutlineHome;
