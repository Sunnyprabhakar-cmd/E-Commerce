import { useState, useEffect } from 'react';
import api from '../api/client';

const Cart = ({ onNavigate }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);

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
      await fetchWalletBalance();
    } catch (error) {
      console.error('Error fetching cart:', error);
      if (error.code === 'ERR_NETWORK') {
        setMessage('Cannot reach backend server on http://localhost:3001. Start backend with: npm start');
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
      fetchCartItems();
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
      fetchCartItems();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error updating cart';
      setMessage(errorMsg);
    }
  };

  const handlePlaceOrder = async (item) => {
    const orderCost = Number(item.price || 0) * Number(item.quantity || 0);
    if (orderCost <= 0) {
      setMessage('Invalid order cost');
      return;
    }

    if (walletBalance < orderCost) {
      setMessage('Insufficient wallet balance. Please add funds in Wallet.');
      return;
    }

    try {
      await api.post('/afterOrder', {
        price: orderCost,
        type: 'debit',
        reference_type: 'order',
        message: `Payment for product ${item.product_id}`,
        order_id: null
      });

      await api.post('/placeOrder', {
        product_id: item.product_id,
        quantity: item.quantity,
        product_price: item.price
      });

      await api.post('/deleteProductFromCart', { product_id: item.product_id });
      setMessage('Order placed successfully!');
      fetchCartItems();
    } catch (error) {
      // If order placement fails after debit, credit back the amount.
      try {
        await api.post('/balanceCredit', {
          price: orderCost,
          type: 'credit',
          reference_type: 'order_refund',
          message: `Auto-refund for failed order ${item.product_id}`,
          order_id: null
        });
      } catch {
        // ignore refund failure here; surface primary error below
      }
      const errorMsg = error.response?.data?.message || 'Error placing order';
      setMessage(errorMsg);
      fetchWalletBalance();
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setMessage('Your cart is empty');
      return;
    }
    try {
      const totalOrderCost = cartItems.reduce(
        (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)),
        0
      );

      if (walletBalance < totalOrderCost) {
        setMessage('Insufficient wallet balance for checkout. Please add funds in Wallet.');
        return;
      }

      for (const item of cartItems) {
        const orderCost = Number(item.price || 0) * Number(item.quantity || 0);

        await api.post('/afterOrder', {
          price: orderCost,
          type: 'debit',
          reference_type: 'order',
          message: `Payment for product ${item.product_id}`,
          order_id: null
        });

        await api.post('/placeOrder', {
          product_id: item.product_id,
          quantity: item.quantity,
          product_price: item.price
        });

        await api.post('/deleteProductFromCart', { product_id: item.product_id });
      }
      setMessage('Checkout complete! All cart items were ordered.');
      fetchCartItems();
      onNavigate && onNavigate('orders');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Checkout failed';
      setMessage(errorMsg);
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
      {message && <div className="alert alert-info">{message}</div>}
      <div className="alert alert-secondary d-flex justify-content-between align-items-center">
        <span>Wallet Balance: <strong>${walletBalance.toFixed(2)}</strong></span>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onNavigate && onNavigate('wallet')}>
          Add Funds
        </button>
      </div>

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
                    <td>${item.price || '0.00'}</td>
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
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveFromCart(item.product_id)}
                      >
                        Remove
                      </button>
                      <button
                        className="btn btn-sm btn-success ms-2"
                        onClick={() => handlePlaceOrder(item)}
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
                    Total: ${totalPrice.toFixed(2)}
                  </h4>
                  <button className="btn btn-primary w-100 mt-3" onClick={handleCheckout}>
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
