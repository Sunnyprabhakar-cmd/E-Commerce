import { Fragment, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const Orders = ({ onNavigate, userRole }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortField, setSortField] = useState('order_id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [paymentInputs, setPaymentInputs] = useState({});
  const [actionSelections, setActionSelections] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const adminView = userRole === 'admin';
  const fetchEndpoint = adminView ? '/orders' : '/orderDetail';

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get(fetchEndpoint);
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
      await api.post('/cancelOrder', {
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

  const getOrderKey = (order) => order.order_id || order.tracking_id || `${order.product_id}-${order.user_id}`;

  const getPaymentStatus = (order) => {
    if (order.status === 'cancelled') {
      return 'Cancelled';
    }
    const total = Number(order.total_cost || 0);
    const paid = Number(order.amount_paid || 0);
    if (paid <= 0) {
      return 'Unpaid';
    }
    if (paid >= total) {
      return 'Paid';
    }
    return 'Partial Paid';
  };

  const handleAdminOrderAction = async (order, action) => {
    try {
      const response = await api.post('/admin/orderAction', {
        order_id: order.order_id || order.tracking_id,
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

  const handleApplyAction = async (order) => {
    const key = getOrderKey(order);
    const selection = actionSelections[key];
    if (!selection) {
      setMessage('Select an admin action first');
      return;
    }
    await handleAdminOrderAction(order, selection);
  };

  const handleCollectPayment = async (order) => {
    const key = getOrderKey(order);
    const inputs = paymentInputs[key] || {};
    const amount = Number(inputs.amount || 0);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid payment amount');
      return;
    }
    try {
      const response = await api.post('/admin/orderAction', {
        order_id: order.order_id || order.tracking_id,
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

  const getDisplayRemaining = (order) => {
    const total = Number(order.total_cost || 0);
    const paid = Number(order.amount_paid || 0);
    if (order.remaining_amount !== undefined) {
      return Number(order.remaining_amount);
    }
    return Math.max(total - paid, 0);
  };

  const createInvoiceHtml = (order) => {
    const paymentStatus = getPaymentStatus(order);
    const totalCost = Number(order.total_cost || 0).toFixed(2);
    const amountPaid = Number(order.amount_paid || 0).toFixed(2);
    const remaining = getDisplayRemaining(order).toFixed(2);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${order.order_id || order.tracking_id || ''}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222;}h1{margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #ddd;padding:10px;text-align:left;}th{background:#f5f5f5;}p{margin:6px 0;}</style></head><body><h1>Invoice</h1><p><strong>Order ID:</strong> ${order.order_id || order.tracking_id || ''}</p><p><strong>Customer:</strong> ${order.customer_name || order.customer_email || 'N/A'}</p><p><strong>Customer ID:</strong> ${order.user_id || order.customer_id || 'N/A'}</p><p><strong>Payment Status:</strong> ${paymentStatus}</p><table><thead><tr><th>Product Name</th><th>Product ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th></tr></thead><tbody><tr><td>${order.product_name || 'N/A'}</td><td>${order.product_id || 'N/A'}</td><td>${order.quantity || 0}</td><td>$${Number(order.product_price || 0).toFixed(2)}</td><td>$${totalCost}</td></tr></tbody></table><p><strong>Amount Paid:</strong> $${amountPaid}</p><p><strong>Remaining Amount:</strong> $${remaining}</p><p><strong>Payment Mode:</strong> ${order.payment_mode || 'N/A'}</p><p><strong>Handled By:</strong> ${order.last_action_by_user_name || order.last_action_by_user_phone || 'N/A'}</p><p><strong>Notes:</strong> ${order.payment_notes || 'None'}</p></body></html>`;
  };

  const createGroupInvoiceHtml = (group) => {
    const totalCost = Number(group.totalCost || 0).toFixed(2);
    const amountPaid = Number(group.totalPaid || 0).toFixed(2);
    const remaining = Number(group.totalRemaining || 0).toFixed(2);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${group.groupId}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222;}h1{margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #ddd;padding:10px;text-align:left;}th{background:#f5f5f5;}p{margin:6px 0;}</style></head><body><h1>Invoice</h1><p><strong>Order Group:</strong> ${group.groupId}</p><p><strong>Customer:</strong> ${group.customerName || 'N/A'}</p><p><strong>Customer ID:</strong> ${group.customerId || 'N/A'}</p><p><strong>Payment Status:</strong> ${group.paymentStatus}</p><table><thead><tr><th>Product Name</th><th>Product ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th></tr></thead><tbody>${group.orders.map((order) => `<tr><td>${order.product_name || 'N/A'}</td><td>${order.product_id || 'N/A'}</td><td>${order.quantity || 0}</td><td>$${Number(order.product_price || 0).toFixed(2)}</td><td>$${Number(order.total_cost || 0).toFixed(2)}</td></tr>`).join('')}</tbody></table><p><strong>Total Amount:</strong> $${totalCost}</p><p><strong>Amount Paid:</strong> $${amountPaid}</p><p><strong>Remaining Amount:</strong> $${remaining}</p><p><strong>Payment Mode:</strong> ${group.paymentMode || 'N/A'}</p><p><strong>Handled By:</strong> ${group.lastActionBy || 'N/A'}</p></body></html>`;
  };

  const handleGenerateGroupInvoice = (group) => {
    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    invoiceWindow.document.write(createGroupInvoiceHtml(group));
    invoiceWindow.document.close();
    invoiceWindow.focus();
  };

  const handleCancelGroup = async (group) => {
    try {
      await api.post('/cancelOrder', {
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
      const response = await api.post('/admin/orderAction', {
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

  const handleGenerateInvoice = (order) => {
    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) {
      setMessage('Unable to open invoice window. Check popup settings.');
      return;
    }
    invoiceWindow.document.write(createInvoiceHtml(order));
    invoiceWindow.document.close();
    invoiceWindow.focus();
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
        order.order_id || order.tracking_id || '',
        order.product_name || '',
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
          <td>${order.order_id || order.tracking_id || ''}</td>
          <td>${order.product_name || ''}</td>
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Export</title></head><body><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Order ID</th><th>Product Name</th><th>Product ID</th><th>Customer</th><th>Customer ID</th><th>Quantity</th><th>Unit Price</th><th>Total Cost</th><th>Status</th><th>Payment Status</th><th>Amount Paid</th><th>Remaining</th><th>Payment Mode</th><th>Handled By</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
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

    return [...orders]
      .filter((order) => {
        if (statusFilter !== 'all') {
          const paymentStatus = getPaymentStatus(order).toLowerCase().replace(' ', '_');
          if (statusFilter === 'paid' && paymentStatus !== 'paid') return false;
          if (statusFilter === 'unpaid' && paymentStatus !== 'unpaid') return false;
          if (statusFilter === 'partial' && paymentStatus !== 'partial_paid') return false;
          if (statusFilter === 'cancelled' && paymentStatus !== 'cancelled') return false;
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
  }, [orders, statusFilter, customerFilter, sortField, sortDirection]);

  const orderGroups = useMemo(() => {
    const groups = {};

    filteredOrders.forEach((order) => {
      const groupId = order.order_group_id || String(order.order_id || order.tracking_id || `single-${Math.random()}`);
      if (!groups[groupId]) {
        groups[groupId] = {
          groupId,
          orders: [],
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
      groups[groupId].totalCost += Number(order.total_cost || 0);
      groups[groupId].totalPaid += Number(order.amount_paid || 0);
      groups[groupId].totalRemaining += getDisplayRemaining(order);
      groups[groupId].totalQuantity += Number(order.quantity || 0);
      if (order.payment_mode) {
        groups[groupId].paymentModes.add(order.payment_mode);
      }
    });

    return Object.values(groups).map((group) => {
      const allPaid = group.orders.every((order) => Number(order.amount_paid || 0) >= Number(order.total_cost || 0) && order.status !== 'cancelled');
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
    return <div className="text-center mt-5">Loading orders...</div>;
  }

  return (
    <div className="container mt-5">
      <div className="mb-3 d-flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => onNavigate && onNavigate('list')}>
          Back to Products
        </button>
        <button className="btn btn-outline-primary" onClick={fetchOrders}>
          Refresh
        </button>
        {adminView && (
          <>
            <button className="btn btn-outline-success" onClick={exportOrdersToCSV}>
              Export Excel
            </button>
            <button className="btn btn-outline-info" onClick={exportOrdersToDoc}>
              Export Word
            </button>
            <button className="btn btn-outline-secondary" onClick={printOrders}>
              Print / PDF
            </button>
                    <select
              className="form-select"
              style={{ maxWidth: '180px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="form-select"
              style={{ maxWidth: '220px' }}
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="order_id">Order ID</option>
              <option value="customer_id">Customer ID</option>
              <option value="customer_name">Customer name</option>
            </select>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            >
              Sort {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
            <input
              type="text"
              className="form-control"
              style={{ minWidth: '220px' }}
              placeholder="Filter by customer id or name"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
          </>
        )}
      </div>

      <h2>{adminView ? 'All Orders' : 'My Orders'}</h2>
      {message && <div className="alert alert-info">{message}</div>}

      {filteredOrders.length === 0 ? (
        <div className="alert alert-warning">No orders found</div>
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
                          onClick={() => toggleGroupExpansion(group.groupId)}
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
                      <td>${group.totalCost.toFixed(2)}</td>
                      <td>{groupStatus}</td>
                      {adminView && <td>{group.paymentStatus}</td>}
                      {adminView && <td>${group.totalPaid.toFixed(2)}</td>}
                      {adminView && <td>${group.totalRemaining.toFixed(2)}</td>}
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
                          <td>{order.product_name || 'N/A'}</td>
                          <td>{order.product_id}</td>
                          <td>{order.quantity}</td>
                          <td>${Number(order.product_price || 0).toFixed(2)}</td>
                          <td>${Number(order.total_cost || 0).toFixed(2)}</td>
                          <td>{order.status || 'N/A'}</td>
                          {adminView && <td>{orderPaymentStatus}</td>}
                          {adminView && <td>${displayPaid.toFixed(2)}</td>}
                          {adminView && <td>${displayRemaining.toFixed(2)}</td>}
                          {adminView && <td>{order.payment_mode || (displayRemaining > 0 ? 'unpaid' : 'N/A')}</td>}
                          {adminView && <td>{order.last_action_by_user_name || order.last_action_by_user_phone || 'N/A'}</td>}
                          {adminView && (
                            <td>
                              <div className="d-flex flex-column gap-2">
                                <div className="d-flex gap-1">
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ minWidth: '120px' }}
                                    value={actionSelections[rowKey] || ''}
                                    onChange={(e) => setActionSelection(rowKey, e.target.value)}
                                  >
                                    <option value="">Action...</option>
                                    <option value="accept">Accept</option>
                                    <option value="cancel">Cancel</option>
                                  </select>
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleApplyAction(order)}
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
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleGenerateInvoice(order)}
                                >
                                  Invoice
                                </button>
                              </div>
                            </td>
                          )}
                          {!adminView && (
                            <td>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleCancelOrder(order)}
                              >
                                Cancel
                              </button>
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
