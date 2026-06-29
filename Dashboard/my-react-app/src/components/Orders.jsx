import { Fragment, useEffect, useMemo, useState } from 'react';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
import Toolbar from './common/Toolbar';
import ToolbarButton from './common/ToolbarButton';
import OverflowMenu from './common/OverflowMenu';
import {
  buildInvoiceAssets,
  createGroupInvoiceMarkup,
  createInvoiceMarkup,
  downloadPdfFromHtml,
  getDisplayRemaining,
  getInvoiceNumber,
  getInvoiceTitle,
  getOrderProductLabel,
  getPaymentStatus,
  openPreviewWindow,
} from '../utils/invoiceUtils';
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowPath,
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowsUpDown,
  HiOutlinePrinter,
} from 'react-icons/hi2';
import EmptyState from './common/EmptyState';
import AppCard from './common/AppCard';
import ExportMenu from './common/ExportMenu';
import FilterPanel from './common/FilterPanel';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import PageContainer from './common/PageContainer';
import SearchBar from './common/SearchBar';
import SortMenu from './common/SortMenu';
import {
  addProductToCart as addOrderProductToCart,
  adminOrderAction,
  cancelOrder as cancelOrderService,
  fetchOrderActions as fetchOrderActionsService,
  fetchOrders as fetchOrdersService,
} from '../services/orderService';

const getOrderKey = (order) => order.order_id || order.tracking_id || `${order.product_id}-${order.user_id}`;

const getDisplayName = (value) => {
  const text = String(value || '').trim();
  if (!text || /^\d+$/.test(text)) {
    return 'Unknown User';
  }
  return text;
};

const getHandledByName = (order) => getDisplayName(order.handled_by_name || order.last_action_by_user_name);

const getRoleCapabilities = (role) => {
  const normalized = String(role || '').toLowerCase();
  return {
    canView: true,
    canEditQuantity: normalized === 'admin' || normalized === 'manager',
    canApplyDiscount: normalized === 'admin' || normalized === 'manager',
    canEditPayment: normalized === 'admin' || normalized === 'accountant' || normalized === 'manager',
    canViewHistory: normalized === 'admin' || normalized === 'manager' || normalized === 'accountant',
    canCancel: normalized === 'admin' || normalized === 'manager',
    canManageInvoices: normalized === 'admin' || normalized === 'accountant' || normalized === 'manager',
  };
};

const buildOrderDraft = (order) => ({
  quantity: String(Number(order.quantity || 1)),
  discountMode: 'percent',
  discountValue: String(Number(order.discount_percentage || 0)),
  paymentAmount: '',
  paymentMode: order.payment_mode || 'cash',
  showHistory: false,
});

const getOrderStockLimit = (order) => Number(order.stock_quantity ?? order.available_stock ?? order.stock ?? order.product_stock ?? 0);

const getStatusChipClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'order-status-chip is-paid';
  if (normalized === 'cancelled') return 'order-status-chip is-cancelled';
  if (normalized === 'processing') return 'order-status-chip is-processing';
  if (normalized === 'partial' || normalized === 'partial paid') return 'order-status-chip is-partial';
  return 'order-status-chip is-pending';
};

const Orders = ({ onNavigate, userRole }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortField, setSortField] = useState('order_id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderScope, setOrderScope] = useState('active');
  const [paymentInputs, setPaymentInputs] = useState({});
  const [actionSelections, setActionSelections] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showOrderSearch, setShowOrderSearch] = useState(false);
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  const [showOrderSortMenu, setShowOrderSortMenu] = useState(false);
  const [showOrderExportMenu, setShowOrderExportMenu] = useState(false);
  const [showOrderOverflowMenu, setShowOrderOverflowMenu] = useState(false);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [activeCell, setActiveCell] = useState(null);
  

  const adminView = userRole === 'admin';
  const roleCapabilities = getRoleCapabilities(userRole);
  const fetchEndpoint = adminView ? '/orders' : '/orderDetail';

  const closeOrderPopups = () => {
    setShowOrderSearch(false);
    setShowOrderFilters(false);
    setShowOrderSortMenu(false);
    setShowOrderExportMenu(false);
    setShowOrderOverflowMenu(false);
  };

  const openOrderPopup = (popupName) => {
    setShowOrderSearch(popupName === 'search');
    setShowOrderFilters(popupName === 'filter');
    setShowOrderSortMenu(popupName === 'sort');
    setShowOrderExportMenu(popupName === 'export');
    setShowOrderOverflowMenu(popupName === 'overflow');
  };

  const toggleOrderPopup = (popupName) => (nextOpen) => {
    if (nextOpen) {
      openOrderPopup(popupName);
      return;
    }
    closeOrderPopups();
  };

  const openOrderPopupFromMenu = (popupName) => {
    window.setTimeout(() => openOrderPopup(popupName), 0);
  };

  const updateOrderDraft = (orderKey, field, value) => {
    setOrderDrafts((prev) => ({
      ...prev,
      [orderKey]: {
        ...prev[orderKey],
        [field]: value,
      },
    }));
  };

  const startCellEdit = (order, field) => {
    const key = getOrderKey(order);
    setActiveCell({ key, field });
    setOrderDrafts((prev) => ({
      ...prev,
      [key]: prev[key] || buildOrderDraft(order),
    }));
  };

  const closeCellEdit = (order) => {
    const key = getOrderKey(order);
    setActiveCell(null);
    setOrderDrafts((prev) => ({
      ...prev,
      [key]: buildOrderDraft(order),
    }));
  };

  const ensureRowDraft = (order) => {
    const key = getOrderKey(order);
    return orderDrafts[key] || buildOrderDraft(order);
  };

  const applyQuantityDraft = async (order) => {
    const key = getOrderKey(order);
    const draft = ensureRowDraft(order);
    const desired = Math.max(1, Number(draft.quantity || 1));
    const current = Math.max(1, Number(order.quantity || 1));
    const stockLimit = getOrderStockLimit(order);
    if (stockLimit > 0 && desired > stockLimit) {
      setMessage(`Quantity cannot exceed stock (${stockLimit})`);
      return;
    }
    const delta = desired - current;
    if (delta === 0) {
      return;
    }
    const steps = Math.abs(delta);
    const direction = delta > 0 ? 1 : -1;
    for (let index = 0; index < steps; index += 1) {
      await handleAdjustQuantity(order, direction);
    }
    setOrderDrafts((prev) => ({
      ...prev,
      [key]: { ...draft, quantity: String(desired) },
    }));
  };

  const handleQuantityKeyDown = async (event, order) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await applyQuantityDraft(order);
      setActiveCell(null);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCellEdit(order);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentValue = Math.max(1, Number(ensureRowDraft(order).quantity || 1));
      const stockLimit = getOrderStockLimit(order);
      const nextValue = event.key === 'ArrowUp' ? currentValue + 1 : Math.max(1, currentValue - 1);
      if (stockLimit > 0 && nextValue > stockLimit) {
        setMessage(`Quantity cannot exceed stock (${stockLimit})`);
        return;
      }
      updateOrderDraft(getOrderKey(order), 'quantity', String(nextValue));
    }
  };

  const commitDiscountDraft = async (order) => {
    const key = getOrderKey(order);
    const draft = ensureRowDraft(order);
    const value = Number(draft.discountValue || 0);
    if (draft.discountMode === 'percent') {
      if (value < 0 || value > 100) {
        setMessage('Enter a valid discount percentage between 0 and 100');
        return;
      }
      await handleApplyOrderDiscount(order, value);
    } else {
      const currentTotal = Number(order.total_cost || 0);
      if (value < 0 || value > currentTotal) {
        setMessage('Enter a valid fixed discount');
        return;
      }
      const percent = currentTotal > 0 ? Math.min(100, Number(((value / currentTotal) * 100).toFixed(2))) : 0;
      await handleApplyOrderDiscount(order, percent);
    }
    setActiveCell(null);
    setOrderDrafts((prev) => ({
      ...prev,
      [key]: { ...draft, discountValue: String(value) },
    }));
  };

  const commitPaymentDraft = async (order) => {
    const key = getOrderKey(order);
    const draft = ensureRowDraft(order);
    const amount = Number(draft.paymentAmount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid payment amount');
      return;
    }
    try {
      await adminOrderAction({
        order_id: order.order_id || order.tracking_id || order.order_group_id || order.groupId,
        action: 'collect_payment',
        amount_received: amount,
        payment_mode: draft.paymentMode || 'cash',
        payment_reference: null,
        payment_notes: `Inline payment update for order ${order.order_id || order.tracking_id}`,
      });
      setMessage('Payment updated successfully');
      setOrderDrafts((prev) => ({ ...prev, [key]: { ...draft, paymentAmount: '' } }));
      setActiveCell(null);
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording payment';
      setMessage(errorMsg);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetchOrdersService(fetchEndpoint);
      const items = Array.isArray(response.data?.orders) ? response.data.orders : [];
      setOrders(items);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error loading orders';
      setMessage(errorMsg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      await cancelOrderService({
        product_id: order.product_id,
        order_id: order.order_id || order.tracking_id || null
      });
      setMessage('Order cancelled and wallet refunded successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error cancelling order';
      setMessage(errorMsg);
    }
  };

  const handleReorderOrder = async (order) => {
    try {
      await addOrderProductToCart({ product_id: order.product_id, quantity: order.quantity || 1 });
      setMessage('Cancelled order added to cart for reorder');
      onNavigate && onNavigate('cart');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error reordering cancelled item';
      setMessage(errorMsg);
    }
  };

  const handleReorderGroup = async (group) => {
    try {
      for (const order of group.orders.filter((o) => o.status === 'cancelled')) {
        await addOrderProductToCart({ product_id: order.product_id, quantity: order.quantity || 1 });
      }
      setMessage('Cancelled group items added to cart for reorder');
      onNavigate && onNavigate('cart');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error reordering cancelled group';
      setMessage(errorMsg);
    }
  };

  const handleAdminOrderAction = async (order, action) => {
    try {
      const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
      const response = await adminOrderAction({
        order_id: orderId,
        action,
      });
      setMessage(response.data?.message || `Order ${action}d successfully`);
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || `Error ${action}ing order`;
      setMessage(errorMsg);
    }
  };

  const setPaymentInput = (orderId, field, value) => {
    setPaymentInputs((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const setActionSelection = (orderId, value) => {
    setActionSelections((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  };

  const resetOrderFilters = () => {
    setStatusFilter('all');
    setCustomerFilter('');
    setSortField('order_id');
    setSortDirection('desc');
    setOrderDateFilter('');
    setOrderScope('active');
    setShowOrderFilters(false);
  };

  const handleApplyAction = async (order) => {
    const key = getOrderKey(order);
    const selection = actionSelections[key];
    if (!selection) {
      setMessage('Select an admin action first');
      return;
    }
    await handleAdminOrderAction(order, selection);
  };

  const [orderActions, setOrderActions] = useState({});

  const handleCollectPayment = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid payment amount');
      return;
    }
    try {
      const response = await adminOrderAction({
        order_id: orderId,
        action: 'collect_payment',
        amount_received: amount,
        payment_mode: inputs.mode || 'cash',
        payment_reference: inputs.reference || null,
        payment_notes: inputs.notes || `Partial payment for order ${order.order_id || order.tracking_id}`,
      });
      setMessage(response.data?.message || 'Payment updated successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: {} }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording payment';
      setMessage(errorMsg);
    }
  };

  const handleAdjustQuantity = async (order, delta) => {
    try {
      const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
      const response = await adminOrderAction({
        order_id: orderId,
        action: delta > 0 ? 'increase_qty' : 'decrease_qty',
      });
      setMessage(response.data?.message || 'Quantity updated successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error updating quantity';
      setMessage(errorMsg);
    }
  };

  const handleApplyOrderDiscount = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const discount = Number(inputs.discount || 0);
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      setMessage('Enter a valid discount percentage between 0 and 100');
      return;
    }
    try {
      const response = await adminOrderAction({
        order_id: orderId,
        action: 'apply_discount',
        discount_percentage: discount,
      });
      setMessage(response.data?.message || 'Discount applied successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: { ...prev[key], discount: '' } }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error applying discount';
      setMessage(errorMsg);
    }
  };

  const fetchOrderActionHistory = async (order) => {
    const orderId = order.order_id || order.tracking_id || order.order_group_id || order.groupId;
    if (!orderId) {
      return;
    }
    try {
      const response = await fetchOrderActionsService(orderId);
      setOrderActions((prev) => ({ ...prev, [orderId]: response.data?.actions || [] }));
    } catch (err) {
      console.warn('Unable to fetch order action history', err);
    }
  };

  const toggleOrderHistory = async (order) => {
    const orderId = order.order_id || order.tracking_id;
    if (!orderId) return;
    if (!orderActions[orderId]) {
      await fetchOrderActionHistory(order);
    }
    setOrderActions((prev) => ({ ...prev, [orderId]: prev[orderId] || [] }));
  };

  const handleGenerateGroupInvoice = async (group) => {
    const previewWindow = window.open('', '_blank', 'width=1280,height=1600');
    if (!previewWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    previewWindow.document.write('<!doctype html><html><head><title>Loading invoice...</title><style>body{font-family:Arial,sans-serif;padding:24px;text-align:center;}</style></head><body>Preparing invoice...</body></html>');
    try {
      const assets = await buildInvoiceAssets(group, true);
      const html = createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, true);
      await openPreviewWindow(html, getInvoiceTitle(group), previewWindow);
    } catch (error) {
      previewWindow.close();
      setMessage(error.message || 'Unable to open invoice window. Check popup settings.');
    }
  };

  const handleDownloadGroupInvoice = async (group) => {
    try {
      const assets = await buildInvoiceAssets(group, true);
      const html = createGroupInvoiceMarkup(group, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
    } catch (error) {
      setMessage(error.message || 'Unable to download invoice PDF');
    }
  };

  const handleOpenGroupDetails = async (group) => {
    if (!group?.groupId) {
      return;
    }
    toggleGroupExpansion(group.groupId);
  };

  const handleCancelGroup = async (group) => {
    try {
      await cancelOrderService({
        order_id: group.groupId,
      });
      setMessage('Group order cancelled successfully');
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error cancelling group order';
      setMessage(errorMsg);
    }
  };

  const handleCollectPaymentGroup = async (group) => {
    const key = group.groupId;
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid group payment amount');
      return;
    }
    try {
      const response = await adminOrderAction({
        order_id: group.groupId,
        action: 'collect_payment',
        amount_received: amount,
        payment_mode: inputs.mode || 'cash',
        payment_reference: inputs.reference || null,
        payment_notes: inputs.notes || `Partial payment for group ${group.groupId}`,
      });
      setMessage(response.data?.message || 'Group payment updated successfully');
      setPaymentInputs((prev) => ({ ...prev, [key]: {} }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording group payment';
      setMessage(errorMsg);
    }
  };

  const handleGenerateInvoice = async (order) => {
    const previewWindow = window.open('', '_blank', 'width=1280,height=1600');
    if (!previewWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    previewWindow.document.write('<!doctype html><html><head><title>Loading invoice...</title><style>body{font-family:Arial,sans-serif;padding:24px;text-align:center;}</style></head><body>Preparing invoice...</body></html>');
    try {
      const assets = await buildInvoiceAssets(order, false);
      const html = createInvoiceMarkup(order, assets.qrCodeDataUrl, true);
      await openPreviewWindow(html, getInvoiceTitle(order), previewWindow);
    } catch (error) {
      previewWindow.close();
      setMessage(error.message || 'Unable to open invoice window. Check popup settings.');
    }
  };

  const handleDownloadInvoice = async (order) => {
    try {
      const assets = await buildInvoiceAssets(order, false);
      const html = createInvoiceMarkup(order, assets.qrCodeDataUrl, false);
      await downloadPdfFromHtml(html, assets.fileName);
    } catch (error) {
      setMessage(error.message || 'Unable to download invoice PDF');
    }
  };

  const downloadFile = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportOrdersToCSV = () => {
    const headers = [
      'Order Group ID',
      'Invoice Number',
      'Order ID',
      'Product Name',
      'Product ID',
      'Customer',
      'Customer ID',
      'Quantity',
      'Unit Price',
      'Total Cost',
      'Status',
      'Payment Status',
      'Amount Paid',
      'Remaining',
      'Payment Mode',
      'Handled By',
    ];
    const rows = filteredOrders.map((order) => {
      const displayRemaining = getDisplayRemaining(order);
      return [ 
        getInvoiceNumber(order),
        order.order_id || order.tracking_id || '',
        getOrderProductLabel(order),
        order.product_id || '',
        order.customer_name || order.customer_email || '',
        order.user_id || '',
        order.quantity || 0,
        Number(order.product_price || 0).toFixed(2),
        Number(order.total_cost || 0).toFixed(2),
        order.status || '',
        getPaymentStatus(order),
        Number(order.amount_paid || 0).toFixed(2),
        displayRemaining.toFixed(2),
        order.payment_mode || '',
        getHandledByName(order),
      ];
    });
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('orders.csv', csvContent, 'text/csv;charset=utf-8;');
  };

  const exportOrdersToDoc = () => {
    const rows = filteredOrders.map((order) => {
      const displayRemaining = getDisplayRemaining(order);
      return `
        <tr>
          <td>${order.order_group_id || order.order_id || order.tracking_id || ''}</td>
          <td>${getInvoiceNumber(order)}</td>
          <td>${order.order_id || order.tracking_id || ''}</td>
          <td>${getOrderProductLabel(order)}</td>
          <td>${order.product_id || ''}</td>
          <td>${order.customer_name || order.customer_email || ''}</td>
          <td>${order.user_id || ''}</td>
          <td>${order.quantity || 0}</td>
          <td>${Number(order.product_price || 0).toFixed(2)}</td>
          <td>${Number(order.total_cost || 0).toFixed(2)}</td>
          <td>${order.status || ''}</td>
          <td>${getPaymentStatus(order)}</td>
          <td>${Number(order.amount_paid || 0).toFixed(2)}</td>
          <td>${displayRemaining.toFixed(2)}</td>
          <td>${order.payment_mode || ''}</td>
          <td>${getHandledByName(order)}</td>
        </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Export</title></head><body><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Order Group ID</th><th>Invoice Number</th><th>Order ID</th><th>Product Name</th><th>Product ID</th><th>Customer</th><th>Customer ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th><th>Status</th><th>Payment Status</th><th>Amount Paid</th><th>Remaining</th><th>Payment Mode</th><th>Handled By</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadFile('orders.doc', html, 'application/msword');
  };

  const printOrders = () => {
    window.print();
  };

  const exportMenuItems = [
    {
      label: 'Excel / CSV',
      icon: <HiOutlineArrowDownTray />,
      onClick: () => {
        setShowOrderExportMenu(false);
        exportOrdersToCSV();
      },
    },
    {
      label: 'Word',
      icon: <HiOutlineArrowDownTray />,
      onClick: () => {
        setShowOrderExportMenu(false);
        exportOrdersToDoc();
      },
    },
    {
      label: 'Print',
      icon: <HiOutlinePrinter />,
      onClick: () => {
        setShowOrderExportMenu(false);
        printOrders();
      },
    },
  ];

  useEffect(() => {
    fetchOrders();
  }, [userRole]);

  const filteredOrders = useMemo(() => {
    const normalizedCustomerFilter = customerFilter.trim().toLowerCase();
    const normalizedDateFilter = orderDateFilter.trim();

    return [...orders]
      .filter((order) => {
        const orderStatus = String(order.status || '').toLowerCase();
        const isCancelled = orderStatus === 'cancelled';

        if (orderScope === 'active' && isCancelled) {
          return false;
        }
        if (orderScope === 'cancelled' && !isCancelled) {
          return false;
        }

        if (statusFilter !== 'all') {
          const paymentStatus = getPaymentStatus(order).toLowerCase().replace(' ', '_');
          if (statusFilter === 'paid' && paymentStatus !== 'paid') return false;
          if (statusFilter === 'unpaid' && paymentStatus !== 'unpaid') return false;
          if (statusFilter === 'partial' && paymentStatus !== 'partial_paid') return false;
          if (statusFilter === 'cancelled' && paymentStatus !== 'cancelled') return false;
        }

        if (normalizedDateFilter) {
          const createdDate = order.created_at ? String(order.created_at).slice(0, 10) : '';
          if (createdDate !== normalizedDateFilter) {
            return false;
          }
        }

        if (!normalizedCustomerFilter) {
          return true;
        }

        const candidate = [
          order.customer_name,
          order.customer_email,
          order.user_id,
          order.product_id,
          order.product_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return candidate.includes(normalizedCustomerFilter);
      })
      .sort((a, b) => {
        let left = '';
        let right = '';

        if (sortField === 'customer_name') {
          left = String(a.customer_name || a.customer_email || '');
          right = String(b.customer_name || b.customer_email || '');
        } else if (sortField === 'customer_id') {
          left = String(a.user_id || a.customer_id || '');
          right = String(b.user_id || b.customer_id || '');
        } else {
          left = String(a.order_id || a.tracking_id || '0');
          right = String(b.order_id || b.tracking_id || '0');
        }

        const compare = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? compare : -compare;
      });
  }, [orders, statusFilter, customerFilter, sortField, sortDirection, orderDateFilter, orderScope]);

  const orderGroups = useMemo(() => {
    const groups = {};

    filteredOrders.forEach((order) => {
      const groupId = order.order_group_id || String(order.order_id || order.tracking_id || `single-${Math.random()}`);
      if (!groups[groupId]) {
        groups[groupId] = {
          groupId,
          orders: [],
          originalCost: 0,
          totalCost: 0,
          totalPaid: 0,
          totalRemaining: 0,
          totalQuantity: 0,
          paymentModes: new Set(),
          customerName: order.customer_name || order.customer_email || 'N/A',
          customerId: order.user_id || order.customer_id || 'N/A',
          lastActionBy: getHandledByName(order),
        };
      }

      groups[groupId].orders.push(order);
      groups[groupId].originalCost += Number(order.total_cost || 0);
      groups[groupId].totalCost += Number(order.payable_amount ?? (order.total_cost || 0));
      groups[groupId].totalPaid += Number(order.amount_paid || 0);
      groups[groupId].totalRemaining += getDisplayRemaining(order);
      groups[groupId].totalQuantity += Number(order.quantity || 0);
      if (order.payment_mode) {
        groups[groupId].paymentModes.add(order.payment_mode);
      }
    });

    return Object.values(groups).map((group) => {
      const allPaid = group.orders.every((order) => Number(order.amount_paid || 0) >= Number(order.payable_amount ?? (order.total_cost || 0)) && order.status !== 'cancelled');
      const anyPaid = group.orders.some((order) => Number(order.amount_paid || 0) > 0);
      const allCancelled = group.orders.every((order) => order.status === 'cancelled');
      const paymentStatus = allCancelled
        ? 'Cancelled'
        : allPaid
          ? 'Paid'
          : anyPaid
            ? 'Partial Paid'
            : 'Unpaid';
      return {
        ...group,
        paymentStatus,
        paymentMode: group.paymentModes.size === 1 ? [...group.paymentModes][0] : (group.paymentModes.size > 1 ? 'Multiple' : 'N/A'),
      };
    });
  }, [filteredOrders]);

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const openOrderDetailsTab = (groupId) => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'order-details');
    url.searchParams.set('groupId', String(groupId));
    window.history.pushState({}, '', url.toString());
    onNavigate?.('order-details');
  };

  useEffect(() => {
    const nextExpanded = {};
    orderGroups.forEach((group) => {
      if (group.orders.length > 1) {
        nextExpanded[group.groupId] = expandedGroups[group.groupId] ?? true;
      }
    });
    if (Object.keys(nextExpanded).length > 0) {
      setExpandedGroups((prev) => ({ ...nextExpanded, ...prev }));
    }
  }, [orderGroups]);

  if (loading) {
    return <LoadingSpinner className="mt-5" label="Loading orders..." />;
  }

  const desktopActions = (
    <>
      <ToolbarButton icon={<HiOutlineArrowPath />} onClick={fetchOrders} label="Refresh orders">Refresh</ToolbarButton>
      <ExportMenu
        open={showOrderExportMenu}
        onToggle={toggleOrderPopup('export')}
        label="Export orders"
        items={exportMenuItems}
        className="orders-export-menu"
      />
      <SearchBar
        open={showOrderSearch}
        value={customerFilter}
        placeholder="Search customer..."
        onToggle={toggleOrderPopup('search')}
        onChange={(e) => setCustomerFilter(e.target.value)}
      />
      <SortMenu open={showOrderSortMenu} onToggle={toggleOrderPopup('sort')} label="Sort orders">
        <select className="form-select toolbar-input" value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="order_id">Order ID</option>
          <option value="customer_id">Customer ID</option>
          <option value="customer_name">Customer name</option>
        </select>
        <div className="toolbar-toggle-group">
          <ToolbarButton active={sortDirection === 'asc'} onClick={() => {
            setSortDirection('asc');
            setShowOrderSortMenu(false);
          }}>
            Ascending
          </ToolbarButton>
          <ToolbarButton active={sortDirection === 'desc'} onClick={() => {
            setSortDirection('desc');
            setShowOrderSortMenu(false);
          }}>
            Descending
          </ToolbarButton>
        </div>
      </SortMenu>
      <FilterPanel open={showOrderFilters} onToggle={toggleOrderPopup('filter')} onApply={closeOrderPopups} onReset={resetOrderFilters} title="Filter">
        <select className="form-select toolbar-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All payments</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          className="form-control toolbar-input"
          value={orderDateFilter}
          onChange={(e) => setOrderDateFilter(e.target.value)}
        />
        <div className="toolbar-toggle-group">
          <ToolbarButton active={orderScope === 'active'} onClick={() => setOrderScope('active')}>Active</ToolbarButton>
          <ToolbarButton active={orderScope === 'cancelled'} onClick={() => setOrderScope('cancelled')}>Cancelled</ToolbarButton>
        </div>
      </FilterPanel>
    </>
  );

  const mobileActions = (
    <>
      <SearchBar
        open={showOrderSearch}
        value={customerFilter}
        placeholder="Search customer..."
        onToggle={toggleOrderPopup('search')}
        onChange={(e) => setCustomerFilter(e.target.value)}
      />
      <OverflowMenu
        open={showOrderOverflowMenu}
        onToggle={toggleOrderPopup('overflow')}
        label="More actions"
        items={[
          { label: 'Refresh', icon: <HiOutlineArrowPath />, onClick: () => { closeOrderPopups(); fetchOrders(); } },
          { label: 'Export', icon: <HiOutlineArrowDownTray />, onClick: () => openOrderPopupFromMenu('export') },
          { label: 'Sort', icon: <HiOutlineArrowsUpDown />, onClick: () => openOrderPopupFromMenu('sort') },
          { label: 'Filter', icon: <HiOutlineAdjustmentsHorizontal />, onClick: () => openOrderPopupFromMenu('filter') },
        ]}
      />
    </>
  );

  return (
    <PageContainer className="mt-5">
      <PageHeader
        kicker="Orders"
        title="Order management"
        description="Review orders, manage payments, print invoices, and export records from one place."
      />

      <Toolbar
        className="mt-4 orders-toolbar-card"
        kicker="Controls"
        title="Order workspace"
        description="Search, filter, export, and print orders with consistent spacing."
        actions={desktopActions}
        mobileActions={mobileActions}
        onSearchShortcut={() => toggleOrderPopup('search')(!showOrderSearch)}
        onRefreshShortcut={() => { closeOrderPopups(); fetchOrders(); }}
        onClosePanels={closeOrderPopups}
      >
        <div className={`toolbar-reveal ${showOrderFilters ? 'open' : ''}`}>
          <div className="toolbar-filter-panel order-filter-panel">
            <select className="form-select toolbar-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              className="form-control toolbar-input"
              value={orderDateFilter}
              onChange={(e) => setOrderDateFilter(e.target.value)}
            />
            <div className="toolbar-toggle-group">
              <button
                type="button"
                className={`toolbar-button ${orderScope === 'active' ? 'active' : ''}`}
                onClick={() => setOrderScope('active')}
              >
                Active
              </button>
              <button
                type="button"
                className={`toolbar-button ${orderScope === 'cancelled' ? 'active' : ''}`}
                onClick={() => setOrderScope('cancelled')}
              >
                Cancelled
              </button>
            </div>
            <div className="toolbar-panel-actions">
              <ToolbarButton variant="primary" onClick={() => setShowOrderFilters(false)}>Apply</ToolbarButton>
              <ToolbarButton onClick={resetOrderFilters}>Reset</ToolbarButton>
            </div>
          </div>
        </div>
      </Toolbar>

      {adminView && orderScope === 'cancelled' && (
        <div className="alert alert-warning">You are viewing cancelled orders only.</div>
      )}

      

      {filteredOrders.length === 0 ? (
        <EmptyState title="No orders found" description="Try widening your search or switching the filter scope." />
      ) : (
        <>
        <div className="orders-mobile-stack d-lg-none">
          {orderGroups.map((group) => {
            const groupStatus = group.orders.length > 1 ? 'Grouped' : group.orders[0]?.status || 'N/A';
            const previewOrder = group.orders[0] || {};

            return (
              <article key={group.groupId} className="orders-mobile-card">
                <div className="orders-mobile-head">
                  <div>
                    <div className="orders-mobile-kicker">Order Group</div>
                    <h3>{group.groupId}</h3>
                    <p>{group.customerName} · {group.customerId}</p>
                  </div>
                  <button
                    type="button"
                    className="toolbar-button compact"
                    onClick={() => openOrderDetailsTab(group.groupId)}
                  >
                    Show Items
                  </button>
                </div>

                <div className="orders-mobile-grid">
                  <div><span>Items</span><strong>{group.orders.length}</strong></div>
                  <div><span>Status</span><strong>{groupStatus}</strong></div>
                  <div><span>Payment</span><strong>{group.paymentStatus}</strong></div>
                  <div><span>Total</span><strong>{formatINR(group.totalCost)}</strong></div>
                </div>

                <div className="orders-mobile-actions">
                  <button type="button" className="toolbar-button secondary compact" onClick={() => handleGenerateGroupInvoice(group)}>Invoice</button>
                  <button type="button" className="toolbar-button secondary compact" onClick={() => handleDownloadGroupInvoice(group)}>PDF</button>
                  {adminView ? (
                    <>
                      {group.totalRemaining > 0 ? (
                        <button type="button" className="toolbar-button primary compact" onClick={() => handleCollectPaymentGroup(group)}>Collect</button>
                      ) : null}
                      <button type="button" className="toolbar-button compact" onClick={() => handleCancelGroup(group)}>Cancel</button>
                    </>
                  ) : group.orders.some((o) => o.status === 'cancelled') ? (
                    <button type="button" className="toolbar-button primary compact" onClick={() => handleReorderGroup(group)}>Reorder</button>
                  ) : (
                    <button type="button" className="toolbar-button danger compact" onClick={() => handleCancelGroup(group)}>Cancel</button>
                  )}
                </div>

                {expandedGroups[group.groupId] && (
                  <div className="orders-mobile-items">
                    {group.orders.map((order) => {
                      const rowKey = getOrderKey(order);
                      const displayRemaining = getDisplayRemaining(order);
                      const displayPaid = Number(order.amount_paid || 0);
                      const orderPaymentStatus = getPaymentStatus(order);

                      return (
                        <div key={`${order.groupId || order.order_id}-${order.product_id || 'no-product'}`} className="orders-mobile-item">
                          <div className="orders-mobile-item-top">
                            <strong>{getOrderProductLabel(order)}</strong>
                            <span>{order.order_id || order.tracking_id || 'N/A'}</span>
                          </div>
                          <div className="orders-mobile-item-grid">
                            <div><span>Qty</span><strong>{order.quantity}</strong></div>
                            <div><span>Price</span><strong>{formatINR(Number(order.product_price || 0))}</strong></div>
                            <div><span>Paid</span><strong>{formatINR(displayPaid)}</strong></div>
                            <div><span>Remaining</span><strong>{formatINR(displayRemaining)}</strong></div>
                            <div><span>Status</span><strong>{order.status || 'N/A'}</strong></div>
                            {adminView && <div><span>Payment</span><strong>{orderPaymentStatus}</strong></div>}
                          </div>
                          <div className="orders-mobile-actions orders-mobile-actions-tight">
                            <button type="button" className="toolbar-button secondary compact" onClick={() => handleGenerateInvoice(order)}>Invoice</button>
                            <button type="button" className="toolbar-button secondary compact" onClick={() => handleDownloadInvoice(order)}>PDF</button>
                            {adminView ? (
                              <>
                                <button type="button" className="toolbar-button compact" onClick={() => handleAdjustQuantity(order, -1)}>- Qty</button>
                                <button type="button" className="toolbar-button compact" onClick={() => handleAdjustQuantity(order, 1)}>+ Qty</button>
                                {displayRemaining > 0 && order.status !== 'cancelled' && (
                                  <button type="button" className="toolbar-button primary compact" onClick={() => handleCollectPayment(order)}>Record</button>
                                )}
                              </>
                            ) : order.status === 'cancelled' ? (
                              <button type="button" className="toolbar-button primary compact" onClick={() => handleReorderOrder(order)}>Reorder</button>
                            ) : (
                              <button type="button" className="toolbar-button danger compact" onClick={() => handleCancelOrder(order)}>Cancel</button>
                            )}
                          </div>
                          {adminView && (
                            <div className="orders-mobile-inline-form">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control form-control-sm"
                                placeholder="Amount"
                                value={paymentInputs[rowKey]?.amount || ''}
                                onChange={(e) => setPaymentInput(rowKey, 'amount', e.target.value)}
                              />
                              <select
                                className="form-select form-select-sm"
                                value={paymentInputs[rowKey]?.mode || 'cash'}
                                onChange={(e) => setPaymentInput(rowKey, 'mode', e.target.value)}
                              >
                                <option value="cash">Cash</option>
                                <option value="wallet">Wallet</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                              </select>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                className="form-control form-control-sm"
                                placeholder="Discount %"
                                value={paymentInputs[rowKey]?.discount || ''}
                                onChange={(e) => setPaymentInput(rowKey, 'discount', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Order ID</th>
                {adminView && <th>Customer</th>}
                {adminView && <th>Customer ID</th>}
                <th>Product Name</th>
                <th>Product ID</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Cost</th>
                {adminView && <th>Discount</th>}
                {adminView && <th>Payable</th>}
                <th>Status</th>
                {adminView && <th>Payment Status</th>}
                {adminView && <th>Amount Paid</th>}
                {adminView && <th>Remaining</th>}
                {adminView && <th>Payment Mode</th>}
                {adminView && <th>Handled By</th>}
                {adminView && <th>Action</th>}
                {!adminView && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {orderGroups.map((group) => {
                const groupStatus = group.orders.length > 1 ? 'Grouped' : group.orders[0]?.status || 'N/A';

                return (
                  <Fragment key={group.groupId}>
                    <tr className="table-active">
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openOrderDetailsTab(group.groupId)}
                        >
                          Show Items
                        </button>
                        <div className="mt-1 small text-muted">{group.groupId}</div>
                      </td>
                      {adminView && <td>{group.customerName}</td>}
                      {adminView && <td>{group.customerId}</td>}
                      <td>{group.orders.length} item{group.orders.length > 1 ? 's' : ''}</td>
                      <td>—</td>
                      <td>{group.totalQuantity}</td>
                      <td>—</td>
                      <td>{formatINR(group.originalCost)}</td>
                      {adminView && <td>—</td>}
                      {adminView && <td>{formatINR(group.totalCost)}</td>}
                      <td>{groupStatus}</td>
                      {adminView && <td>{group.paymentStatus}</td>}
                      {adminView && <td>{formatINR(group.totalPaid)}</td>}
                      {adminView && <td>{formatINR(group.totalRemaining)}</td>}
                      {adminView && <td>{group.paymentMode}</td>}
                      {adminView && <td>{group.lastActionBy}</td>}
                      <td>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleGenerateGroupInvoice(group)}
                          >
                            Invoice
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleDownloadGroupInvoice(group)}
                          >
                            PDF
                          </button>
                          {adminView ? (
                            <>
                              {group.totalRemaining > 0 && (
                                <div className="d-flex gap-1 align-items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    style={{ width: '100px' }}
                                    placeholder="Amount"
                                    value={paymentInputs[group.groupId]?.amount || ''}
                                    onChange={(e) => setPaymentInput(group.groupId, 'amount', e.target.value)}
                                  />
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: '110px' }}
                                    value={paymentInputs[group.groupId]?.mode || 'cash'}
                                    onChange={(e) => setPaymentInput(group.groupId, 'mode', e.target.value)}
                                  >
                                    <option value="cash">Cash</option>
                                    <option value="wallet">Wallet</option>
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                  </select>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleCollectPaymentGroup(group)}
                                  >
                                    Pay
                                  </button>
                                </div>
                              )}
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleCancelGroup(group)}
                              >
                                Cancel Group
                              </button>
                            </>
                          ) : group.orders.every((o) => o.status === 'cancelled') ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleReorderGroup(group)}
                            >
                              Reorder Group
                            </button>
                          ) : (
                            group.orders.some((o) => o.status !== 'cancelled') && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleCancelGroup(group)}
                              >
                                Cancel
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedGroups[group.groupId] && group.orders.map((order) => {
                      const rowKey = getOrderKey(order);
                      const displayRemaining = getDisplayRemaining(order);
                      const displayPaid = Number(order.amount_paid || 0);
                      const orderPaymentStatus = getPaymentStatus(order);
                      const draft = ensureRowDraft(order);
                      const stockLimit = getOrderStockLimit(order);
                      const quantityControlsDisabled = !roleCapabilities.canEditQuantity || order.status === 'cancelled';
                      const discountControlsDisabled = !roleCapabilities.canApplyDiscount || order.status === 'cancelled';
                      const paymentControlsDisabled = !roleCapabilities.canEditPayment || order.status === 'cancelled';
                      const editingQuantity = activeCell?.key === rowKey && activeCell?.field === 'quantity';
                      const editingDiscount = activeCell?.key === rowKey && activeCell?.field === 'discount';
                      const editingPayment = activeCell?.key === rowKey && activeCell?.field === 'payment';

                      return (
                        <tr key={`${order.groupId || order.order_id}-${order.product_id || 'no-product'}`}>
                          <td>{order.order_id || order.tracking_id || 'N/A'}</td>
                          {adminView && <td>{order.customer_name || order.customer_email || 'N/A'}</td>}
                          {adminView && <td>{order.user_id || order.customer_id || 'N/A'}</td>}
                          <td>{getOrderProductLabel(order)}</td>
                          <td>{order.product_id}</td>
                          <td className={`order-editable-cell ${editingQuantity ? 'is-editing' : ''}`} onClick={() => !quantityControlsDisabled && startCellEdit(order, 'quantity')}>
                            {editingQuantity ? (
                              <div className="order-cell-editor order-cell-editor-quantity">
                                <button
                                  type="button"
                                  className="toolbar-button compact"
                                  disabled={quantityControlsDisabled || Number(draft.quantity || 1) <= 1}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    updateOrderDraft(rowKey, 'quantity', String(Math.max(1, Number(draft.quantity || 1) - 1)));
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={stockLimit || undefined}
                                  step="1"
                                  inputMode="numeric"
                                  className="form-control form-control-sm order-quantity-input"
                                  value={draft.quantity}
                                  disabled={quantityControlsDisabled}
                                  onClick={(e) => e.stopPropagation()}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onChange={(e) => updateOrderDraft(rowKey, 'quantity', e.target.value.replace(/[^0-9]/g, '') || '1')}
                                  onKeyDown={(e) => handleQuantityKeyDown(e, order)}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="toolbar-button compact"
                                  disabled={quantityControlsDisabled || (stockLimit > 0 && Number(draft.quantity || 1) >= stockLimit)}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    updateOrderDraft(rowKey, 'quantity', String(Number(draft.quantity || 1) + 1));
                                  }}
                                >
                                  +
                                </button>
                                <button type="button" className="toolbar-button compact" onClick={(e) => { e.stopPropagation(); applyQuantityDraft(order); }}>Save</button>
                                <button type="button" className="toolbar-button compact" onClick={(e) => { e.stopPropagation(); closeCellEdit(order); }}>Cancel</button>
                              </div>
                            ) : (
                              <button type="button" className="order-edit-display" disabled={quantityControlsDisabled}>
                                {order.quantity}
                              </button>
                            )}
                          </td>
                          <td>{formatINR(Number(order.product_price || 0))}</td>
                          {adminView && (
                            <td className={`order-editable-cell ${editingDiscount ? 'is-editing' : ''}`} onClick={() => !discountControlsDisabled && startCellEdit(order, 'discount')}>
                              {editingDiscount ? (
                                <div className="order-cell-editor">
                                  <select
                                    className="form-select form-select-sm order-compact-select"
                                    value={draft.discountMode}
                                    disabled={discountControlsDisabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateOrderDraft(rowKey, 'discountMode', e.target.value)}
                                  >
                                    <option value="percent">%</option>
                                    <option value="fixed">₹</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="form-control form-control-sm order-compact-input"
                                    value={draft.discountValue}
                                    disabled={discountControlsDisabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateOrderDraft(rowKey, 'discountValue', e.target.value.replace(/[^0-9.]/g, ''))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitDiscountDraft(order);
                                      }
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        closeCellEdit(order);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <button type="button" className="toolbar-button compact" onClick={(e) => { e.stopPropagation(); commitDiscountDraft(order); }}>Save</button>
                                  <button type="button" className="toolbar-button compact" onClick={(e) => { e.stopPropagation(); closeCellEdit(order); }}>Cancel</button>
                                </div>
                              ) : (
                                <button type="button" className="order-edit-display" disabled={discountControlsDisabled}>
                                  {Number(order.discount_amount || 0).toFixed(2)} ({Number(order.discount_percentage || 0).toFixed(0)}%)
                                </button>
                              )}
                            </td>
                          )}
                          {adminView && <td>{formatINR(Number(order.payable_amount ?? (order.total_cost || 0)))}</td>}
                          <td>{formatINR(Number(order.total_cost || 0))}</td>
                          <td><span className={getStatusChipClass(order.status)}>{order.status || 'N/A'}</span></td>
                          {adminView && <td><span className={getStatusChipClass(orderPaymentStatus)}>{orderPaymentStatus}</span></td>}
                            {adminView && <td>{formatINR(displayPaid)}</td>}
                            {adminView && <td>{formatINR(displayRemaining)}</td>}
                            {adminView && (
                              <td className={`order-editable-cell ${editingPayment ? 'is-editing' : ''}`} onClick={() => !paymentControlsDisabled && startCellEdit(order, 'payment')}>
                                {editingPayment ? (
                                  <div className="order-cell-editor">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="form-control form-control-sm order-compact-input"
                                      placeholder="₹ Paid"
                                      value={draft.paymentAmount}
                                      disabled={paymentControlsDisabled}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => updateOrderDraft(rowKey, 'paymentAmount', e.target.value.replace(/[^0-9.]/g, ''))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          commitPaymentDraft(order);
                                        }
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          closeCellEdit(order);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <select
                                      className="form-select form-select-sm order-compact-select"
                                      value={draft.paymentMode}
                                      disabled={paymentControlsDisabled}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => updateOrderDraft(rowKey, 'paymentMode', e.target.value)}
                                    >
                                      <option value="cash">Cash</option>
                                      <option value="wallet">Wallet</option>
                                      <option value="upi">UPI</option>
                                      <option value="card">Card</option>
                                    </select>
                                    <button type="button" className="toolbar-button primary compact" onClick={(e) => { e.stopPropagation(); commitPaymentDraft(order); }}>Save</button>
                                    <button type="button" className="toolbar-button compact" onClick={(e) => { e.stopPropagation(); closeCellEdit(order); }}>Cancel</button>
                                  </div>
                                ) : (
                                  <button type="button" className="order-edit-display" disabled={paymentControlsDisabled}>
                                    {order.payment_mode || (displayRemaining > 0 ? 'unpaid' : 'N/A')}
                                  </button>
                                )}
                              </td>
                            )}
                            {adminView && <td>{getHandledByName(order)}</td>}
                          <td>
                            <div className="order-action-stack">
                              <div className="order-action-row">
                                <button type="button" className="toolbar-button secondary compact" onClick={() => handleGenerateInvoice(order)}>Invoice</button>
                                <button type="button" className="toolbar-button secondary compact" onClick={() => handleDownloadInvoice(order)}>PDF</button>
                                <button type="button" className="toolbar-button secondary compact" disabled={!roleCapabilities.canViewHistory} onClick={() => fetchOrderActionHistory(order)}>History</button>
                                {roleCapabilities.canCancel && (
                                  <button
                                    type="button"
                                    className="toolbar-button outline-danger compact"
                                    onClick={async () => {
                                      if (!window.confirm('Cancel Product?')) return;
                                      await handleCancelOrder(order);
                                    }}
                                  >
                                    Cancel Product
                                  </button>
                                )}
                              </div>
                              {adminView && (
                                <div className="order-history-panel">
                                  <div className="order-manage-label">Timeline</div>
                                  <div className="order-history-list">
                                    {(orderActions[rowKey] || []).slice(0, 6).map((action) => (
                                      <div key={action.action_id} className="order-history-item">
                                        <div className="order-history-top">
                                          <strong>{action.action_type}</strong>
                                          <span>{new Date(action.created_at).toLocaleString()}</span>
                                        </div>
                                        <div>{action.action_note || action.action_metadata || ''}</div>
                                        <div className="text-muted">{getDisplayName(action.action_by_user_name)}</div>
                                      </div>
                                    ))}
                                    {(orderActions[rowKey] || []).length === 0 && <div className="text-muted small">No timeline entries yet.</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </PageContainer>
  );
};

export default Orders;
