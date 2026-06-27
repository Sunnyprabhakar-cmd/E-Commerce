import api from '../api/client';

export const login = (payload) => api.post('/login', payload);
export const register = (payload) => api.post('/register', payload);
export const refreshAuthToken = (payload) => api.post('/auth/refresh', payload);
