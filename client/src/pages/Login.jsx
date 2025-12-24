import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            if (user.role === 'student') navigate('/student/dashboard');
            else if (user.role === 'superadmin') navigate('/superadmin/dashboard');
            else if (user.role === 'hod') navigate('/hod/dashboard');
            else if (['staff', 'admin'].includes(user.role)) navigate('/staff/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password);
        setIsLoading(false);

        if (!result.success) {
            setError(result.message);
        }
    };

    // Redirect logic is in useEffect. 
    // If user is already logged in but we are on login page, 
    // we should either redirect or if redirect fails (e.g. unknown role), allow logout.

    if (user && !isLoading) {
        // If we haven't redirected yet, maybe the role is invalid?
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8 bg-white shadow rounded-lg">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Already Logged In</h2>
                    <p className="text-gray-600 mb-6">You are logged in as <strong>{user.name || user.username}</strong>.</p>
                    <p className="text-sm text-red-500 mb-4">{!user.role && "Error: User role not found."}</p>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => {
                                if (user.role === 'student') navigate('/student/dashboard');
                                else if (user.role === 'superadmin') navigate('/superadmin/dashboard');
                                else if (user.role === 'hod') navigate('/hod/dashboard');
                                else if (['staff', 'admin'].includes(user.role)) navigate('/staff/dashboard');
                                else {
                                    // Invalid role, force logout
                                    localStorage.removeItem('token');
                                    localStorage.removeItem('user');
                                    window.location.reload();
                                }
                            }}
                            className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => {
                                const { logout } = useAuth(); // Need to destructure logout from hook if not available
                                localStorage.clear();
                                window.location.reload();
                            }}
                            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            {/* Animated Background Orbs */}
            <div className="login-orb login-orb-1"></div>
            <div className="login-orb login-orb-2"></div>
            <div className="login-orb login-orb-3"></div>
            <div className="login-grid"></div>

            {/* Main Login Card */}
            <div className="login-card-container">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="login-logo">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h1 className="login-title">EduManage</h1>
                    <p className="login-subtitle">Student Attendance Management System</p>
                </div>

                {/* Glass Card */}
                <div className="login-glass-card">
                    <div className="text-center mb-8">
                        <h2 className="login-card-title">Welcome Back</h2>
                        <p className="login-card-subtitle">Sign in to access your dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Username Field */}
                        <div className="mb-6">
                            <label htmlFor="username" className="login-label">
                                Student ID / Staff ID
                            </label>
                            <div className="login-input-wrapper">
                                <div className="login-input-icon">
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your ID"
                                    className="login-input"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="mb-6">
                            <label htmlFor="password" className="login-label">
                                Password / DOB
                            </label>
                            <div className="login-input-wrapper">
                                <div className="login-input-icon">
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="login-input login-input-password"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="login-eye-btn"
                                >
                                    {showPassword ? (
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="login-error">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="login-error-text">{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="login-btn"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="login-footer">
                        <div className="login-footer-text">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Students: Use your DOB as password</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Text */}
                <p className="login-copyright">
                    © 2024 EduManage. All rights reserved.
                </p>
            </div>
        </div>
    );
}
