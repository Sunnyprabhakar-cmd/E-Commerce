import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ProductList = ({ onEdit, canManageProducts, onCartChange }) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [fromPrice, setFromPrice] = useState('');
  const [toPrice, setToPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeMode, setActiveMode] = useState('list');
  const [pageSize, setPageSize] = useState(25);

  const applyPageResult = (payload) => {
    const responseData = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
    const items = Array.isArray(responseData?.data)
      ? responseData.data
      : (Array.isArray(responseData) ? responseData : []);
    setProducts(items);
    setCurrentPage(Number(responseData?.page || 1));
    setTotalPages(Number(responseData?.totalPages || 1));
  };

  const fetchProducts = useCallback(async (page = 1, mode = activeMode, limit = pageSize) => {
    try {
      setLoading(true);
      const params = { page, limit };
      let response;

      if (mode === 'search' && searchTerm.trim()) {
        response = await api.post(`/search?page=${page}&limit=${limit}`, { keyword: searchTerm.trim() });
      } else if (mode === 'filter' && (fromPrice !== '' || toPrice !== '')) {
        response = await api.post(`/filter?page=${page}&limit=${limit}`, {
          from: fromPrice,
          to: toPrice
        });
      } else if (mode === 'sort' && sortOrder) {
        response = await api.get(`/sort/${sortOrder}`, { params });
      } else {
        response = await api.get('/', { params });
      }

      applyPageResult(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [activeMode, fromPrice, pageSize, searchTerm, sortOrder, toPrice]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setActiveMode('list');
      return fetchProducts(1, 'list', pageSize);
    }
    try {
      setActiveMode('search');
      const response = await api.post(`/search?page=1&limit=${pageSize}`, { keyword: searchTerm.trim() });
      applyPageResult(response.data);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!canManageProducts) {
      setMessage('Only admin can delete products.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete('/', { data: { id } });
      setMessage('Product deleted successfully.');
      fetchProducts(currentPage, activeMode, pageSize);
    } catch (error) {
      const apiMessage = error.response?.data?.message || error.response?.data;
      setMessage(typeof apiMessage === 'string' ? apiMessage : 'Error deleting product');
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
    } catch (error) {
      const apiMessage = error.response?.data?.message || 'Error adding to cart';
      setMessage(typeof apiMessage === 'string' ? apiMessage : 'Error adding to cart');
    }
  };

  const handleFilter = async () => {
    try {
      setActiveMode('filter');
      const response = await api.post(`/filter?page=1&limit=${pageSize}`, {
        from: fromPrice,
        to: toPrice
      });
      applyPageResult(response.data);
    } catch (error) {
      console.error('Error filtering products:', error);
    }
  };

  const handleSortChange = async (value) => {
    setSortOrder(value);

    if (!value) {
      setActiveMode('list');
      return fetchProducts(1, 'list', pageSize);
    }

    setActiveMode('sort');
    try {
      const response = await api.get(`/sort/${value}`, { params: { page: 1, limit: pageSize } });
      applyPageResult(response.data);
    } catch (error) {
      console.error('Error sorting products:', error);
    }
  };

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages || 1);
    if (nextPage === currentPage) {
      return;
    }
    fetchProducts(nextPage, activeMode, pageSize);
  };

  useEffect(() => {
    fetchProducts(1, 'list', pageSize);
    // Intentionally run only once on mount; subsequent reloads are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container mt-5">
      <h2>Product Management</h2>
      {message && <div className="alert alert-info">{message}</div>}

      <div className="row mb-4">
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search by product name, category, or id"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-1">
          <button className="btn btn-primary w-100" onClick={handleSearch}>
            Search
          </button>
        </div>
        <div className="col-md-2">
          <input
            type="number"
            className="form-control"
            placeholder="From Price"
            value={fromPrice}
            onChange={(e) => setFromPrice(e.target.value)}
            min="0"
          />
        </div>
        <div className="col-md-2">
          <input
            type="number"
            className="form-control"
            placeholder="To Price"
            value={toPrice}
            onChange={(e) => setToPrice(e.target.value)}
            min="0"
          />
        </div>
        <div className="col-md-1">
          <button className="btn btn-secondary w-100" onClick={handleFilter}>
            Filter
          </button>
        </div>
        <div className="col-md-2">
          <select
            className="form-select"
            value={sortOrder}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="">Sort by Price</option>
            <option value="asc">Low to High</option>
            <option value="desc">High to Low</option>
          </select>
        </div>
        <div className="col-md-2">
          <select
            className="form-select"
            value={pageSize}
            onChange={(e) => {
              const nextPageSize = Number(e.target.value);
              setPageSize(nextPageSize);
              fetchProducts(1, activeMode, nextPageSize);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
        {canManageProducts && (
          <div className="col-md-2">
            <button className="btn btn-success w-100" onClick={() => onEdit(null)}>
              Add Product
            </button>
          </div>
        )}
      </div>

      <div className="row">
        {products.map((product) => (
          <div key={product.id} className="col-md-4 mb-4">
            <div className="card h-100">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title">{product.name}</h5>
                <p className="card-text flex-grow-1">
                  Category: {product.category}<br />
                  Piece:{product.piece}<br />
                  Price: ₹{product.price}<br />
                  Available: {product.availability?"Yes":"No"}
                </p>
                <div className="btn-group w-100">
                  {canManageProducts && (
                    <>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => onEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(product.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {!canManageProducts && (
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={product.availability != true}
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-2">
        <div className="text-muted">
          Page {currentPage} of {totalPages || 1}
        </div>
        <div className="btn-group" role="group" aria-label="Product pagination controls">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductList;