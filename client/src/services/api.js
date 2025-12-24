import axios from 'axios';

// API URL Configuration
// In production, API is on the same origin (unified deployment)
// The key is to detect if we're on HTTPS
const getApiBaseUrl = () => {
    // Check if explicitly set via environment
    if (import.meta.env.VITE_API_URL) {
        return `${import.meta.env.VITE_API_URL}/api`;
    }

    // In production OR if running on HTTPS, use relative path (same origin)
    if (import.meta.env.PROD || window.location.protocol === 'https:') {
        return '/api';
    }

    // For local development only (HTTP on localhost)
    const API_HOST = window.location.hostname;
    const API_PORT = 5000;
    return `http://${API_HOST}:${API_PORT}/api`;
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for handling auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Check if session expired or user deleted
            if (error.response?.data?.sessionExpired || error.response?.data?.deleted) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
