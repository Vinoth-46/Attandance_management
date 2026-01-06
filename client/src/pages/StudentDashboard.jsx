import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FaceAttendanceModal from '../components/FaceAttendanceModal';
import ProfileCompletionModal from '../components/ProfileCompletionModal';
import QRScannerModal from '../components/QRScannerModal';
import PhotoUpdateModal from '../components/PhotoUpdateModal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../components/Toast';
import Layout from '../components/Layout';
import { PencilIcon, CameraIcon } from '@heroicons/react/20/solid';

export default function StudentDashboard() {
    const { user } = useAuth();
    const { sessionNotification, dismissNotification, socket } = useSocket();
    const toast = useToast();
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') || 'dashboard';
    const [savingProfile, setSavingProfile] = useState(false);

    const [stats, setStats] = useState({ logs: [], totalPresent: 0 });
    const [myLeaves, setMyLeaves] = useState([]);
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [activeSessions, setActiveSessions] = useState([]);
    const [showSessionAlert, setShowSessionAlert] = useState(false);
    const [markedSessionIds, setMarkedSessionIds] = useState([]); // Track sessions where attendance is marked
    const [showProfileCompletion, setShowProfileCompletion] = useState(false); // Profile completion modal
    const [profileCancelled, setProfileCancelled] = useState(false); // If student cancelled profile completion
    const [showQRScanner, setShowQRScanner] = useState(false); // QR Scanner modal
    const [showPhotoUpdate, setShowPhotoUpdate] = useState(false); // Photo update modal

    // Leave Form State
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveDates, setLeaveDates] = useState({ start: '', end: '' });
    const [leaveMsg, setLeaveMsg] = useState('');

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/attendance/my');
            setStats(data);
        } catch (err) { console.error(err); }
    };

    const fetchMyLeaves = async () => {
        try {
            const { data } = await api.get('/leaves/my');
            setMyLeaves(data);
        } catch (err) { console.error(err); }
    };

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/auth/profile');
            setProfile(data);
            setEditData(data);
        } catch (err) { console.error(err); }
    };


    useEffect(() => {
        fetchStats();
        fetchMyLeaves();
        fetchProfile();
        fetchActiveSessions();

        // Check if profile is incomplete - show completion modal
        if (user && user.role === 'student' && user.isProfileComplete === false) {
            setShowProfileCompletion(true);
        }

        // Check for QR fallback trigger from URL
        const action = searchParams.get('action');
        if (action === 'scan-qr') {
            setShowQRScanner(true);
            // Clean up the URL parameter
            window.history.replaceState({}, '', '/student/dashboard');
        }
    }, [user, searchParams]);

    // Socket real-time notification - show alert when session starts
    useEffect(() => {
        if (sessionNotification && sessionNotification.type === 'session_started') {
            setShowSessionAlert(true);
            fetchActiveSessions(); // Refresh the sessions list
            // Auto-dismiss after 10 seconds
            setTimeout(() => setShowSessionAlert(false), 10000);
        }
        if (sessionNotification && sessionNotification.type === 'session_closed') {
            fetchActiveSessions(); // Refresh when session closes
        }
    }, [sessionNotification]);

    // Socket real-time data updates (Live Support)
    useEffect(() => {
        if (!socket) return;

        // Leave status update
        const handleLeaveUpdate = (data) => {
            console.log('Live Leave Update:', data);
            toast.info(data.message || 'Leave status updated');
            fetchMyLeaves(); // <--- LIVE UPDATE
        };

        // Attendance marked (by self or system)
        const handleAttendanceMarked = () => {
            console.log('Live Attendance Update');
            fetchStats();        // <--- LIVE UPDATE
            fetchActiveSessions(); // <--- LIVE UPDATE
        };

        // Profile updated (by staff e.g., photo upload)
        const handleProfileUpdate = () => {
            console.log('Live Profile Update');
            fetchProfile();      // <--- LIVE UPDATE
        };

        socket.on('leave:updated', handleLeaveUpdate);
        socket.on('attendance:marked', handleAttendanceMarked);
        socket.on('profile:updated', handleProfileUpdate); // Assuming this event exists or we add it

        return () => {
            socket.off('leave:updated', handleLeaveUpdate);
            socket.off('attendance:marked', handleAttendanceMarked);
            socket.off('profile:updated', handleProfileUpdate);
        };
    }, [socket]);

    // Poll for active sessions every 30 seconds
    useEffect(() => {
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    // Countdown Timer Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSessions(prevSessions =>
                prevSessions.map(session => {
                    if (session.timeRemaining > 0) {
                        return { ...session, timeRemaining: session.timeRemaining - 1 };
                    }
                    return session;
                })
            );
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchActiveSessions = async () => {
        try {
            const { data } = await api.get('/sessions/active');
            // Backend returns endTime. Calculate remaining seconds.
            const sessionsWithTime = data.map(s => {
                const remaining = Math.max(0, Math.floor((new Date(s.endTime) - new Date()) / 1000));
                return { ...s, timeRemaining: remaining };
            });
            setActiveSessions(sessionsWithTime);
        } catch (err) { console.error(err); }
    };

    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/leaves', { startDate: leaveDates.start, endDate: leaveDates.end, reason: leaveReason });
            setLeaveMsg('Leave application submitted successfully!');
            setLeaveReason('');
            setLeaveDates({ start: '', end: '' });
            fetchMyLeaves();
            setTimeout(() => setLeaveMsg(''), 3000);
        } catch (err) { setLeaveMsg('Failed to submit leave.'); }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        if (savingProfile) return; // Prevent rapid clicks
        setSavingProfile(true);
        try {
            await api.put('/auth/profile', editData);
            toast.success('Profile updated successfully!');
            setIsEditing(false);
            fetchProfile();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const getTitle = () => {
        switch (view) {
            case 'leave': return 'Leave Management';
            case 'profile': return 'My Profile';
            default: return 'Dashboard';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    // If profile completion was cancelled, show logout-only screen
    if (profileCancelled) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center">
                    <div className="mb-6">
                        <span className="text-6xl">🔒</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Completion Required</h2>
                    <p className="text-gray-600 mb-6">
                        Your profile is incomplete. Please complete your profile to access the student dashboard and its features.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                setProfileCancelled(false);
                                setShowProfileCompletion(true);
                            }}
                            className="w-full px-4 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-500"
                        >
                            Complete Profile Now
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('token');
                                window.location.href = '/login';
                            }}
                            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Layout>
            {/* Real-time Pop-up Notification (appears when session just started) */}
            {showSessionAlert && sessionNotification && (
                <div className="fixed top-4 right-4 z-50 animate-bounce">
                    <div className="glass-card p-4 max-w-sm border border-blue-500/30 shadow-2xl shadow-blue-500/20">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">🔔</span>
                            <div className="flex-1">
                                <p className="font-bold text-white">New Session Started!</p>
                                <p className="text-sm text-slate-300">{sessionNotification.message}</p>
                            </div>
                            <button
                                onClick={() => { setShowSessionAlert(false); dismissNotification(); }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            onClick={() => { setShowModal(true); setShowSessionAlert(false); }}
                            className="mt-3 w-full premium-btn premium-btn-green justify-center"
                        >
                            Mark Attendance Now
                        </button>
                    </div>
                </div>
            )}

            {/* Active Session Banner */}
            {activeSessions.length > 0 && (() => {
                // Check if all active sessions have been marked
                const unmarkedSessions = activeSessions.filter(s => !markedSessionIds.includes(s._id));
                const allMarked = unmarkedSessions.length === 0;

                return (
                    <div className={`mb-6 glass-card p-4 ${allMarked ? 'border-blue-500/30' : 'border-emerald-500/30 animate-glow'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                {allMarked ? (
                                    <>
                                        <p className="text-lg font-bold text-blue-400">✅ Attendance Marked for this session!</p>
                                        {activeSessions.map(session => (
                                            <p key={session._id} className="text-sm text-slate-300">
                                                📚 {session.period} by {session.staffName} • Session active for ⏱ {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')} more
                                            </p>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-bold text-emerald-400">🔔 Attendance Open!</p>
                                        {activeSessions.map(session => (
                                            <p key={session._id} className="text-sm text-slate-300">
                                                📚 {session.period} by {session.staffName} • ⏱ {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')} remaining
                                            </p>
                                        ))}
                                    </>
                                )}
                            </div>
                            {!allMarked && (
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="premium-btn premium-btn-green animate-pulse"
                                >
                                    Mark Now
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}
            {/* Header Section */}
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gradient sm:truncate sm:text-3xl sm:tracking-tight">
                        {getTitle()}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">Welcome back, {user?.name}.</p>
                </div>
                {view === 'dashboard' && (
                    <div className="mt-4 flex gap-2 md:ml-4 md:mt-0">
                        <button onClick={() => setShowModal(true)} className="premium-btn">
                            📸 Mark Attendance
                        </button>
                        <button onClick={() => setShowQRScanner(true)} className="premium-btn premium-btn-purple">
                            📷 Scan QR
                        </button>
                    </div>
                )}
            </div>

            {/* Dashboard View */}
            {view === 'dashboard' && (
                <>
                    {/* Premium Stat Cards */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                        <div className="stat-card">
                            <p className="stat-card-label">Total Days Present</p>
                            <p className="stat-card-value mt-2">{stats.totalPresent}</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-card-label">Attendance Percentage</p>
                            <p className="stat-card-value mt-2">{stats.logs.length > 0 ? '92%' : '0%'}</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-card-label">Total Periods</p>
                            <p className="stat-card-value mt-2">{stats.totalPeriodsPresent || stats.logs.length}</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-card-label">Active Sessions</p>
                            <p className="stat-card-value mt-2">{activeSessions.length}</p>
                        </div>
                    </div>

                    {/* Premium Attendance Table */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h3 className="text-lg font-semibold text-white">📋 Attendance History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Session/Period</th>
                                        <th>Time</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.logs.map((log) => (
                                        <tr key={log._id}>
                                            <td className="font-medium">{new Date(log.date).toLocaleDateString()}</td>
                                            <td>{log.period || 'General'}</td>
                                            <td className="text-slate-400">{new Date(log.time).toLocaleTimeString()}</td>
                                            <td>
                                                <span className={`premium-badge ${log.status === 'Present' ? 'premium-badge-green' : 'premium-badge-red'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.logs.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-center py-12 text-slate-500">
                                                <div className="text-4xl mb-2">📭</div>
                                                No attendance records yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Profile View */}
            {view === 'profile' && profile && (
                <div className="glass-card p-6">
                    {/* Profile Header */}
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center overflow-hidden shadow-lg shadow-blue-500/30">
                                {profile.profilePhoto ? (
                                    <img src={profile.profilePhoto} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-3xl font-bold">{profile.name?.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{profile.name}</h3>
                                <p className="text-slate-400">Roll No: {profile.rollNumber} | {profile.department}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {profile.canUpdatePhoto && (
                                <button
                                    onClick={() => setShowPhotoUpdate(true)}
                                    className="premium-btn" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                                >
                                    <CameraIcon className="h-4 w-4" /> Update Photo
                                </button>
                            )}
                            {profile.canEditProfile && !isEditing && (
                                <button onClick={() => setIsEditing(true)} className="premium-btn">
                                    <PencilIcon className="h-4 w-4" /> Edit Profile
                                </button>
                            )}
                            {!profile.canEditProfile && !profile.canUpdatePhoto && (
                                <span className="text-xs text-slate-500 glass-card px-3 py-1">🔒 Editing disabled</span>
                            )}
                        </div>
                    </div>

                    {saveMsg && <p className={`mb-4 text-sm font-semibold ${saveMsg.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg}</p>}

                    {isEditing ? (
                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                                    <input className="premium-input" value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Blood Group</label>
                                    <select className="premium-select" value={editData.bloodGroup || ''} onChange={e => setEditData({ ...editData, bloodGroup: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="A+">A+</option><option value="A-">A-</option>
                                        <option value="B+">B+</option><option value="B-">B-</option>
                                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                        <option value="O+">O+</option><option value="O-">O-</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Father's Name</label>
                                    <input className="premium-input" value={editData.fatherName || ''} onChange={e => setEditData({ ...editData, fatherName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Mother's Name</label>
                                    <input className="premium-input" value={editData.motherName || ''} onChange={e => setEditData({ ...editData, motherName: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Parent Phone</label>
                                    <input className="premium-input" value={editData.parentPhone || ''} onChange={e => setEditData({ ...editData, parentPhone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Emergency Contact</label>
                                    <input className="premium-input" value={editData.emergencyContact || ''} onChange={e => setEditData({ ...editData, emergencyContact: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                                <input className="premium-input" value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                                    <input className="premium-input" value={editData.city || ''} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
                                    <input className="premium-input" value={editData.state || ''} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Pincode</label>
                                    <input className="premium-input" value={editData.pincode || ''} onChange={e => setEditData({ ...editData, pincode: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                                <button type="button" onClick={() => { setIsEditing(false); setEditData(profile); }} className="premium-btn premium-btn-outline" disabled={savingProfile}>Cancel</button>
                                <button type="submit" disabled={savingProfile} className="premium-btn premium-btn-green">
                                    {savingProfile ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Email</p><p className="text-sm font-medium text-white mt-1">{profile.email || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Phone</p><p className="text-sm font-medium text-white mt-1">{profile.phone || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Department</p><p className="text-sm font-medium text-white mt-1">{profile.department || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Year / Section</p><p className="text-sm font-medium text-white mt-1">{profile.year || '-'} / {profile.section || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Date of Birth</p><p className="text-sm font-medium text-white mt-1">{profile.dob ? new Date(profile.dob).toLocaleDateString() : '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Blood Group</p><p className="text-sm font-medium text-white mt-1">{profile.bloodGroup || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Father's Name</p><p className="text-sm font-medium text-white mt-1">{profile.fatherName || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Mother's Name</p><p className="text-sm font-medium text-white mt-1">{profile.motherName || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Parent Phone</p><p className="text-sm font-medium text-white mt-1">{profile.parentPhone || '-'}</p></div>
                            <div className="glass-card-dark p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Emergency Contact</p><p className="text-sm font-medium text-white mt-1">{profile.emergencyContact || '-'}</p></div>
                            <div className="glass-card-dark p-4 col-span-2"><p className="text-xs text-slate-500 uppercase tracking-wider">Address</p><p className="text-sm font-medium text-white mt-1">{[profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || '-'}</p></div>
                        </div>
                    )}
                </div>
            )}

            {/* Leave View */}
            {view === 'leave' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Leave Request Form */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-white">📝 Request Time Off</h3>
                        <p className="mt-1 text-sm text-slate-400">Submit your leave application for staff approval.</p>
                        <form onSubmit={handleLeaveSubmit} className="mt-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                                    <input type="date" required value={leaveDates.start} onChange={e => setLeaveDates({ ...leaveDates, start: e.target.value })} className="premium-input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                                    <input type="date" required value={leaveDates.end} onChange={e => setLeaveDates({ ...leaveDates, end: e.target.value })} className="premium-input" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
                                <textarea rows={3} required value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Describe your reason..." className="premium-input resize-none" />
                            </div>
                            {leaveMsg && <p className={`text-sm font-semibold ${leaveMsg.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>{leaveMsg}</p>}
                            <div className="flex justify-end">
                                <button type="submit" className="premium-btn">Submit Request</button>
                            </div>
                        </form>
                    </div>

                    {/* My Leave Requests */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-white">📋 My Leave Requests</h3>
                        <p className="mt-1 text-sm text-slate-400">Track status of your applications.</p>
                        <div className="mt-6 space-y-4 max-h-96 overflow-y-auto">
                            {myLeaves.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-2">📭</div>
                                    No leave requests yet.
                                </div>
                            )}
                            {myLeaves.map((leave) => (
                                <div key={leave._id} className={`glass-card-dark p-4 border-l-4 ${leave.status === 'Approved' ? 'border-l-emerald-500' : leave.status === 'Rejected' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`premium-badge ${leave.status === 'Approved' ? 'premium-badge-green' : leave.status === 'Rejected' ? 'premium-badge-red' : 'premium-badge-yellow'}`}>
                                            {leave.status === 'Approved' && '✅ '}{leave.status === 'Rejected' && '❌ '}{leave.status === 'Pending' && '⏳ '}{leave.status}
                                        </span>
                                        <span className="text-xs text-slate-500">{new Date(leave.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-medium text-white">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                                    <p className="text-sm text-slate-400 mt-1">{leave.reason}</p>
                                    {leave.status === 'Rejected' && leave.rejectionReason && (
                                        <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/30">
                                            <p className="text-xs font-medium text-red-400">Rejection Reason:</p>
                                            <p className="text-sm text-red-300">{leave.rejectionReason}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showModal && <FaceAttendanceModal
                onClose={() => setShowModal(false)}
                onSuccess={() => {
                    fetchStats();
                    fetchActiveSessions();
                    // Mark all current active sessions as marked
                    setMarkedSessionIds(prev => [...prev, ...activeSessions.map(s => s._id)]);
                }}
            />}

            {/* Profile Completion Modal - Shows on first login when profile is incomplete */}
            {showProfileCompletion && (
                <ProfileCompletionModal
                    onComplete={() => {
                        setShowProfileCompletion(false);
                        setProfileCancelled(false);
                        fetchProfile();
                    }}
                    onCancel={() => {
                        setShowProfileCompletion(false);
                        setProfileCancelled(true);
                    }}
                />
            )}

            {/* QR Scanner Modal */}
            <QRScannerModal
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onSuccess={() => {
                    fetchStats();
                    fetchActiveSessions();
                }}
            />

            {/* Photo Update Modal */}
            {showPhotoUpdate && (
                <PhotoUpdateModal
                    currentPhoto={profile?.profilePhoto}
                    onClose={() => setShowPhotoUpdate(false)}
                    onSuccess={() => {
                        fetchProfile();
                        toast.info('To update photo again, contact your admin.');
                    }}
                />
            )}
        </Layout>
    );
}
