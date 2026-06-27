import { useState, useEffect } from 'react';
import api from '../api/client';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';

const Cart = ({ onNavigate, onCartChange }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedOrderItem, setSelectedOrderItem] = useState(null);
  const [isOrderModalOpen, setOrderModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('wallet');
  const [checkoutError, setCheckoutError] = useState('');

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/avlBalance');
      setWalletBalance(Number(response.data?.balance || 0));
    } catch {
      setWalletBalance(0);
    }
  };

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cartInfo');
      const data = response.data?.data;
      const items = Array.isArray(data) ? data : [];
      setCartItems(items);
      onCartChange && onCartChange();
      await fetchWalletBalance();
    } catch (error) {
      console.error('Error fetching cart:', error);
      if (error.code === 'ERR_NETWORK') {
        setMessage('Cannot reach backend server on https://e-commerce-4nit.onrender.com. Start backend with: npm start');
      } else {
        const errorMsg = error.response?.data?.message || 'Error loading cart items';
        setMessage(errorMsg);
      }
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId) => {
    try {
      await api.post('/addProductInCart', {
        product_id: productId,
        quantity: 1
      });
      setMessage('Product added to cart!');
      onCartChange && onCartChange();
      fetchCartItems();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error adding to cart';
      setMessage(errorMsg);
    }
  };

  const handleRemoveFromCart = async (productId) => {
    try {
      await api.post('/deleteProductFromCart', {
        product_id: productId
      });
      setMessage('Product removed from cart!');
      onCartChange && onCartChange();
      await fetchCartItems();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error removing from cart';
      setMessage(errorMsg);
    }
  };

  const handleUpdateQuantity = async (productId, operation) => {
    try {
      await api.post('/updateCart', {
        product_id: productId,
        operation: operation
      });
      setMessage('Cart updated!');
      onCartChange && onCartChange();
      await fetchCartItems();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error updating cart';
      setMessage(errorMsg);
    }
  };

  const openOrderDialog = (item) => {
    setSelectedOrderItem(item);
    setModalError('');
    setOrderModalOpen(true);
  };

  const closeOrderDialog = () => {
    setSelectedOrderItem(null);
    setModalError('');
    setOrderModalOpen(false);
  };

  const handlePlaceOrder = async (item, isPaid) => {
    if (!item) {
      return;
    }

    const orderCost = Number(item.price || 0) * Number(item.quantity || 0);
    if (orderCost <= 0) {
      setModalError('Invalid order cost');
      return;
    }

    if (isPaid && walletBalance < orderCost) {
      setModalError('Insufficient wallet balance. Redirecting to Wallet.');
      closeOrderDialog();
      return onNavigate && onNavigate('wallet');
    }

    try {
      if (isPaid) {
        await api.post('/afterOrder', {
          price: orderCost,
          type: 'debit',
          reference_type: 'order',
          message: `Payment for product ${item.product_id}`,
          order_id: null,
        });
      }

      await api.post('/placeOrder', {
        product_id: item.product_id,
        quantity: item.quantity,
        product_price: item.price,
        is_paid: Boolean(isPaid),
        payment_mode: isPaid ? 'wallet' : null,
        payment_reference: isPaid ? `wallet-payment-${item.product_id}` : null,
        payment_notes: isPaid ? 'Paid from wallet at order placement' : 'Deferred payment placed',
      });

      await api.post('/deleteProductFromCart', { product_id: item.product_id });
      setMessage(isPaid ? 'Order placed and paid successfully!' : 'Order placed successfully with deferred payment!');
      closeOrderDialog();
      await fetchCartItems();
      onCartChange && onCartChange();
    } catch (error) {
      if (isPaid) {
        try {
          await api.post('/balanceCredit', {
            price: orderCost,
            type: 'credit',
            reference_type: 'order_refund',
            message: `Auto-refund for failed order ${item.product_id}`,
            order_id: null,
          });
        } catch {
          // ignore refund failure here; surface primary error below
        }
      }
      const errorMsg = error.response?.data?.message || 'Error placing order';
      setModalError(errorMsg);
      fetchWalletBalance();
    }
  };

  const generateOrderGroupId = () => {
    return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      setMessage('Your cart is empty');
      return;
    }
    setCheckoutError('');
    setCheckoutPaymentMethod('wallet');
    setCheckoutModalOpen(true);
  };

  const closeCheckoutDialog = () => {
    setCheckoutError('');
    setCheckoutModalOpen(false);
  };

  const submitCheckout = async () => {
    if (cartItems.length === 0) {
      setCheckoutError('Your cart is empty');
      return;
    }

    const totalOrderCost = cartItems.reduce(
      (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)),
      0
    );

    if (checkoutPaymentMethod === 'wallet' && walletBalance < totalOrderCost) {
      setCheckoutError('Insufficient wallet balance for wallet payment.');
      return;
    }

    const orderGroupId = generateOrderGroupId();

    try {
      if (checkoutPaymentMethod === 'wallet') {
        await api.post('/afterOrder', {
          price: totalOrderCost,
          type: 'debit',
          reference_type: 'order',
          message: `Payment for order group ${orderGroupId}`,
          order_id: null,
        });
      }

      for (const item of cartItems) {
        const isPaid = checkoutPaymentMethod === 'wallet';
        await api.post('/placeOrder', {
          product_id: item.product_id,
          quantity: item.quantity,
          product_price: item.price,
          is_paid: isPaid,
          payment_mode: isPaid ? 'wallet' : 'cash',
          payment_reference: isPaid ? `wallet-payment-${orderGroupId}` : null,
          payment_notes: isPaid
            ? 'Paid from wallet during checkout'
            : 'Deferred payment placed at checkout',
          order_group_id: orderGroupId,
        });
        await api.post('/deleteProductFromCart', { product_id: item.product_id });
      }

      setMessage(
        checkoutPaymentMethod === 'wallet'
          ? 'Checkout complete! All cart items were ordered and paid.'
          : 'Checkout complete! All cart items were ordered with deferred payment.'
      );
      closeCheckoutDialog();
      await fetchCartItems();
      onCartChange && onCartChange();
      onNavigate && onNavigate('orders');
    } catch (error) {
      if (checkoutPaymentMethod === 'wallet') {
        try {
          await api.post('/balanceCredit', {
            price: totalOrderCost,
            type: 'credit',
            reference_type: 'order_refund',
            message: `Refund for failed checkout ${orderGroupId}`,
            order_id: null,
          });
        } catch {
          // ignore refund failure
        }
      }
      const errorMsg = error.response?.data?.message || 'Checkout failed';
      setCheckoutError(errorMsg);
      fetchWalletBalance();
    }
  };

  useEffect(() => {
    fetchCartItems();
  }, []);

  if (loading) return <div className="text-center mt-5">Loading cart...</div>;

  const totalPrice = Array.isArray(cartItems) 
    ? cartItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
    : 0;

  return (
    <div className="container mt-5">
      <div className="mb-3">
        <button 
          className="btn btn-secondary"
          onClick={() => onNavigate && onNavigate('list')}
        >
          ← Back to Products
        </button>
      </div>
      <h2>Shopping Cart</h2>
      {cartItems.length === 0 ? (
        <div className="alert alert-warning">Your cart is empty</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.product_name || `Product ${item.product_id}`}</td>
                    <td>{item.category || 'N/A'}</td>
                    <td>{formatINR(item.price)}</td>
                    <td>
                      <div className="input-group" style={{ width: '100px' }}>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleUpdateQuantity(item.product_id, 'subtract')}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          className="form-control text-center"
                          value={item.quantity}
                          readOnly
                        />
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleUpdateQuantity(item.product_id, 'add')}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>{formatINR(item.price * item.quantity)}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveFromCart(item.product_id)}
                      >
                        Remove
                      </button>
                      <button
                        className="btn btn-sm btn-success ms-2"
                        onClick={() => openOrderDialog(item)}
                      >
                        Place Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row mt-4">
            <div className="col-md-6 offset-md-6">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Cart Summary</h5>
                  <h4 className="text-success">
                    Total: {formatINR(totalPrice)}
                  </h4>
                  <button className="btn btn-primary w-100 mt-3" onClick={handleCheckout}>
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
          {isOrderModalOpen && selectedOrderItem && (
            <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Choose payment option</h5>
                    <button type="button" className="btn-close" onClick={closeOrderDialog}></button>
                  </div>
                  <div className="modal-body">
                    <p>
                      You are placing an order for <strong>{selectedOrderItem.product_name || selectedOrderItem.product_id}</strong>.
                    </p>
                    <p>Quantity: {selectedOrderItem.quantity}</p>
                    <p>Amount: {formatINR(Number(selectedOrderItem.price || 0))} x {selectedOrderItem.quantity} = {formatINR(Number(selectedOrderItem.price || 0) * Number(selectedOrderItem.quantity || 0))}</p>
                    {modalError && <div className="alert alert-danger">{modalError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeOrderDialog}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-outline-primary" onClick={() => handlePlaceOrder(selectedOrderItem, false)}>
                      Pay Later
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handlePlaceOrder(selectedOrderItem, true)}>
                      Pay Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCheckoutModalOpen && (
            <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Checkout</h5>
                    <button type="button" className="btn-close" onClick={closeCheckoutDialog}></button>
                  </div>
                  <div className="modal-body">
                    <p>Total order amount: <strong>{formatINR(totalPrice)}</strong></p>
                    <div className="mb-3">
                      <label className="form-label">Payment option</label>
                      <select
                        className="form-select"
                        value={checkoutPaymentMethod}
                        onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                      >
                        <option value="wallet">Pay with Wallet</option>
                        <option value="cash">Cash / Deferred Payment</option>
                      </select>
                    </div>
                    {checkoutError && <div className="alert alert-danger">{checkoutError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeCheckoutDialog}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={submitCheckout}>
                      Confirm Checkout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Cart;
