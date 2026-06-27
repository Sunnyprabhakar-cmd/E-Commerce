import { useCallback, useEffect, useState } from 'react';
import { deleteProduct, filterProducts, fetchProducts, searchProducts, sortProducts } from '../services/productService';

const useProducts = ({ pageSize: initialPageSize = 25, initialSortOrder = 'asc' } = {}) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [fromPrice, setFromPrice] = useState('');
  const [toPrice, setToPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeMode, setActiveMode] = useState('list');
  const [pageSize, setPageSize] = useState(initialPageSize);

  const applyPageResult = useCallback((payload) => {
    const responseData = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
    const items = Array.isArray(responseData?.data)
      ? responseData.data
      : (Array.isArray(responseData) ? responseData : []);
    setProducts(items);
    setCurrentPage(Number(responseData?.page || 1));
    setTotalPages(Number(responseData?.totalPages || 1));
  }, []);

  const loadProducts = useCallback(async (page = 1, mode = activeMode, limit = pageSize) => {
    setLoading(true);
    try {
      let response;
      if (mode === 'search' && searchTerm.trim()) {
        response = await searchProducts(searchTerm.trim(), page, limit);
      } else if (mode === 'filter' && (fromPrice !== '' || toPrice !== '')) {
        response = await filterProducts(fromPrice, toPrice, page, limit);
      } else if (mode === 'sort' && sortOrder) {
        response = await sortProducts(sortOrder, page, limit);
      } else {
        response = await fetchProducts(page, limit);
      }

      applyPageResult(response.data);
    } finally {
      setLoading(false);
    }
  }, [activeMode, applyPageResult, fromPrice, pageSize, searchTerm, sortOrder, toPrice]);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setActiveMode('list');
      return loadProducts(1, 'list', pageSize);
    }
    setActiveMode('search');
    const response = await searchProducts(searchTerm.trim(), 1, pageSize);
    applyPageResult(response.data);
  }, [applyPageResult, loadProducts, pageSize, searchTerm]);

  const handleFilter = useCallback(async () => {
    setActiveMode('filter');
    const response = await filterProducts(fromPrice, toPrice, 1, pageSize);
    applyPageResult(response.data);
  }, [applyPageResult, fromPrice, pageSize, toPrice]);

  const handleResetFilters = useCallback(async () => {
    setFromPrice('');
    setToPrice('');
    setActiveMode('list');
    await loadProducts(1, 'list', pageSize);
  }, [loadProducts, pageSize]);

  const handleSortChange = useCallback(async (value) => {
    setSortOrder(value);
    if (!value) {
      setActiveMode('list');
      return loadProducts(1, 'list', pageSize);
    }
    setActiveMode('sort');
    const response = await sortProducts(value, 1, pageSize);
    applyPageResult(response.data);
  }, [applyPageResult, loadProducts, pageSize]);

  const refresh = useCallback(() => loadProducts(currentPage, activeMode, pageSize), [activeMode, currentPage, loadProducts, pageSize]);
  const goToPage = useCallback((page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages || 1);
    if (nextPage === currentPage) return;
    loadProducts(nextPage, activeMode, pageSize);
  }, [activeMode, currentPage, loadProducts, pageSize, totalPages]);

  const deleteItem = useCallback(async (id) => deleteProduct(id), []);

  useEffect(() => {
    loadProducts(1, 'sort', pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
    setActiveMode,
    loadProducts,
    handleSearch,
    handleFilter,
    handleResetFilters,
    handleSortChange,
    refresh,
    goToPage,
    deleteItem,
    applyPageResult,
  };
};

export default useProducts;
