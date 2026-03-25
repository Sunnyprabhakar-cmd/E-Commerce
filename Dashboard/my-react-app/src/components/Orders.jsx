import { useEffect, useState } from 'react';
import api from '../api/client';

const Orders = ({ onNavigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orderDetail');
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

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return <div className="text-center mt-5">Loading orders...</div>;
  }

  return (
    <div className="container mt-5">
      <div className="mb-3 d-flex gap-2">
        <button className="btn btn-secondary" onClick={() => onNavigate && onNavigate('list')}>
          Back to Products
        </button>
        <button className="btn btn-outline-primary" onClick={fetchOrders}>
          Refresh
        </button>
      </div>

      <h2>My Orders</h2>
      {message && <div className="alert alert-info">{message}</div>}

      {orders.length === 0 ? (
        <div className="alert alert-warning">No orders found</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Tracking ID</th>
                <th>Product ID</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={`${order.tracking_id || order.order_id || order.product_id}-${order.product_id}`}>
                  <td>{order.tracking_id || order.order_id || 'N/A'}</td>
                  <td>{order.product_id}</td>
                  <td>{order.quantity}</td>
                  <td>${Number(order.product_price || 0).toFixed(2)}</td>
                  <td>${Number(order.total_cost || 0).toFixed(2)}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleCancelOrder(order)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
