import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { notify } from '../utils/notify';
import { formatINR } from '../utils/currency';

const chartKeys = [
  { key: 'total_amount', label: 'Total amount' },
  { key: 'total_paid_amount', label: 'Paid amount' },
  { key: 'total_generated_after_discount', label: 'After discount' },
  { key: 'total_discount_amount', label: 'Discount' },
];

const AdminOverview = ({ onNavigate }) => {
  const [summary, setSummary] = useState(null);
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
  const [inviteVisible, setInviteVisible] = useState(false);

  const fetchSummary = async ({ startDate: selectedStartDate = '', endDate: selectedEndDate = '' } = {}) => {
    try {
      const response = await api.get('/admin/summary', {
        params: {
          startDate: selectedStartDate || undefined,
          endDate: selectedEndDate || undefined,
        },
      });
      setSummary(response.data?.summary || null);
      setRecentStockEntries(Array.isArray(response.data?.recent_stock_entries) ? response.data.recent_stock_entries : []);
      setAppliedRange({ startDate: selectedStartDate, endDate: selectedEndDate });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load dashboard summary');
      setSummary(null);
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
      const inviteToken = response.data?.invite?.invite_token || response.data?.invite_token || '';
      const inviteLink = inviteToken ? `${window.location.origin}/customer-invite/${inviteToken}` : (response.data?.invite_link || '');
      setCustomerInviteLink(inviteLink);
      setInviteVisible(true);
      window.setTimeout(() => setInviteVisible(false), 10000);
      setMessage('Customer invite link generated');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to generate customer invite link';
      setMessage(errorMessage);
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

      {customerInviteLink && inviteVisible && (
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
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h3 className="h5 mb-0">Performance graph</h3>
                <div className="text-muted small">Revenue and collection snapshot</div>
              </div>
              <div className="performance-graph">
                {chartKeys.map((item) => {
                  const value = Number(summary?.[item.key] || 0);
                  const maxValue = Math.max(totalAmount, totalPaidAmount, totalGeneratedAfterDiscount, totalDiscountAmount, 1);
                  const height = Math.max((value / maxValue) * 100, value > 0 ? 8 : 0);
                  return (
                    <div key={item.key} className="performance-bar-item">
                      <div className="performance-bar-label">{item.label}</div>
                      <div className="performance-bar-track">
                        <div className="performance-bar-fill" style={{ height: `${height}%` }} />
                      </div>
                      <div className="performance-bar-value">{formatINR(value)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="d-flex flex-wrap gap-3 mt-4">
                <div className="mini-stat"><span>Orders</span><strong>{Number(summary?.order_count || 0)}</strong></div>
                <div className="mini-stat"><span>Total amount</span><strong>{formatINR(totalAmount)}</strong></div>
                <div className="mini-stat"><span>Paid amount</span><strong>{formatINR(totalPaidAmount)}</strong></div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">Recent stock numbers</h3>
              <div className="stock-number-grid">
                {recentStockEntries.slice(0, 6).map((entry) => (
                  <div key={entry.stock_entry_id} className="stock-number-pill">
                    <div className="stock-number-title">{entry.product_name || 'Stock'}</div>
                    <strong>{Number(entry.units || 0)}</strong>
                  </div>
                ))}
                {recentStockEntries.length === 0 && (
                  <div className="text-muted">No stock entries yet</div>
                )}
              </div>
              <div className="mt-4 p-3 rounded-4 bg-light border">
                <div className="text-muted small">Recent stock count</div>
                <div className="fs-3 fw-semibold">{recentStockEntries.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
