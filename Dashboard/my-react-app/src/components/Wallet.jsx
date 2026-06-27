import { useEffect, useState } from 'react';
import { notify } from '../utils/notify';
import { creditBalance, fetchAvailableBalance } from '../services/walletService';
import { formatINR } from '../utils/currency';

const Wallet = ({ onNavigate }) => {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const response = await fetchAvailableBalance();
      setBalance(Number(response.data?.balance || 0));
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to fetch wallet balance';
      setMessage(errorMsg);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setMessage('Enter a valid amount greater than 0');
      return;
    }

    try {
      await creditBalance({
        price: value,
        type: 'credit',
        reference_type: 'wallet_topup',
        message: 'Wallet top-up from frontend',
        order_id: null
      });
      setMessage('Balance added successfully');
      setAmount('');
      fetchBalance();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to add funds';
      setMessage(errorMsg);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  if (loading) {
    return <div className="text-center mt-5">Loading wallet...</div>;
  }

  return (
    <div className="container mt-5">
      <div className="mb-3">
        <button className="btn btn-secondary" onClick={() => onNavigate && onNavigate('list')}>
          Back to Products
        </button>
      </div>

      <h2>My Wallet</h2>
      <div className="card mt-3">
        <div className="card-body">
          <h5 className="card-title">Available Balance</h5>
          <h3 className="text-success">{formatINR(balance)}</h3>

          <div className="mt-4 d-flex gap-2">
            <input
              type="number"
              min="1"
              className="form-control"
              style={{ maxWidth: '240px' }}
              value={amount}
              placeholder="Add amount"
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddFunds}>
              Add Funds
            </button>
            <button className="btn btn-outline-secondary" onClick={fetchBalance}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
