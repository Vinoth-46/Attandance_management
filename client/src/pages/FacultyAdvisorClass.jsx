import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import PeriodWiseView from '../components/PeriodWiseView';
import AbsenteeCard from '../components/AbsenteeCard';

export default function FacultyAdvisorClass() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [classOverview, setClassOverview] = useState(null);
    const [periodWiseData, setPeriodWiseData] = useState(null);
    const [absentees, setAbsentees] = useState([]);
    const [selectedTab, setSelectedTab] = useState('overview'); // overview, period-wise, absentees
    const [error, setError] = useState('');

    useEffect(() => {
        fetchClassOverview();
        fetchTodayAbsentees();
    }, []);

    const fetchClassOverview = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/attendance/fa/my-class');
            setClassOverview(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load class overview');
        } finally {
            setLoading(false);
        }
    };

    const fetchPeriodWiseData = async (date) => {
        try {
            const { data } = await api.get(`/attendance/fa/period-wise?date=${date || ''}`);
            setPeriodWiseData(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load period-wise data');
        }
    };

    const fetchTodayAbsentees = async () => {
        try {
            const { data } = await api.get('/attendance/fa/absentees');
            setAbsentees(data);
        } catch (err) {
            console.error('Failed to load absentees:', err);
        }
    };

    const handleTabChange = (tab) => {
        setSelectedTab(tab);
        if (tab === 'period-wise' && !periodWiseData) {
            fetchPeriodWiseData();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error && !classOverview) {
        return (
            <div className="glass-card p-6 text-center">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gradient">My Class</h1>
                    <p className="text-slate-400 mt-2">
                        {classOverview?.class?.department} - Year {classOverview?.class?.year}
                        {classOverview?.class?.section && ` - Section ${classOverview?.class?.section}`}
                    </p>
                </div>
                <button
                    onClick={fetchClassOverview}
                    className="premium-btn flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="stat-card">
                    <div className="text-slate-400 text-sm mb-2">Total Students</div>
                    <div className="text-4xl font-bold text-white">{classOverview?.totalStudents || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="text-slate-400 text-sm mb-2">Present Today</div>
                    <div className="text-4xl font-bold text-emerald-400">{classOverview?.todayStats?.totalPresent || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                        {classOverview?.totalStudents ?
                            `${Math.round((classOverview.todayStats.totalPresent / classOverview.totalStudents) * 100)}%` : '0%'}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="text-slate-400 text-sm mb-2">Absent Today</div>
                    <div className="text-4xl font-bold text-rose-400">{classOverview?.todayStats?.totalAbsent || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                        {classOverview?.todayStats?.periodsMarked || 0} periods marked
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="glass-card">
                <div className="border-b border-white/10">
                    <nav className="flex gap-2 p-1">
                        <button
                            onClick={() => handleTabChange('overview')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${selectedTab === 'overview'
                                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/40'
                                    : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => handleTabChange('period-wise')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${selectedTab === 'period-wise'
                                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/40'
                                    : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            Period-Wise
                        </button>
                        <button
                            onClick={() => handleTabChange('absentees')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all relative ${selectedTab === 'absentees'
                                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/40'
                                    : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            Today's Absentees
                            {absentees.length > 0 && (
                                <span className="absolute -top-1 -right-1 px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full">
                                    {absentees.length}
                                </span>
                            )}
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {/* Overview Tab */}
                    {selectedTab === 'overview' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {classOverview?.periodsToday?.map((period) => (
                                        <div key={period} className="glass-card-dark p-4 rounded-lg">
                                            <div className="text-xs text-slate-500">Period {period}</div>
                                            <div className="text-sm text-emerald-400 mt-1">Marked ✓</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleTabChange('period-wise')}
                                        className="glass-card-dark p-4 rounded-lg text-left hover:border-teal-500/40 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-teal-500/20 rounded-lg group-hover:bg-teal-500/30 transition-colors">
                                                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">View Period-Wise</div>
                                                <div className="text-xs text-slate-400">Detailed attendance breakdown</div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('absentees')}
                                        className="glass-card-dark p-4 rounded-lg text-left hover:border-rose-500/40 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-rose-500/20 rounded-lg group-hover:bg-rose-500/30 transition-colors">
                                                <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">Check Absentees</div>
                                                <div className="text-xs text-slate-400">
                                                    {absentees.length} student{absentees.length !== 1 ? 's' : ''} absent today
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Period-Wise Tab */}
                    {selectedTab === 'period-wise' && (
                        <div>
                            {periodWiseData ? (
                                <PeriodWiseView data={periodWiseData} />
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="text-slate-400 mt-4">Loading period-wise data...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Absentees Tab */}
                    {selectedTab === 'absentees' && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Today's Absentees ({absentees.length})
                                </h3>
                                <button
                                    onClick={fetchTodayAbsentees}
                                    className="premium-btn-outline"
                                >
                                    Refresh
                                </button>
                            </div>
                            {absentees.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {absentees.map((student) => (
                                        <AbsenteeCard key={student._id} student={student} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-emerald-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-slate-400">Perfect! No absentees today 🎉</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
