import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const ProductList = ({ onEdit, onAddToCart, canManageProducts }) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [fromPrice, setFromPrice] = useState('');
  const [toPrice, setToPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      let url = '/';
      if (sortOrder) url = `/sort/${sortOrder}`;
      const response = await api.get(url);
      setProducts(response.data.data || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [sortOrder]);

  const handleSearch = async () => {
    if (!searchTerm) return fetchProducts();
    try {
      const response = await api.post('/search', { keyword: searchTerm });
      setProducts(response.data.data || response.data);
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
      fetchProducts();
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
    } catch (error) {
      const apiMessage = error.response?.data?.message || 'Error adding to cart';
      setMessage(typeof apiMessage === 'string' ? apiMessage : 'Error adding to cart');
    }
  };

  const handleFilter = async () => {
    try {
      const response = await api.post('/filter', {
        from: fromPrice,
        to: toPrice
      });
      setProducts(response.data.data || response.data);
    } catch (error) {
      console.error('Error filtering products:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container mt-5">
      <h2>Product Management</h2>
      {!canManageProducts && (
        <div className="alert alert-warning">
          You are logged in as a user. Create, update, and delete actions are admin only.
        </div>
      )}
      {message && <div className="alert alert-info">{message}</div>}

      <div className="row mb-4">
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search by category"
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
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="">Sort by Price</option>
            <option value="asc">Low to High</option>
            <option value="desc">High to Low</option>
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
                  Available: {product.available}
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
                      disabled={product.available != true}
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
    </div>
  );
};

export default ProductList;