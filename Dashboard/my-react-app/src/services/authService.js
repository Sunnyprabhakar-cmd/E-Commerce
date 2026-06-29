import api from '../api/client';

export const login = (payload) => api.post('/login', payload);
export const register = (payload) => api.post('/register', payload);
export const refreshAuthToken = (payload) => api.post('/auth/refresh', payload);
export const changeAccountPassword = (payload) => api.post('/balanceCredit', payload);
export const requestPasswordReset = (payload) => api.post('/auth/password-reset/request', payload);
export const verifyPasswordResetToken = (token) => api.get(`/auth/password-reset/${token}`);
export const confirmPasswordReset = (payload) => api.post('/auth/password-reset/confirm', payload);
