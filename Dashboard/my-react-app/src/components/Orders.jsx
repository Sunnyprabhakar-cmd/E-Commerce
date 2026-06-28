import { Fragment, useEffect, useMemo, useState } from 'react';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';
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
  HiOutlinePrinter,
} from 'react-icons/hi2';
import EmptyState from './common/EmptyState';
import AppCard from './common/AppCard';
import FilterPanel from './common/FilterPanel';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
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
  

  const adminView = userRole === 'admin';
  const fetchEndpoint = adminView ? '/orders' : '/orderDetail';

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
        order.order_group_id || order.order_id || order.tracking_id || '',
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
        order.last_action_by_user_name || order.last_action_by_user_phone || '',
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
          <td>${order.last_action_by_user_name || order.last_action_by_user_phone || ''}</td>
        </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Export</title></head><body><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Order Group ID</th><th>Invoice Number</th><th>Order ID</th><th>Product Name</th><th>Product ID</th><th>Customer</th><th>Customer ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th><th>Status</th><th>Payment Status</th><th>Amount Paid</th><th>Remaining</th><th>Payment Mode</th><th>Handled By</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadFile('orders.doc', html, 'application/msword');
  };

  const printOrders = () => {
    window.print();
  };

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
          lastActionBy: order.last_action_by_user_name || order.last_action_by_user_phone || 'N/A',
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

  return (
    <div className="container mt-5">
      <PageHeader
        kicker="Orders"
        title="Order management"
        description="Review orders, manage payments, print invoices, and export records from one place."
      />

      <AppCard className="mt-4 orders-toolbar-card" title="Controls" subtitle="Search, filter, export, and print orders with consistent spacing.">
        <div className="toolbar-actions toolbar-actions-main">
          <button type="button" className="toolbar-button" onClick={fetchOrders} aria-label="Refresh orders" title="Refresh orders">
            <HiOutlineArrowPath />
            <span>Refresh</span>
          </button>
          <button type="button" className="toolbar-button" onClick={exportOrdersToCSV} aria-label="Export orders to Excel" title="Export orders to Excel">
            <HiOutlineArrowDownTray />
            <span>Excel</span>
          </button>
          <button type="button" className="toolbar-button" onClick={exportOrdersToDoc} aria-label="Export orders to Word" title="Export orders to Word">
            <HiOutlineArrowDownTray />
            <span>Word</span>
          </button>
          <button type="button" className="toolbar-button" onClick={printOrders} aria-label="Print orders" title="Print orders">
            <HiOutlinePrinter />
            <span>Print</span>
          </button>

          <SearchBar
            open={showOrderSearch}
            value={customerFilter}
            placeholder="Search customer..."
            onToggle={() => setShowOrderSearch((prev) => !prev)}
            onChange={(e) => setCustomerFilter(e.target.value)}
          />

          <SortMenu open={showOrderSortMenu} onToggle={setShowOrderSortMenu} label="Sort orders">
            <select className="form-select toolbar-input" value={sortField} onChange={(e) => setSortField(e.target.value)}>
              <option value="order_id">Order ID</option>
              <option value="customer_id">Customer ID</option>
              <option value="customer_name">Customer name</option>
            </select>
            <div className="toolbar-toggle-group">
              <button
                type="button"
                className={`toolbar-button ${sortDirection === 'asc' ? 'active' : ''}`}
                onClick={() => {
                  setSortDirection('asc');
                  setShowOrderSortMenu(false);
                }}
              >
                Ascending
              </button>
              <button
                type="button"
                className={`toolbar-button ${sortDirection === 'desc' ? 'active' : ''}`}
                onClick={() => {
                  setSortDirection('desc');
                  setShowOrderSortMenu(false);
                }}
              >
                Descending
              </button>
            </div>
          </SortMenu>

          <FilterPanel
            open={showOrderFilters}
            onToggle={() => setShowOrderFilters((prev) => !prev)}
            onApply={() => setShowOrderFilters(false)}
            onReset={resetOrderFilters}
            title="Filter"
          >
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
          </FilterPanel>
        </div>
      </AppCard>

      {adminView && orderScope === 'cancelled' && (
        <div className="alert alert-warning">You are viewing cancelled orders only.</div>
      )}

      

      {filteredOrders.length === 0 ? (
        <EmptyState title="No orders found" description="Try widening your search or switching the filter scope." />
      ) : (
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
                          onClick={() => {
                            const willExpand = !expandedGroups[group.groupId];
                            toggleGroupExpansion(group.groupId);
                          }}
                        >
                          {expandedGroups[group.groupId] ? 'Hide items' : 'Show items'}
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

                      return (
                        <tr key={`${order.groupId || order.order_id}-${order.product_id || 'no-product'}`}>
                          <td>{order.order_id || order.tracking_id || 'N/A'}</td>
                          {adminView && <td>{order.customer_name || order.customer_email || 'N/A'}</td>}
                          {adminView && <td>{order.user_id || order.customer_id || 'N/A'}</td>}
                          <td>{getOrderProductLabel(order)}</td>
                          <td>{order.product_id}</td>
                          <td>{order.quantity}</td>
                          <td>{formatINR(Number(order.product_price || 0))}</td>
                          {adminView && <td>{Number(order.discount_amount || 0).toFixed(2)} ({Number(order.discount_percentage || 0).toFixed(0)}%)</td>}
                          {adminView && <td>{formatINR(Number(order.payable_amount ?? (order.total_cost || 0)))}</td>}
                          <td>{formatINR(Number(order.total_cost || 0))}</td>
                          <td>{order.status || 'N/A'}</td>
                          {adminView && <td>{orderPaymentStatus}</td>}
                            {adminView && <td>{formatINR(displayPaid)}</td>}
                            {adminView && <td>{formatINR(displayRemaining)}</td>}
                            {adminView && <td>{order.payment_mode || (displayRemaining > 0 ? 'unpaid' : 'N/A')}</td>}
                            {adminView && <td>{order.last_action_by_user_name || order.last_action_by_user_phone || order.last_action_by_user_id || 'N/A'}</td>}
                          {adminView && (
                            <td>
                              <div className="d-flex flex-column gap-2">
                                <div className="d-flex gap-1 flex-wrap">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleAdjustQuantity(order, -1)}
                                  >
                                    - Qty
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleAdjustQuantity(order, 1)}
                                  >
                                    + Qty
                                  </button>
                                </div>
                                <div className="d-flex gap-1 align-items-center flex-wrap">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    className="form-control form-control-sm"
                                    style={{ width: '90px' }}
                                    placeholder="Discount %"
                                    value={paymentInputs[rowKey]?.discount || ''}
                                    onChange={(e) => setPaymentInput(rowKey, 'discount', e.target.value)}
                                  />
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleApplyOrderDiscount(order)}
                                  >
                                    Apply
                                  </button>
                                </div>
                                {displayRemaining > 0 && order.status !== 'cancelled' && (
                                  <div className="d-flex gap-1 align-items-center flex-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="form-control form-control-sm"
                                      style={{ width: '90px' }}
                                      placeholder="Paid"
                                      value={paymentInputs[rowKey]?.amount || ''}
                                      onChange={(e) => setPaymentInput(rowKey, 'amount', e.target.value)}
                                    />
                                    <select
                                      className="form-select form-select-sm"
                                      style={{ width: '110px' }}
                                      value={paymentInputs[rowKey]?.mode || 'cash'}
                                      onChange={(e) => setPaymentInput(rowKey, 'mode', e.target.value)}
                                    >
                                      <option value="cash">Cash</option>
                                      <option value="wallet">Wallet</option>
                                      <option value="upi">UPI</option>
                                      <option value="card">Card</option>
                                    </select>
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleCollectPayment(order)}
                                    >
                                      Record
                                    </button>
                                  </div>
                                )}
                                <div className="d-flex gap-1 flex-wrap">
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => handleGenerateInvoice(order)}
                                  >
                                    Invoice
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handleDownloadInvoice(order)}
                                  >
                                    PDF
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => fetchOrderActionHistory(order)}
                                  >
                                    History
                                  </button>
                                </div>
                                {orderActions[rowKey]?.length > 0 && (
                                  <div className="border rounded p-2 bg-light" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                    <div className="fw-bold mb-1">Recent actions</div>
                                    {orderActions[rowKey].slice(0, 4).map((action) => (
                                      <div key={action.action_id} className="small mb-1">
                                        <div><strong>{action.action_type}</strong> by {action.action_by_user_name || action.action_by_user_id || 'Unknown'}</div>
                                        <div>{action.action_note || action.action_metadata || ''}</div>
                                        <div className="text-muted">{new Date(action.created_at).toLocaleString()}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                          {!adminView && (
                            <td>
                              <div className="d-flex flex-wrap gap-2 align-items-center">
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleGenerateInvoice(order)}
                                >
                                  Invoice
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleDownloadInvoice(order)}
                                >
                                  PDF
                                </button>
                                {order.status === 'cancelled' ? (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleReorderOrder(order)}
                                  >
                                    Reorder
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleCancelOrder(order)}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
