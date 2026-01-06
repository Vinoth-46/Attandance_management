import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

export default function HODDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [staff, setStaff] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        staffId: '',
        password: ''
    });
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchStats();
        fetchStaff();
        fetchStudents();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/hod/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hod/staff');
            setStaff(res.data);
        } catch (error) {
            console.error('Error fetching staff:', error);
        }
        setLoading(false);
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('/hod/students');
            setStudents(res.data);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hod/staff', formData);
            setMessage({ type: 'success', text: 'Staff member created successfully!' });
            setShowCreateStaffModal(false);
            setFormData({ name: '', email: '', phone: '', staffId: '', password: '' });
            fetchStaff();
            fetchStats();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create staff' });
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;

        try {
            await api.delete(`/hod/staff/${id}`);
            setMessage({ type: 'success', text: 'Staff member deleted successfully!' });
            fetchStaff();
            fetchStats();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete staff' });
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/hod/staff/${selectedStaff._id}/password`, { password: newPassword });
            setMessage({ type: 'success', text: 'Password reset successfully!' });
            setShowResetPasswordModal(false);
            setNewPassword('');
            setSelectedStaff(null);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to reset password' });
        }
    };

    const handleAssignFacultyAdvisor = async (staffId, classInfo) => {
        try {
            await api.put(`/hod/staff/${staffId}/class`, { ...classInfo, isFacultyAdvisor: true });
            setMessage({ type: 'success', text: 'Faculty Advisor assigned successfully!' });
            fetchStaff();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to assign Faculty Advisor' });
        }
    };

    return (
        <Layout>
            <div className="min-h-screen p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gradient mb-2">HOD Dashboard</h1>
                    <p className="text-slate-400">Department: <span className="font-semibold text-blue-400">{user?.assignedDepartment || 'Not Assigned'}</span></p>
                </div>

                {/* Message Banner */}
                {message.text && (
                    <div className={`mb-6 glass-card p-4 border-l-4 ${message.type === 'success' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                        <div className="flex justify-between items-center">
                            <span className={message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}>{message.text}</span>
                            <button onClick={() => setMessage({ type: '', text: '' })} className="text-xl font-bold text-slate-400 hover:text-white">×</button>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm font-medium">Total Staff</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.totalStaff}</p>
                                </div>
                                <div className="bg-blue-500/20 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm font-medium">Total Students</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.totalStudents}</p>
                                </div>
                                <div className="bg-emerald-500/20 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm font-medium">Faculty Advisors</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.facultyAdvisors}</p>
                                </div>
                                <div className="bg-purple-500/20 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm font-medium">Years</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.years?.length || 0}</p>
                                </div>
                                <div className="bg-amber-500/20 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="glass-card mb-6">
                    <div className="border-b border-white/10">
                        <nav className="flex">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('staff')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'staff'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'
                                    }`}
                            >
                                Manage Staff
                            </button>
                            <button
                                onClick={() => setActiveTab('students')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'students'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'
                                    }`}
                            >
                                View Students
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-4">Department Overview</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="glass-card-dark rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-blue-400 mb-4">Department Information</h3>
                                        <div className="space-y-2">
                                            <p className="text-slate-300"><span className="font-medium text-slate-400">Department:</span> {user?.assignedDepartment}</p>
                                            <p className="text-slate-300"><span className="font-medium text-slate-400">HOD Name:</span> {user?.name}</p>
                                            <p className="text-slate-300"><span className="font-medium text-slate-400">Email:</span> {user?.email}</p>
                                        </div>
                                    </div>

                                    <div className="glass-card-dark rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-emerald-400 mb-4">Quick Actions</h3>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    setActiveTab('staff');
                                                    setShowCreateStaffModal(true);
                                                }}
                                                className="w-full premium-btn premium-btn-green"
                                            >
                                                + Add New Staff
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('students')}
                                                className="w-full premium-btn premium-btn-outline"
                                            >
                                                View All Students
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Staff Management Tab */}
                        {activeTab === 'staff' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-white">Staff Management</h2>
                                    <button
                                        onClick={() => setShowCreateStaffModal(true)}
                                        className="premium-btn premium-btn-green flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Staff
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                        <p className="text-slate-400 mt-4">Loading staff...</p>
                                    </div>
                                ) : staff.length === 0 ? (
                                    <div className="text-center py-12 glass-card-dark rounded-lg">
                                        <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="text-slate-400 text-lg">No staff members found</p>
                                        <p className="text-slate-500 mt-2">Click "Add Staff" to create your first staff member</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {staff.map((member) => (
                                            <div key={member._id} className="glass-card-dark rounded-lg p-4 hover:border-white/20 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-slate-400">
                                                            <p><span className="font-medium text-slate-500">Email:</span> {member.email}</p>
                                                            <p><span className="font-medium text-slate-500">Staff ID:</span> {member.staffId}</p>
                                                            <p><span className="font-medium text-slate-500">Phone:</span> {member.phone || 'N/A'}</p>
                                                            <p>
                                                                <span className="font-medium text-slate-500">Faculty Advisor:</span>{' '}
                                                                {member.isFacultyAdvisor ? (
                                                                    <span className="text-emerald-400 font-semibold">Yes</span>
                                                                ) : (
                                                                    <span className="text-slate-500">No</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {member.isFacultyAdvisor && member.advisorClass && (
                                                            <p className="text-xs text-purple-400 mt-1">
                                                                Advisor for: {member.advisorClass.year} {member.advisorClass.section || ''}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2 ml-4">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStaff(member);
                                                                setShowResetPasswordModal(true);
                                                            }}
                                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStaff(member._id)}
                                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                            title="Delete Staff"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Students Tab */}
                        {activeTab === 'students' && (
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-6">Department Students</h2>

                                {students.length === 0 ? (
                                    <div className="text-center py-12 glass-card-dark rounded-lg">
                                        <p className="text-slate-400">No students found in this department</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="premium-table">
                                            <thead>
                                                <tr>
                                                    <th>Roll Number</th>
                                                    <th>Name</th>
                                                    <th>Department</th>
                                                    <th>Year</th>
                                                    <th>Section</th>
                                                    <th>Email</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student) => (
                                                    <tr key={student._id}>
                                                        <td className="font-medium text-white">{student.rollNumber}</td>
                                                        <td className="text-white">{student.name}</td>
                                                        <td>{student.department}</td>
                                                        <td>{student.year}</td>
                                                        <td>{student.section || 'N/A'}</td>
                                                        <td>{student.email}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Staff Modal */}
                {showCreateStaffModal && (
                    <div className="premium-modal-backdrop">
                        <div className="premium-modal max-w-md w-full mx-4">
                            <h3 className="premium-modal-title">Add New Staff</h3>
                            <form onSubmit={handleCreateStaff}>
                                <div className="premium-modal-body space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="premium-input"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="premium-input"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="premium-input"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Staff ID *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.staffId}
                                            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                            className="premium-input"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                                        <input
                                            type="password"
                                            required
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="premium-input"
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateStaffModal(false);
                                            setFormData({ name: '', email: '', phone: '', staffId: '', password: '' });
                                        }}
                                        className="flex-1 premium-btn premium-btn-outline"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 premium-btn premium-btn-green"
                                    >
                                        Create Staff
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Reset Password Modal */}
                {showResetPasswordModal && selectedStaff && (
                    <div className="premium-modal-backdrop">
                        <div className="premium-modal max-w-md w-full mx-4">
                            <h3 className="premium-modal-title">Reset Password</h3>
                            <p className="text-slate-400 mb-4">Staff: <span className="font-semibold text-white">{selectedStaff.name}</span></p>
                            <form onSubmit={handleResetPassword}>
                                <div className="premium-modal-body mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">New Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="premium-input"
                                        minLength={6}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowResetPasswordModal(false);
                                            setNewPassword('');
                                            setSelectedStaff(null);
                                        }}
                                        className="flex-1 premium-btn premium-btn-outline"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 premium-btn"
                                    >
                                        Reset Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
