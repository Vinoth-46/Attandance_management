import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4 overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Floating attendance cards */}
                <div className="absolute top-10 left-10 w-20 h-24 bg-white/10 backdrop-blur-sm rounded-lg animate-float-slow transform rotate-12">
                    <div className="p-2">
                        <div className="w-8 h-8 bg-green-400/30 rounded-full mx-auto mb-1"></div>
                        <div className="h-1 bg-white/20 rounded w-3/4 mx-auto mb-1"></div>
                        <div className="h-1 bg-white/20 rounded w-1/2 mx-auto"></div>
                    </div>
                </div>
                <div className="absolute top-1/4 right-20 w-16 h-20 bg-white/10 backdrop-blur-sm rounded-lg animate-float-medium transform -rotate-6">
                    <div className="p-2">
                        <div className="w-6 h-6 bg-red-400/30 rounded-full mx-auto mb-1"></div>
                        <div className="h-1 bg-white/20 rounded w-3/4 mx-auto"></div>
                    </div>
                </div>
                <div className="absolute bottom-20 left-1/4 w-24 h-28 bg-white/10 backdrop-blur-sm rounded-lg animate-float-fast transform rotate-3">
                    <div className="p-2">
                        <div className="w-10 h-10 bg-yellow-400/30 rounded-full mx-auto mb-1"></div>
                        <div className="h-1 bg-white/20 rounded w-3/4 mx-auto mb-1"></div>
                        <div className="h-1 bg-white/20 rounded w-1/2 mx-auto"></div>
                    </div>
                </div>
                <div className="absolute bottom-1/3 right-1/4 w-14 h-16 bg-white/10 backdrop-blur-sm rounded-lg animate-float-slow transform -rotate-12">
                    <div className="p-1">
                        <div className="w-5 h-5 bg-blue-400/30 rounded-full mx-auto"></div>
                    </div>
                </div>

                {/* Floating question marks */}
                <span className="absolute top-1/3 left-1/3 text-6xl text-white/10 animate-pulse">?</span>
                <span className="absolute bottom-1/4 right-1/3 text-4xl text-white/10 animate-bounce">?</span>

                {/* Animated circles */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 text-center max-w-2xl mx-auto">
                {/* 404 Number with Animation */}
                <div className="relative mb-8">
                    <h1 className="text-[180px] md:text-[220px] font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 leading-none animate-pulse-slow select-none">
                        404
                    </h1>
                    {/* Glitch effect lines */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-[180px] md:text-[220px] font-black text-pink-500/20 animate-glitch-1 select-none">404</div>
                    </div>
                </div>

                {/* Clock Icon with Animation */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <svg className="w-24 h-24 text-white/80 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
                            <path d="M12 6v6l4 2" strokeLinecap="round" />
                        </svg>
                        {/* X mark overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-400 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Message */}
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 animate-fade-in">
                    Oops! Page Not Found
                </h2>
                <p className="text-lg text-white/70 mb-8 animate-fade-in-delay">
                    Looks like this attendance record doesn't exist!
                    <br />
                    The page you're looking for seems to have marked itself absent.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-delay-2">
                    <Link
                        to="/login"
                        className="group relative px-8 py-4 bg-white text-purple-900 font-bold rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Go to Login
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Go to Login
                        </span>
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/30 transition-all duration-300 hover:bg-white/20 hover:scale-105 hover:border-white/50"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Go Back
                        </span>
                    </button>
                </div>

                {/* Footer */}
                <p className="mt-12 text-white/40 text-sm">
                    Attendance Management System
                </p>
            </div>

            {/* Custom Styles */}
            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(12deg); }
                    50% { transform: translateY(-20px) rotate(15deg); }
                }
                @keyframes float-medium {
                    0%, 100% { transform: translateY(0) rotate(-6deg); }
                    50% { transform: translateY(-15px) rotate(-3deg); }
                }
                @keyframes float-fast {
                    0%, 100% { transform: translateY(0) rotate(3deg); }
                    50% { transform: translateY(-25px) rotate(6deg); }
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                @keyframes glitch-1 {
                    0%, 100% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(2px, -2px); }
                    60% { transform: translate(-2px, -2px); }
                    80% { transform: translate(2px, 2px); }
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
                .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
                .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
                .animate-spin-slow { animation: spin-slow 10s linear infinite; }
                .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
                .animate-glitch-1 { animation: glitch-1 0.3s ease-in-out infinite; }
                .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
                .animate-fade-in-delay { animation: fade-in 0.8s ease-out 0.2s forwards; opacity: 0; }
                .animate-fade-in-delay-2 { animation: fade-in 0.8s ease-out 0.4s forwards; opacity: 0; }
            `}</style>
        </div>
    );
}
