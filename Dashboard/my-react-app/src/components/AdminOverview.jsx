import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { notify } from '../utils/notify';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const AdminOverview = ({ onNavigate }) => {
  const [summary, setSummary] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentStockEntries, setRecentStockEntries] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };
  const [customerInviteLink, setCustomerInviteLink] = useState('');
  const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' });

  const notify = (text, type = 'info') => {
    window.dispatchEvent(new CustomEvent('app:notify', { detail: { message: text, type } }));
  };

  const fetchSummary = async ({ startDate: selectedStartDate = '', endDate: selectedEndDate = '' } = {}) => {
    try {
      const response = await api.get('/admin/summary', {
        params: {
          startDate: selectedStartDate || undefined,
          endDate: selectedEndDate || undefined,
        },
      });
      setSummary(response.data?.summary || null);
      setRecentProducts(Array.isArray(response.data?.recent_products) ? response.data.recent_products : []);
      setRecentStockEntries(Array.isArray(response.data?.recent_stock_entries) ? response.data.recent_stock_entries : []);
      setAppliedRange({ startDate: selectedStartDate, endDate: selectedEndDate });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load dashboard summary');
      setSummary(null);
      setRecentProducts([]);
      setRecentStockEntries([]);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const periodLabel = useMemo(() => {
    if (!appliedRange.startDate && !appliedRange.endDate) {
      return 'All time';
    }
    if (appliedRange.startDate && appliedRange.endDate) {
      return `${appliedRange.startDate} to ${appliedRange.endDate}`;
    }
    if (appliedRange.startDate) {
      return `From ${appliedRange.startDate}`;
    }
    return `Until ${appliedRange.endDate}`;
  }, [appliedRange]);

  const applyQuickRange = (mode) => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start = '';

    if (mode === '7d') {
      const date = new Date(today);
      date.setDate(date.getDate() - 6);
      start = date.toISOString().slice(0, 10);
    } else if (mode === '30d') {
      const date = new Date(today);
      date.setDate(date.getDate() - 29);
      start = date.toISOString().slice(0, 10);
    } else if (mode === 'year') {
      start = `${today.getFullYear()}-01-01`;
    }

    setStartDate(start);
    setEndDate(end);
    fetchSummary({ startDate: start, endDate: end });
  };

  const applyCustomRange = () => {
    fetchSummary({ startDate, endDate });
  };

  const createCustomerInvite = async () => {
    try {
      const response = await api.post('/admin/customer-invites', {});
      const inviteLink = response.data?.invite_link || '';
      setCustomerInviteLink(inviteLink);
      notify('Customer invite link generated', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to generate customer invite link';
      setMessage(errorMessage);
      notify(errorMessage, 'danger');
    }
  };

  const totalAmount = Number(summary?.total_amount || 0);
  const totalPaidAmount = Number(summary?.total_paid_amount || 0);
  const totalGeneratedAfterDiscount = Number(summary?.total_generated_after_discount || 0);
  const totalDiscountAmount = Number(summary?.total_discount_amount || 0);

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="mb-1">Admin Overview</h2>
          <p className="text-muted mb-0">At-a-glance order value and payment totals for {periodLabel}.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-primary" onClick={() => fetchSummary(appliedRange)}>Refresh</button>
          {onNavigate && <button className="btn btn-primary" onClick={() => onNavigate('stock')}>Open Stock</button>}
          {onNavigate && <button className="btn btn-outline-dark" onClick={() => onNavigate('employee-records')}>Open Employees</button>}
          <button className="btn btn-outline-success" onClick={createCustomerInvite}>Generate Customer Invite</button>
        </div>
      </div>

      {customerInviteLink && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="text-break">Customer invite link: <a href={customerInviteLink} target="_blank" rel="noreferrer">{customerInviteLink}</a></div>
          </div>
        </div>
      )}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={applyCustomRange}>Apply range</button>
            <button className="btn btn-outline-secondary" onClick={() => applyQuickRange('7d')}>Last 7 days</button>
            <button className="btn btn-outline-secondary" onClick={() => applyQuickRange('30d')}>Last 30 days</button>
            <button className="btn btn-outline-secondary" onClick={() => applyQuickRange('year')}>This year</button>
            <button
              className="btn btn-link"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                fetchSummary();
              }}
            >
              Clear filter
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Amount</div>
              <div className="fs-3 fw-semibold">{money.format(totalAmount)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Paid Amount</div>
              <div className="fs-3 fw-semibold text-success">{money.format(totalPaidAmount)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Money Generated After Discount</div>
              <div className="fs-3 fw-semibold text-primary">{money.format(totalGeneratedAfterDiscount)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Discount Given</div>
              <div className="fs-3 fw-semibold text-warning">{money.format(totalDiscountAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-2">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">Recently added products</h3>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td>{Number(product.piece || 0)}</td>
                      </tr>
                    ))}
                    {recentProducts.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center text-muted py-4">No recent products found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">Recent stock entries</h3>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStockEntries.map((entry) => (
                      <tr key={entry.stock_entry_id}>
                        <td>{entry.product_name}</td>
                        <td>{Number(entry.units || 0)}</td>
                        <td>{entry.recorded_at ? new Date(entry.recorded_at).toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))}
                    {recentStockEntries.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center text-muted py-4">No stock entries yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
