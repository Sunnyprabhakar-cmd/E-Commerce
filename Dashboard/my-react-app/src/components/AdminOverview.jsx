import { useEffect, useState } from 'react';
import api from '../api/client';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const AdminOverview = ({ onNavigate }) => {
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');

  const fetchSummary = async () => {
    try {
      const response = await api.get('/admin/summary');
      setSummary(response.data?.summary || null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load dashboard summary');
      setSummary(null);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const totalAmount = Number(summary?.total_amount || 0);
  const totalPaidAmount = Number(summary?.total_paid_amount || 0);
  const totalGeneratedAfterDiscount = Number(summary?.total_generated_after_discount || 0);
  const totalDiscountAmount = Number(summary?.total_discount_amount || 0);

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="mb-1">Admin Overview</h2>
          <p className="text-muted mb-0">At-a-glance order value and payment totals.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-primary" onClick={fetchSummary}>Refresh</button>
          {onNavigate && <button className="btn btn-primary" onClick={() => onNavigate('stock')}>Open Stock</button>}
          {onNavigate && <button className="btn btn-outline-dark" onClick={() => onNavigate('employees')}>Open Employees</button>}
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

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
    </div>
  );
};

export default AdminOverview;
