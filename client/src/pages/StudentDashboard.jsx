import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FaceAttendanceModal from '../components/FaceAttendanceModal';
import ProfileCompletionModal from '../components/ProfileCompletionModal';
import QRScannerModal from '../components/QRScannerModal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import { PencilIcon } from '@heroicons/react/20/solid';

export default function StudentDashboard() {
    const { user } = useAuth();
    const { sessionNotification, dismissNotification } = useSocket();
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') || 'dashboard';

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
    const [showQRScanner, setShowQRScanner] = useState(false); // QR Scanner modal

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
        try {
            await api.put('/auth/profile', editData);
            setSaveMsg('Profile updated successfully!');
            setIsEditing(false);
            fetchProfile();
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (err) {
            setSaveMsg(err.response?.data?.message || 'Failed to update profile');
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

    return (
        <Layout>
            {/* Real-time Pop-up Notification (appears when session just started) */}
            {showSessionAlert && sessionNotification && (
                <div className="fixed top-4 right-4 z-50 animate-bounce">
                    <div className="bg-blue-600 text-white p-4 rounded-lg shadow-2xl max-w-sm">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">🔔</span>
                            <div className="flex-1">
                                <p className="font-bold">New Session Started!</p>
                                <p className="text-sm opacity-90">{sessionNotification.message}</p>
                            </div>
                            <button
                                onClick={() => { setShowSessionAlert(false); dismissNotification(); }}
                                className="text-white/80 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            onClick={() => { setShowModal(true); setShowSessionAlert(false); }}
                            className="mt-3 w-full bg-white text-blue-600 py-2 rounded-md font-semibold hover:bg-blue-50"
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
                    <div className={`mb-6 ${allMarked ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4`}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                {allMarked ? (
                                    <>
                                        <p className="text-lg font-bold text-blue-800">✅ Attendance Marked for this session!</p>
                                        {activeSessions.map(session => (
                                            <p key={session._id} className="text-sm text-blue-700">
                                                📚 {session.period} by {session.staffName} • Session active for ⏱ {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')} more
                                            </p>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-bold text-green-800">🔔 Attendance Open!</p>
                                        {activeSessions.map(session => (
                                            <p key={session._id} className="text-sm text-green-700">
                                                📚 {session.period} by {session.staffName} • ⏱ {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')} remaining
                                            </p>
                                        ))}
                                    </>
                                )}
                            </div>
                            {!allMarked && (
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 animate-pulse"
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
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        {getTitle()}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.name}.</p>
                </div>
                {view === 'dashboard' && (
                    <div className="mt-4 flex gap-2 md:ml-4 md:mt-0">
                        <button onClick={() => setShowModal(true)} className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">
                            Mark Attendance
                        </button>
                    </div>
                )}
            </div>

            {/* Dashboard View */}
            {view === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                            <dt className="truncate text-sm font-medium text-gray-500">Total Days Present</dt>
                            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.totalPresent}</dd>
                        </div>
                        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                            <dt className="truncate text-sm font-medium text-gray-500">Attendance Percentage</dt>
                            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.logs.length > 0 ? '92%' : '0%'}</dd>
                        </div>
                    </div>
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Time</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {stats.logs.map((log) => (
                                    <tr key={log._id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{new Date(log.date).toLocaleDateString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{new Date(log.time).toLocaleTimeString()}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm"><span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${log.status === 'Present' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{log.status}</span></td>
                                    </tr>
                                ))}
                                {stats.logs.length === 0 && <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">No attendance records.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Profile View */}
            {view === 'profile' && profile && (
                <div className="bg-white shadow sm:rounded-lg p-6">
                    {/* Profile Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden">
                                {profile.profilePhoto ? (
                                    <img src={profile.profilePhoto} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-brand-600 text-2xl font-bold">{profile.name?.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                                <p className="text-sm text-gray-500">Roll No: {profile.rollNumber} | {profile.department}</p>
                            </div>
                        </div>
                        {profile.canEditProfile && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                                <PencilIcon className="h-4 w-4" /> Edit Profile
                            </button>
                        )}
                        {!profile.canEditProfile && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">🔒 Editing disabled by admin</span>
                        )}
                    </div>

                    {saveMsg && <p className={`mb-4 text-sm font-semibold ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</p>}

                    {isEditing ? (
                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                    <select className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.bloodGroup || ''} onChange={e => setEditData({ ...editData, bloodGroup: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="A+">A+</option><option value="A-">A-</option>
                                        <option value="B+">B+</option><option value="B-">B-</option>
                                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                        <option value="O+">O+</option><option value="O-">O-</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.fatherName || ''} onChange={e => setEditData({ ...editData, fatherName: e.target.value })} />
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.motherName || ''} onChange={e => setEditData({ ...editData, motherName: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.parentPhone || ''} onChange={e => setEditData({ ...editData, parentPhone: e.target.value })} />
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.emergencyContact || ''} onChange={e => setEditData({ ...editData, emergencyContact: e.target.value })} />
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.city || ''} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.state || ''} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={editData.pincode || ''} onChange={e => setEditData({ ...editData, pincode: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => { setIsEditing(false); setEditData(profile); }} className="px-4 py-2 bg-white text-gray-700 border rounded-md hover:bg-gray-50 text-sm font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium">Save Changes</button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Email</p><p className="text-sm font-medium text-gray-900">{profile.email || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Phone</p><p className="text-sm font-medium text-gray-900">{profile.phone || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Department</p><p className="text-sm font-medium text-gray-900">{profile.department || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Year / Section</p><p className="text-sm font-medium text-gray-900">{profile.year || '-'} / {profile.section || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Date of Birth</p><p className="text-sm font-medium text-gray-900">{profile.dob ? new Date(profile.dob).toLocaleDateString() : '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Blood Group</p><p className="text-sm font-medium text-gray-900">{profile.bloodGroup || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Father's Name</p><p className="text-sm font-medium text-gray-900">{profile.fatherName || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Mother's Name</p><p className="text-sm font-medium text-gray-900">{profile.motherName || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Parent Phone</p><p className="text-sm font-medium text-gray-900">{profile.parentPhone || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Emergency Contact</p><p className="text-sm font-medium text-gray-900">{profile.emergencyContact || '-'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg col-span-2"><p className="text-xs text-gray-500 uppercase">Address</p><p className="text-sm font-medium text-gray-900">{[profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || '-'}</p></div>
                        </div>
                    )}
                </div>
            )}

            {/* Leave View */}
            {view === 'leave' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white shadow sm:rounded-lg p-6">
                        <h3 className="text-base font-semibold leading-7 text-gray-900">Request Time Off</h3>
                        <p className="mt-1 text-sm text-gray-500">Submit your leave application for staff approval.</p>
                        <form onSubmit={handleLeaveSubmit} className="mt-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-900">Start Date</label>
                                    <input type="date" required value={leaveDates.start} onChange={e => setLeaveDates({ ...leaveDates, start: e.target.value })} className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm" /></div>
                                <div><label className="block text-sm font-medium text-gray-900">End Date</label>
                                    <input type="date" required value={leaveDates.end} onChange={e => setLeaveDates({ ...leaveDates, end: e.target.value })} className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-gray-900">Reason</label>
                                <textarea rows={3} required value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Describe your reason..." className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 sm:text-sm" /></div>
                            {leaveMsg && <p className={`text-sm font-semibold ${leaveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{leaveMsg}</p>}
                            <div className="flex justify-end"><button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500">Submit Request</button></div>
                        </form>
                    </div>
                    <div className="bg-white shadow sm:rounded-lg p-6">
                        <h3 className="text-base font-semibold leading-7 text-gray-900">My Leave Requests</h3>
                        <p className="mt-1 text-sm text-gray-500">Track status of your applications.</p>
                        <div className="mt-6 space-y-4 max-h-96 overflow-y-auto">
                            {myLeaves.length === 0 && <p className="text-gray-500 text-center py-8">No leave requests yet.</p>}
                            {myLeaves.map((leave) => (
                                <div key={leave._id} className={`p-4 rounded-lg border ${leave.status === 'Approved' ? 'border-green-200 bg-green-50' : leave.status === 'Rejected' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(leave.status)}`}>
                                            {leave.status === 'Approved' && '✅ '}{leave.status === 'Rejected' && '❌ '}{leave.status === 'Pending' && '⏳ '}{leave.status}
                                        </span>
                                        <span className="text-xs text-gray-500">{new Date(leave.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                                    <p className="text-sm text-gray-600 mt-1">{leave.reason}</p>
                                    {leave.status === 'Rejected' && leave.rejectionReason && (
                                        <div className="mt-3 p-2 bg-red-100 rounded border border-red-300">
                                            <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                                            <p className="text-sm text-red-700">{leave.rejectionReason}</p>
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
                        fetchProfile();
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
        </Layout>
    );
}
