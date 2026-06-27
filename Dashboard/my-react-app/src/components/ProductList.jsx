import { useState } from 'react';
import { formatINR } from '../utils/currency';
import { notify } from '../utils/notify';
import { HiOutlineArrowPath, HiOutlinePlus, HiOutlineArrowsUpDown } from 'react-icons/hi2';
import AppCard from './common/AppCard';
import EmptyState from './common/EmptyState';
import FilterPanel from './common/FilterPanel';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import SearchBar from './common/SearchBar';
import useProducts from '../hooks/useProducts';
import { addProductToCart } from '../services/productService';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ProductList = ({ onEdit, canManageProducts, onCartChange }) => {
  const {
    products,
    loading,
    searchTerm,
    setSearchTerm,
    sortOrder,
    setSortOrder,
    fromPrice,
    setFromPrice,
    toPrice,
    setToPrice,
    currentPage,
    totalPages,
    activeMode,
    pageSize,
    setPageSize,
    handleSearch,
    handleFilter,
    handleResetFilters,
    handleSortChange,
    refresh,
    goToPage,
    deleteItem,
    loadProducts,
  } = useProducts({ pageSize: 25, initialSortOrder: 'asc' });
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleDelete = async (id) => {
    if (!canManageProducts) {
      notify('Only admin can delete products.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteItem(id);
      notify('Product deleted successfully.');
      refresh();
    } catch (error) {
      const apiMessage = error.response?.data?.message || error.response?.data;
      notify(typeof apiMessage === 'string' ? apiMessage : 'Error deleting product');
    }
  };

  const handleAddToCart = async (productId) => {
    try {
      await addProductToCart(productId, 1);
      notify('Product added to cart!');
      onCartChange && onCartChange();
    } catch (error) {
      const apiMessage = error.response?.data?.message || 'Error adding to cart';
      notify(typeof apiMessage === 'string' ? apiMessage : 'Error adding to cart');
    }
  };

  if (loading) return <LoadingSpinner className="mt-5" />;

  return (
    <div className="container mt-5">
      <PageHeader
        kicker="Products"
        title="Product catalog"
        description="Search, filter, sort, and manage your inventory from one table-first workspace."
      />

      <AppCard className="mt-4 product-toolbar-card" title="Controls" subtitle="Use search, filters, and sorting to narrow the product list.">
        <div className="toolbar-actions toolbar-actions-main">
          <button type="button" className="toolbar-button" onClick={refresh}>
            <HiOutlineArrowPath />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className={`toolbar-button icon-toggle ${sortOrder === 'asc' ? 'active' : ''}`}
            onClick={() => handleSortChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <HiOutlineArrowsUpDown />
            <span>Sort by ID {sortOrder === 'asc' ? '↑' : '↓'}</span>
          </button>
          {canManageProducts && (
            <button type="button" className="toolbar-button primary" onClick={() => onEdit(null)}>
              <HiOutlinePlus />
              <span>Add Product</span>
            </button>
          )}
          <SearchBar
            open={showSearch}
            value={searchTerm}
            placeholder="Search by product name, category, or id"
            onToggle={() => setShowSearch((prev) => !prev)}
            onChange={(e) => setSearchTerm(e.target.value)}
            onSearch={handleSearch}
          />

          <FilterPanel
            open={showFilters}
            onToggle={() => setShowFilters((prev) => !prev)}
            onApply={handleFilter}
            onReset={handleResetFilters}
            title="Filter"
          >
            <input
              type="number"
              className="form-control toolbar-input"
              placeholder="From Price"
              value={fromPrice}
              onChange={(e) => setFromPrice(e.target.value)}
              min="0"
            />
            <input
              type="number"
              className="form-control toolbar-input"
              placeholder="To Price"
              value={toPrice}
              onChange={(e) => setToPrice(e.target.value)}
              min="0"
            />
            <select
              className="form-select toolbar-input"
              value={pageSize}
              onChange={(e) => {
                const nextPageSize = Number(e.target.value);
                setPageSize(nextPageSize);
                loadProducts(1, activeMode, nextPageSize);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </FilterPanel>
        </div>
      </AppCard>

      <div className="row mt-4">
        {products.map((product) => (
          <div key={product.id} className="col-12 mb-3">
            <div className="card h-100 product-row-card">
              <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-md-center">
                <div className="product-thumb">
                  <div className="product-thumb-inner">{String(product.name || '').slice(0, 1).toUpperCase()}</div>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                    <h5 className="card-title mb-0">{product.name}</h5>
                    <span className="badge text-bg-warning">ID: {product.id}</span>
                  </div>
                  <div className="product-meta">
                    <span>Category: {product.category}</span>
                    <span>Piece: {product.piece}</span>
                    <span>Price: {formatINR(product.price)}</span>
                    <span>Available: {product.availability ? 'Yes' : 'No'}</span>
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap justify-content-md-end">
                  {canManageProducts && (
                    <>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => onEdit(product)}>Edit</button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(product.id)}>Delete</button>
                    </>
                  )}
                  {!canManageProducts && (
                    <button
                      className="btn btn-primary btn-sm"
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
        {products.length === 0 && (
          <div className="col-12">
            <EmptyState title="No products found" description="Try adjusting your search or filters." />
          </div>
        )}
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
