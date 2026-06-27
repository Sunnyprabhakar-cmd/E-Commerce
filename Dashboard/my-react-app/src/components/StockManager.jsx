import { useEffect, useState } from 'react';
import { notify } from '../utils/notify';
import { createStockEntry, fetchAdminStock } from '../services/stockService';
import { fetchProducts, searchProducts } from '../services/productService';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import PageHeader from './common/PageHeader';
import SearchBar from './common/SearchBar';

const StockManager = () => {
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [units, setUnits] = useState('');
  const [notes, setNotes] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [, setMessageState] = useState('');
  const setMessage = (text) => {
    setMessageState(text);
    if (text) {
      notify(text);
    }
  };

  const fetchStockEntries = async () => {
    try {
      const stockResponse = await fetchAdminStock();
      setEntries(Array.isArray(stockResponse.data?.entries) ? stockResponse.data.entries : []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load stock data');
    }
  };

  const fetchProductPage = async ({ nextPage = 1, keyword = searchTerm, append = false } = {}) => {
    setLoadingProducts(true);
    try {
      const response = keyword.trim()
        ? await searchProducts(keyword.trim(), nextPage, 10)
        : await fetchProducts(nextPage, 10);
      const payload = response.data || {};
      const nextProducts = Array.isArray(payload.data) ? payload.data : [];
      setProducts((current) => (append ? [...current, ...nextProducts] : nextProducts));
      setPage(Number(payload.page || nextPage));
      setTotalPages(Number(payload.totalPages || 1));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load products');
      if (!append) {
        setProducts([]);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProductPage({ nextPage: 1, keyword: '', append: false });
    fetchStockEntries();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput);
      fetchProductPage({ nextPage: 1, keyword: searchInput, append: false });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const selectedProduct = products.find((product) => String(product.id) === String(selectedProductId));

  const loadMore = async () => {
    if (loadingProducts || page >= totalPages) return;
    await fetchProductPage({ nextPage: page + 1, keyword: searchTerm, append: true });
  };

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
      await createStockEntry({
        product_id: String(selectedProductId),
        units: value,
        notes,
      });
      setMessage('Stock entry saved successfully');
      setUnits('');
      setNotes('');
      await fetchStockEntries();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save stock entry');
    }
  };

  return (
    <div className="container mt-4">
      <PageHeader
        kicker="Stock"
        title="Stock Management"
        description="Search products, record daily uploads, and review history in one place."
      />

      <div className="row g-4 mt-1">
        <div className="col-lg-5">
          <AppCard title="Daily Stock Upload" subtitle="Search a product, enter the units made, and save a dated stock record." className="h-100">
            <SearchBar
              open={showSearch}
              value={searchInput}
              placeholder="Search by name, SKU, barcode, product ID, or category"
              onToggle={() => setShowSearch((prev) => !prev)}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <div className="list-group mb-3 stock-product-list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {products.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`list-group-item list-group-item-action ${String(selectedProductId) === String(product.id) ? 'active' : ''}`}
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold">{product.name}</div>
                      <div className="small opacity-75">
                        ID: {product.id} · {product.sku || 'no SKU'} · {product.barcode || 'no barcode'} · {product.category}
                      </div>
                    </div>
                    <span className="badge bg-light text-dark">{Number(product.piece || 0)} in stock</span>
                  </div>
                </button>
              ))}
              {products.length === 0 && !loadingProducts && <EmptyState title="No products found" description="Try a different search term." />}
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="small text-muted">{loadingProducts ? 'Searching...' : `Page ${page} of ${totalPages}`}</div>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={loadMore} disabled={loadingProducts || page >= totalPages}>
                {page >= totalPages ? 'No more results' : 'Load more'}
              </button>
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
          </AppCard>
        </div>

        <div className="col-lg-7">
          <AppCard title="Stock History" subtitle="Daily uploads and recorded inventory changes." className="h-100">
            <div className="d-flex justify-content-end mb-3">
              <button className="btn btn-outline-secondary btn-sm" onClick={fetchStockEntries}>Refresh</button>
            </div>
            <div className="table-responsive stock-history-table" style={{ maxHeight: '620px' }}>
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
          </AppCard>
        </div>
      </div>
    </div>
  );
};

export default StockManager;
