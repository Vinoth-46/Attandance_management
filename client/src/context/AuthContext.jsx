import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const useLogout = () => {
    const { logout } = useAuth();
    return logout;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch fresh user data from server
    const refreshUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            // Use dynamic URL logic or import api service (if possible, but keep self-contained here for safety)
            const API_URL = `http://${window.location.hostname}:5000/api/auth/profile`;

            const { data } = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
        } catch (error) {
            console.error("Failed to refresh user:", error);
            // If 401, logout
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (token) {
                // Optimistically load stored user first for speed
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch (e) { console.error(e); }
                }
                // Then fetch fresh data
                await refreshUser();
            } else {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (username, password) => {
        try {
            // Use dynamic hostname for mobile access
            const API_URL = `http://${window.location.hostname}:5000/api/auth/login`;
            const { data } = await axios.post(API_URL, { username, password });

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            if (data.sessionToken) {
                localStorage.setItem('sessionToken', data.sessionToken);
            }
            setUser(data);
            return { success: true };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionToken');
        setUser(null);
    };

    const value = useMemo(() => ({ user, setUser, login, logout, loading, refreshUser }), [user, loading]);

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Loading EduManage...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
