import api from '../api/client';

export const fetchProducts = (page = 1, limit = 25) => api.get('/', { params: { page, limit } });
export const searchProducts = (keyword, page = 1, limit = 25) => api.post(`/search?page=${page}&limit=${limit}`, { keyword });
export const filterProducts = (from, to, page = 1, limit = 25) => api.post(`/filter?page=${page}&limit=${limit}`, { from, to });
export const sortProducts = (sortOrder, page = 1, limit = 25) => api.get(`/sort/${sortOrder}`, { params: { page, limit } });
export const deleteProduct = (id) => api.delete('/', { data: { id } });
export const addProductToCart = (product_id, quantity = 1) => api.post('/addProductInCart', { product_id, quantity });
export const createProduct = (formData) => api.post('/', formData);
export const updateProduct = (id, formData) => api.post(`/update/${id}`, formData);
