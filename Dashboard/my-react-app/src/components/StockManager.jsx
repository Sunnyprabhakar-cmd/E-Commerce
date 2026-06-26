import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const StockManager = () => {
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [units, setUnits] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const [productResponse, stockResponse] = await Promise.all([
        api.get('/'),
        api.get('/admin/stock'),
      ]);
      setProducts(Array.isArray(productResponse.data?.data) ? productResponse.data.data : (Array.isArray(productResponse.data) ? productResponse.data : []));
      setEntries(Array.isArray(stockResponse.data?.entries) ? stockResponse.data.entries : []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load stock data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return products;
    }
    return products.filter((product) => {
      const haystack = [product.id, product.name, product.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [products, searchTerm]);

  const selectedProduct = products.find((product) => String(product.id) === String(selectedProductId));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProductId) {
      setMessage('Select a product first');
      return;
    }
    const value = Number(units);
    if (!Number.isInteger(value) || value <= 0) {
      setMessage('Enter a valid unit count');
      return;
    }

    try {
      await api.post('/admin/stock', {
        product_id: String(selectedProductId),
        units: value,
        notes,
      });
      setMessage('Stock entry saved successfully');
      setUnits('');
      setNotes('');
      await fetchData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save stock entry');
    }
  };

  return (
    <div className="container mt-4">
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h3 className="card-title mb-2">Daily Stock Upload</h3>
              <p className="text-muted">Search a product, enter the units made, and save a dated stock record.</p>
              {message && <div className="alert alert-info">{message}</div>}
              <input
                type="search"
                className="form-control mb-3"
                placeholder="Search product by name, id, or category"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <div className="list-group mb-3" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className={`list-group-item list-group-item-action ${String(selectedProductId) === String(product.id) ? 'active' : ''}`}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{product.name}</div>
                        <div className="small opacity-75">ID: {product.id} · {product.category}</div>
                      </div>
                      <span className="badge bg-light text-dark">{Number(product.piece || 0)} in stock</span>
                    </div>
                  </button>
                ))}
              </div>
              <form onSubmit={handleSubmit} className="d-grid gap-3">
                <div>
                  <label className="form-label">Selected Product</label>
                  <input className="form-control" value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.id})` : ''} readOnly placeholder="Select a product from the list" />
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Units Made</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      value={units}
                      onChange={(event) => setUnits(event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Save Stock Entry</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="card-title mb-0">Stock History</h3>
                <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>Refresh</button>
              </div>
              <div className="table-responsive" style={{ maxHeight: '620px' }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Recorded By</th>
                      <th>Date / Time</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.stock_entry_id}>
                        <td>{entry.product_name}</td>
                        <td>{entry.units}</td>
                        <td>{entry.recorded_by_name || entry.recorded_by_user_id || 'N/A'}</td>
                        <td>{entry.recorded_at ? new Date(entry.recorded_at).toLocaleString() : 'N/A'}</td>
                        <td>{entry.notes || '—'}</td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">No stock entries yet</td>
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

export default StockManager;
