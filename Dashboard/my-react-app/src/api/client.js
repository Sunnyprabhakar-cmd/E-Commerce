import axios from 'axios';

const resolveBaseURL = () => {
  const configuredBaseURL = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseURL) {
    return configuredBaseURL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
};

const api = axios.create({
  baseURL: resolveBaseURL()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return Promise.reject(error);
    }

    try {
      const refreshResponse = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const nextToken = refreshResponse.data?.token;
      if (!nextToken) {
        return Promise.reject(error);
      }
      localStorage.setItem('token', nextToken);
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return Promise.reject(refreshError);
    }
  }
);

export default api;
