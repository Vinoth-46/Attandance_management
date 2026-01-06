import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/Toast';
import { initializeFaceApi } from './utils/faceApiInitializer';
import Maintenance from './pages/Maintenance';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const HODDashboard = lazy(() => import('./pages/HODDashboard'));
const FacultyAdvisorClass = lazy(() => import('./pages/FacultyAdvisorClass'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading Fallback Component
const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
        </div>
    </div>
);

// Check if maintenance mode is enabled via environment variable
// Set VITE_MAINTENANCE_MODE=true in Render environment variables to enable
const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
        </div>
    </div>;

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/login" />;
    }

    return children;
};

function App() {
    // Initialize AI Backend aggressively on startup
    useEffect(() => {
        initializeFaceApi();
    }, []);

    // If maintenance mode is enabled, show maintenance page for all routes
    if (MAINTENANCE_MODE) {
        return (
            <Router>
                <Routes>
                    <Route path="*" element={<Maintenance />} />
                </Routes>
            </Router>
        );
    }

    return (
        <Router>
            <AuthProvider>
                <SocketProvider>
                    <ToastProvider>
                        <Suspense fallback={<LoadingFallback />}>
                            <Routes>
                                <Route path="/login" element={<Login />} />

                                <Route
                                    path="/student/*"
                                    element={
                                        <ProtectedRoute allowedRoles={['student']}>
                                            <StudentDashboard />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/staff/*"
                                    element={
                                        <ProtectedRoute allowedRoles={['staff', 'admin']}>
                                            <StaffDashboard />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/superadmin/*"
                                    element={
                                        <ProtectedRoute allowedRoles={['superadmin']}>
                                            <SuperAdminDashboard />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/hod/*"
                                    element={
                                        <ProtectedRoute allowedRoles={['hod']}>
                                            <HODDashboard />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route path="/" element={<Navigate to="/login" />} />

                                {/* 404 Page - catches all unmatched routes */}
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </ToastProvider>
                </SocketProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
