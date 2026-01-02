import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // inputType can be 'password' (for staff) or 'date' (for student DOB)
    const [inputType, setInputType] = useState('password');

    // To toggle password visibility when in 'password' mode
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

    // Heuristic: If username is purely numeric, it's likely a student roll number -> default to Date input
    const handleUsernameChange = (e) => {
        const val = e.target.value;
        setUsername(val);

        // Simple heuristic: if value is non-empty and only digits, assume student
        // This resets if user clears input or types letters
        if (val && /^\d+$/.test(val)) {
            setInputType('date');
        } else if (val && !/^\d+$/.test(val)) {
            // If letters are present, assume staff -> password
            setInputType('password');
        }
    };

    const toggleInputType = () => {
        if (inputType === 'date') {
            setInputType('password');
            setPassword(''); // Clear logic if needed, or keep to allow user to correct
        } else {
            setInputType('date');
            setPassword('');
        }
    };

    const formatDateForSubmission = (dateString) => {
        // Input date is YYYY-MM-DD (e.g., 2005-01-20)
        // Backend expects DD-MM-YYYY (e.g., 20-01-2005)
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            setError('Please enter your User ID or Roll Number');
            return;
        }

        let finalPassword = password;
        if (inputType === 'date') {
            // Transform date format
            finalPassword = formatDateForSubmission(password);
        }

        if (!finalPassword) {
            setError(inputType === 'date' ? 'Please select your Date of Birth' : 'Please enter your password');
            return;
        }

        setIsLoading(true);
        const result = await login(trimmedUsername, finalPassword);
        setIsLoading(false);

        if (!result.success) {
            setError(result.message);
        }
    };

    if (user && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8 bg-white shadow-xl rounded-2xl border border-gray-100">
                    <h2 className="text-2xl font-bold mb-4 text-brand-800">Already Logged In</h2>
                    <p className="text-gray-600 mb-6">You are signed in as <strong className="text-brand-600">{user.name || user.username}</strong></p>

                    <button
                        onClick={() => {
                            if (user.role === 'student') navigate('/student/dashboard');
                            else if (user.role === 'superadmin') navigate('/superadmin/dashboard');
                            else if (user.role === 'hod') navigate('/hod/dashboard');
                            else if (['staff', 'admin'].includes(user.role)) navigate('/staff/dashboard');
                            else window.location.reload();
                        }}
                        className="px-6 py-2 bg-gradient-to-r from-brand-600 to-purple-600 text-white rounded-full font-medium hover:from-brand-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Go to Dashboard
                    </button>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="block mt-4 text-sm text-gray-500 hover:text-red-500 underline mx-auto"
                    >
                        Logout and Switch Account
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden">

            {/* Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10"></div>
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-4">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-purple-600 shadow-lg mb-4 text-white">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-purple-800">
                        Attendance Management
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">Secure Access Portal</p>
                </div>

                {/* Glass Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Username Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 ml-1">
                                User ID / Roll Number
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={handleUsernameChange}
                                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                    placeholder="Enter Roll No or User ID"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password / Date Input */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-semibold text-gray-700">
                                    {inputType === 'date' ? 'Date of Birth' : 'Password'}
                                </label>
                                <button
                                    type="button"
                                    onClick={toggleInputType}
                                    className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors"
                                >
                                    {inputType === 'date' ? (
                                        <>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 13.5a2.5 2.5 0 01-1.77 1.933l-.397.087A2.5 2.5 0 017 13.5l-1-1a2.5 2.5 0 010-3.536l.96-1.55A6 6 0 0113 4z" />
                                            </svg>
                                            Use Password
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Use Date Input
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    {inputType === 'date' ? (
                                        <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    )}
                                </div>

                                {inputType === 'date' ? (
                                    <input
                                        type="date"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                        required
                                    />
                                ) : (
                                    <>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                            placeholder="Enter Password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 animate-fadeIn">
                                <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 p-[1px] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                        >
                            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#5046e5_50%,#E2E8F0_100%)] opacity-0 group-hover:opacity-10 transition-opacity" />
                            <div className="relative flex items-center justify-center w-full px-4 py-3 text-white bg-gradient-to-r from-brand-600 to-purple-600 rounded-xl group-hover:bg-opacity-90 transition-all">
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing In...
                                    </>
                                ) : (
                                    <span className="font-semibold text-lg">Sign In</span>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Footer Guide */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex flex-col gap-2 text-center text-sm text-gray-500">
                            <p>
                                <span className="font-medium text-brand-600">Students:</span> Use Roll Number & Date of Birth
                            </p>
                            <p>
                                <span className="font-medium text-purple-600">Staff:</span> Use User ID & Password
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <p className="text-center text-gray-400 text-sm mt-8 pb-4">
                    © 2024 Attendance Management System
                </p>
            </div>
        </div>
    );
}
