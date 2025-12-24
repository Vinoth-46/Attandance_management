import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

// Get socket URL for deployment
const getSocketUrl = () => {
    // If explicitly set, use it
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    // In production (unified), use same origin
    if (import.meta.env.PROD) {
        return window.location.origin;
    }
    // Development: use port 5000
    return `http://${window.location.hostname}:5000`;
};

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [sessionNotification, setSessionNotification] = useState(null);

    useEffect(() => {
        if (user) {
            const token = localStorage.getItem('token');
            const SOCKET_URL = getSocketUrl();

            const newSocket = io(SOCKET_URL, {
                auth: { token },
                autoConnect: true
            });

            newSocket.on('connect', () => {
                console.log('Socket connected');
                setConnected(true);
            });

            newSocket.on('disconnect', () => {
                console.log('Socket disconnected');
                setConnected(false);
            });

            // Listen for force logout (single-session enforcement)
            newSocket.on('force_logout', (data) => {
                console.log('Force logout received:', data);
                alert(data.message || 'You have been logged out.');
                // Clear local storage and reload to login page
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('sessionToken');
                window.location.href = '/login';
            });

            // Listen for session events
            newSocket.on('session:started', (data) => {
                console.log('Session started:', data);
                setSessionNotification({
                    type: 'session_started',
                    message: data.message || 'New attendance session started!',
                    session: data.session || data
                });

                // Auto-dismiss after 10 seconds
                setTimeout(() => setSessionNotification(null), 10000);
            });

            newSocket.on('session:closed', (data) => {
                console.log('Session closed:', data);
                setSessionNotification({
                    type: 'session_closed',
                    message: 'Attendance session has ended.',
                    sessionId: data.sessionId
                });

                setTimeout(() => setSessionNotification(null), 5000);
            });

            // Listen for attendance events
            newSocket.on('attendance:marked', (data) => {
                console.log('Attendance marked:', data);
                // Could trigger a re-fetch or show notification
            });

            newSocket.on('attendance:update', (data) => {
                console.log('Attendance update:', data);
                // Staff can use this to see real-time attendance
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [user]);

    // Helper function to emit events
    const emitEvent = (event, data) => {
        if (socket && connected) {
            socket.emit(event, data);
        }
    };

    // Dismiss notification manually
    const dismissNotification = () => {
        setSessionNotification(null);
    };

    return (
        <SocketContext.Provider value={{
            socket,
            connected,
            emitEvent,
            sessionNotification,
            dismissNotification
        }}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketContext;
