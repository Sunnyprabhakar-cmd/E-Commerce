import api from '../api/client';

export const fetchOrders = (endpoint) => api.get(endpoint);
export const cancelOrder = (payload) => api.post('/cancelOrder', payload);
export const addProductToCart = (payload) => api.post('/addProductInCart', payload);
export const adminOrderAction = (payload) => api.post('/admin/orderAction', payload);
export const fetchOrderActions = (orderId) => api.get(`/admin/orderActions/${orderId}`);
