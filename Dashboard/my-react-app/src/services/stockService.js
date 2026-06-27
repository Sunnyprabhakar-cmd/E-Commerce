import api from '../api/client';

export const fetchStockList = () => api.get('/');
export const fetchAdminStock = () => api.get('/admin/stock');
export const createStockEntry = (payload) => api.post('/admin/stock', payload);
