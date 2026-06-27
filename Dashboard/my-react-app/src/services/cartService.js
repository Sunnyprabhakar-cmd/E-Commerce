import api from '../api/client';

export const fetchAvailableBalance = () => api.get('/avlBalance');
export const fetchCartInfo = () => api.get('/cartInfo');
export const addProductToCart = (payload) => api.post('/addProductInCart', payload);
export const deleteProductFromCart = (payload) => api.post('/deleteProductFromCart', payload);
export const updateCart = (payload) => api.post('/updateCart', payload);
export const afterOrder = (payload) => api.post('/afterOrder', payload);
export const placeOrder = (payload) => api.post('/placeOrder', payload);
export const creditBalance = (payload) => api.post('/balanceCredit', payload);
