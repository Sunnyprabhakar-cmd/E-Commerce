import { useMemo, useState } from 'react';
import { notify } from '../utils/notify';
import { HiOutlineArrowPath, HiOutlinePlus } from 'react-icons/hi2';
import { HiOutlineCheck } from 'react-icons/hi2';
import OverflowMenu from './common/OverflowMenu';
import EmptyState from './common/EmptyState';
import FilterPanel from './common/FilterPanel';
import LoadingSpinner from './common/LoadingSpinner';
import PageHeader from './common/PageHeader';
import PageContainer from './common/PageContainer';
import SearchBar from './common/SearchBar';
import SortMenu from './common/SortMenu';
import Toolbar from './common/Toolbar';
import ToolbarButton from './common/ToolbarButton';
import ProductCard from './common/ProductCard';
import useProducts from '../hooks/useProducts';
import { addProductToCart } from '../services/productService';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ProductList = ({ onEdit, canManageProducts, onCartChange }) => {
  const {
    products,
    loading,
    searchTerm,
    setSearchTerm,
    currentPage,
    totalPages,
    pageSize,
    setPageSize,
    refresh,
    goToPage,
    deleteItem,
    loadProducts,
    handleSearch,
  } = useProducts({ pageSize: 25, initialSortOrder: 'asc' });
  const [activePanel, setActivePanel] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [minPiecesFilter, setMinPiecesFilter] = useState('');
  const [maxPiecesFilter, setMaxPiecesFilter] = useState('');
  const [sortOption, setSortOption] = useState('recent');

  const categoryOptions = useMemo(() => {
    const categories = products
      .map((product) => String(product.category || '').trim())
      .filter(Boolean);
    return ['all', ...Array.from(new Set(categories)).sort((left, right) => left.localeCompare(right))];
  }, [products]);

  const displayProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const minPrice = minPriceFilter === '' ? null : Number(minPriceFilter);
    const maxPrice = maxPriceFilter === '' ? null : Number(maxPriceFilter);
    const minPieces = minPiecesFilter === '' ? null : Number(minPiecesFilter);
    const maxPieces = maxPiecesFilter === '' ? null : Number(maxPiecesFilter);

    let nextProducts = products.filter((product) => {
      const productName = String(product.name || '').toLowerCase();
      const productCategory = String(product.category || '').toLowerCase();
      const productId = String(product.id || '').toLowerCase();
      const priceText = String(product.price ?? '').toLowerCase();
      const availabilityText = product.availability ? 'available' : 'out of stock';

      const matchesKeyword = !keyword || [productName, productCategory, productId, priceText, availabilityText].some((value) => value.includes(keyword));
      const matchesCategory = categoryFilter === 'all' || productCategory === categoryFilter.toLowerCase();
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && Boolean(product.availability)) ||
        (availabilityFilter === 'out' && !product.availability);
      const priceValue = Number(product.price || 0);
      const pieceValue = Number(product.piece || 0);
      const matchesMinPrice = minPrice == null || Number.isNaN(minPrice) || priceValue >= minPrice;
      const matchesMaxPrice = maxPrice == null || Number.isNaN(maxPrice) || priceValue <= maxPrice;
      const matchesMinPieces = minPieces == null || Number.isNaN(minPieces) || pieceValue >= minPieces;
      const matchesMaxPieces = maxPieces == null || Number.isNaN(maxPieces) || pieceValue <= maxPieces;

      return matchesKeyword && matchesCategory && matchesAvailability && matchesMinPrice && matchesMaxPrice && matchesMinPieces && matchesMaxPieces;
    });

    nextProducts = [...nextProducts].sort((left, right) => {
      if (sortOption === 'name-asc') {
        return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' });
      }
      if (sortOption === 'name-desc') {
        return String(right.name || '').localeCompare(String(left.name || ''), undefined, { sensitivity: 'base' });
      }
      if (sortOption === 'price-asc') {
        return Number(left.price || 0) - Number(right.price || 0);
      }
      if (sortOption === 'price-desc') {
        return Number(right.price || 0) - Number(left.price || 0);
      }
      if (sortOption === 'availability') {
        return Number(Boolean(right.availability)) - Number(Boolean(left.availability));
      }

      const leftCreated = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightCreated = right.created_at ? new Date(right.created_at).getTime() : 0;
      if (leftCreated !== rightCreated) {
        return rightCreated - leftCreated;
      }
      return String(right.id || '').localeCompare(String(left.id || ''), undefined, { numeric: true, sensitivity: 'base' });
    });

    return nextProducts;
  }, [availabilityFilter, categoryFilter, maxPiecesFilter, maxPriceFilter, minPiecesFilter, minPriceFilter, products, searchTerm, sortOption]);

  const closePanels = () => {
    setActivePanel(null);
  };

  const togglePanel = (panelName) => (nextOpen) => {
    setActivePanel(nextOpen ? panelName : null);
  };

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

  const handleSearchToggle = togglePanel('search');
  const handleFilterToggle = togglePanel('filter');
  const handleSortToggle = togglePanel('sort');
  const handleOverflowToggle = togglePanel('overflow');

  const resetFilters = () => {
    setCategoryFilter('all');
    setAvailabilityFilter('all');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    setMinPiecesFilter('');
    setMaxPiecesFilter('');
    setSortOption('recent');
  };

  if (loading) return <LoadingSpinner className="mt-5" />;

  const toolbarActions = (
    <div className="product-toolbar-actions">
      <ToolbarButton icon={<HiOutlineArrowPath />} onClick={() => { closePanels(); refresh(); }} label="Refresh products">Refresh</ToolbarButton>
      {canManageProducts && (
        <ToolbarButton icon={<HiOutlinePlus />} variant="secondary" onClick={() => { closePanels(); onEdit(null); }} label="Add Product">Add Product</ToolbarButton>
      )}
      <SearchBar
        open={activePanel === 'search'}
        value={searchTerm}
        placeholder="Search by name, category, ID, price, or availability"
        onToggle={handleSearchToggle}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSearch={handleSearch}
      />
      <SortMenu open={activePanel === 'sort'} onToggle={handleSortToggle} label="Sort products">
        {[
          ['recent', 'Recently Added'],
          ['name-asc', 'Name A → Z'],
          ['name-desc', 'Name Z → A'],
          ['price-asc', 'Price Low → High'],
          ['price-desc', 'Price High → Low'],
          ['availability', 'Availability'],
        ].map(([value, label]) => (
          <ToolbarButton
            key={value}
            active={sortOption === value}
            icon={sortOption === value ? <HiOutlineCheck /> : null}
            onClick={() => { setSortOption(value); closePanels(); }}
          >
            {label}
          </ToolbarButton>
        ))}
      </SortMenu>
      <FilterPanel
        open={activePanel === 'filter'}
        onToggle={handleFilterToggle}
        onApply={closePanels}
        onReset={() => {
          resetFilters();
          closePanels();
        }}
        title="Filter"
      >
        <select className="form-select toolbar-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categoryOptions.filter((option) => option !== 'all').map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select className="form-select toolbar-input" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
          <option value="all">All availability</option>
          <option value="available">Available</option>
          <option value="out">Out of stock</option>
        </select>
        <input type="number" className="form-control toolbar-input" placeholder="Min price" value={minPriceFilter} onChange={(e) => setMinPriceFilter(e.target.value)} min="0" />
        <input type="number" className="form-control toolbar-input" placeholder="Max price" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} min="0" />
        <input type="number" className="form-control toolbar-input" placeholder="Min pieces" value={minPiecesFilter} onChange={(e) => setMinPiecesFilter(e.target.value)} min="0" />
        <input type="number" className="form-control toolbar-input" placeholder="Max pieces" value={maxPiecesFilter} onChange={(e) => setMaxPiecesFilter(e.target.value)} min="0" />
      </FilterPanel>
    </div>
  );

  const mobileActions = (
    <>
      <SearchBar
        open={activePanel === 'search'}
        value={searchTerm}
        placeholder="Search products..."
        onToggle={handleSearchToggle}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSearch={handleSearch}
      />
      <OverflowMenu
        open={activePanel === 'overflow'}
        onToggle={handleOverflowToggle}
        label="More actions"
        items={[
          { label: 'Refresh', icon: <HiOutlineArrowPath />, onClick: refresh },
          ...(canManageProducts ? [{ label: 'Add Product', icon: <HiOutlinePlus />, onClick: () => onEdit(null) }] : []),
          { label: 'Sort', icon: <HiOutlineArrowPath />, onClick: () => setActivePanel('sort') },
          { label: 'Filter', icon: <HiOutlineArrowPath />, onClick: () => setActivePanel('filter') },
        ]}
      />
    </>
  );

  return (
    <PageContainer className="mt-5">
      <PageHeader
        kicker="Products"
        title="Product catalog"
        description="Search, filter, sort, and manage your inventory from one table-first workspace."
      />

      <Toolbar
        className="mt-4 product-toolbar-card"
        kicker="Controls"
        title="Product workspace"
        description="Use search, filters, and sorting to narrow the product list."
        actions={toolbarActions}
        mobileActions={mobileActions}
        onSearchShortcut={() => setActivePanel((current) => (current === 'search' ? null : 'search'))}
        onRefreshShortcut={refresh}
        onClosePanels={() => {
          closePanels();
        }}
      />

      <div className="row mt-4 g-3 product-catalog-grid">
        {displayProducts.map((product) => (
          <div key={product.id} className="col-12 mb-3">
            <ProductCard
              product={product}
              canManageProducts={canManageProducts}
              onEdit={onEdit}
              onDelete={handleDelete}
              onAddToCart={handleAddToCart}
            />
          </div>
        ))}
        {displayProducts.length === 0 && (
          <div className="col-12">
            <EmptyState title="No products found" description="Try adjusting your search, sort, or filters." />
          </div>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-3 product-pagination-bar">
        <div className="text-muted">
          Page {currentPage} of {totalPages || 1}
        </div>
        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-end">
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Page size</span>
            <select
              className="form-select form-select-sm product-page-size-select"
              value={pageSize}
              onChange={(e) => {
                const nextPageSize = Number(e.target.value);
                setPageSize(nextPageSize);
                loadProducts(1, 'sort', nextPageSize);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
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
    </PageContainer>
  );
};

export default ProductList;
