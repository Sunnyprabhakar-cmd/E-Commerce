import { useEffect, useMemo, useState } from 'react';
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

  const handleCollectPayment = async (order) => {
    const inputs = paymentInputs[order.order_id] || {};
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
        payment_notes: inputs.notes || `Partial payment for order ${order.order_id}`,
      });
      setMessage(response.data?.message || 'Payment updated successfully');
      setPaymentInputs((prev) => ({ ...prev, [order.order_id]: {} }));
      fetchOrders();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error recording payment';
      setMessage(errorMsg);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [userRole]);

  const filteredOrders = useMemo(() => {
    const normalizedCustomerFilter = customerFilter.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        if (statusFilter !== 'all') {
          const isPaid = order.is_paid !== undefined ? Boolean(order.is_paid) : true;
          if (statusFilter === 'paid' && !isPaid) return false;
          if (statusFilter === 'unpaid' && isPaid) return false;
        }

        if (!normalizedCustomerFilter) {
          return true;
        }

        const candidate = [
          order.customer_name,
          order.customer_email,
          order.user_id,
          order.product_id,
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
            <select
              className="form-select"
              style={{ maxWidth: '180px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
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
                <th>Product ID</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Cost</th>
                <th>Status</th>
                {adminView && <th>Amount Paid</th>}
                {adminView && <th>Remaining</th>}
                {adminView && <th>Payment Mode</th>}
                {adminView && <th>Handled By</th>}
                {adminView && <th>Action</th>}
                {!adminView && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const id = order.order_id || order.tracking_id || 'N/A';
                const customerName = order.customer_name || order.customer_email || 'N/A';
                const customerId = order.user_id || order.customer_id || 'N/A';
                const isPaid = order.is_paid !== undefined ? Boolean(order.is_paid) : true;

                return (
                  <tr key={`${id}-${order.product_id || 'no-product'}`}>
                    <td>{id}</td>
                    {adminView && <td>{customerName}</td>}
                    {adminView && <td>{customerId}</td>}
                    <td>{order.product_id}</td>
                    <td>{order.quantity}</td>
                    <td>${Number(order.product_price || 0).toFixed(2)}</td>
                    <td>${Number(order.total_cost || 0).toFixed(2)}</td>
                    <td>{order.status || 'N/A'}</td>
                    {adminView && <td>${Number(order.amount_paid || 0).toFixed(2)}</td>}
                    {adminView && <td>${Number(order.remaining_amount || 0).toFixed(2)}</td>}
                    {adminView && <td>{order.payment_mode || 'N/A'}</td>}
                    {adminView && <td>{order.last_action_by_user_name || order.last_action_by_user_phone || 'N/A'}</td>}
                    {adminView && (
                      <td>
                        <div className="d-flex flex-column gap-2">
                          <div className="btn-group">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleAdminOrderAction(order, 'accept')}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleAdminOrderAction(order, 'cancel')}
                            >
                              Cancel
                            </button>
                          </div>
                          {order.remaining_amount > 0 && order.status !== 'cancelled' && (
                            <div className="d-flex gap-1 align-items-center">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control form-control-sm"
                                style={{ width: '90px' }}
                                placeholder="Amount"
                                value={paymentInputs[order.order_id]?.amount || ''}
                                onChange={(e) => setPaymentInput(order.order_id, 'amount', e.target.value)}
                              />
                              <select
                                className="form-select form-select-sm"
                                style={{ width: '110px' }}
                                value={paymentInputs[order.order_id]?.mode || 'cash'}
                                onChange={(e) => setPaymentInput(order.order_id, 'mode', e.target.value)}
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
