import axios from 'axios';

// API URL Configuration for Render deployment
// In production (Render), set VITE_API_URL environment variable to your backend URL
// Example: VITE_API_URL=https://your-backend-name.onrender.com
const getApiBaseUrl = () => {
    // If VITE_API_URL is set (production), use it
    if (import.meta.env.VITE_API_URL) {
        return `${import.meta.env.VITE_API_URL}/api`;
    }

    // For local development, use same hostname with port 5000
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
