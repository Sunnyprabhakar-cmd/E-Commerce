import api from '../api/client';

export const fetchAdminSummary = (params = {}) => api.get('/admin/summary', { params });
export const createCustomerInvite = (payload = {}) => api.post('/admin/customer-invites', payload);
export const fetchEmployees = () => api.get('/admin/employees');
export const fetchSalarySummary = (params = {}) => api.get('/admin/salary-summary', { params });
export const fetchEmployeeSalaryHistory = (employeeId) => api.get(`/admin/employees/${employeeId}/salary`);
export const saveEmployeeProfile = (employeeId, payload) => api.post(`/admin/employees/${employeeId}/profile`, payload);
export const saveEmployeePermissions = (employeeId, payload) => api.post(`/admin/employees/${employeeId}/permissions`, payload);
export const adjustEmployeeSalary = (employeeId, payload) => api.post(`/admin/employees/${employeeId}/salary`, payload);
export const generateEmployeeInvite = (employeeId, payload = {}) => api.post(`/admin/employees/${employeeId}/invite`, payload);
export const deleteEmployeeProfile = (employeeId) => api.delete(`/admin/employees/${employeeId}`);
