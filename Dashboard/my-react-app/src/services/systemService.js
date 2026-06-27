import api from '../api/client';

export const fetchSystemSettings = () => api.get('/admin/settings');
export const saveSystemSetting = (key, payload) => api.post(`/admin/settings/${key}`, payload);

export const fetchThemes = () => api.get('/admin/themes');
export const saveThemeProfile = (key, payload) => api.post(`/admin/themes/${key}`, payload);
export const activateThemeProfile = (key) => api.post(`/admin/themes/${key}/activate`);
export const deleteThemeProfile = (key) => api.delete(`/admin/themes/${key}`);

export const fetchInvoiceTemplates = () => api.get('/admin/invoice-templates');
export const saveInvoiceTemplate = (key, payload) => api.post(`/admin/invoice-templates/${key}`, payload);
export const activateInvoiceTemplate = (key) => api.post(`/admin/invoice-templates/${key}/activate`);
export const deleteInvoiceTemplate = (key) => api.delete(`/admin/invoice-templates/${key}`);

export const fetchUsers = () => api.get('/admin/users');
export const updateUserRole = (userId, payload) => api.post(`/admin/users/${userId}/role`, payload);
export const fetchUserSessions = (userId) => api.get(`/admin/users/${userId}/sessions`);
export const fetchActivityLogs = (limit = 100) => api.get('/admin/activity-logs', { params: { limit } });

export const saveReminderSettings = (payload) => api.post('/admin/reminders', payload);
export const saveSupportSettings = (payload) => api.post('/admin/support-settings', payload);