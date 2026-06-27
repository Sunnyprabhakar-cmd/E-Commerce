import api from '../api/client';

export const fetchAvailableBalance = () => api.get('/avlBalance');
export const creditBalance = (payload) => api.post('/balanceCredit', payload);
