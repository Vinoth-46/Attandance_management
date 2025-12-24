import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

export default function HODDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [staff, setStaff] = useState([]);
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
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">HOD Dashboard</h1>
                    <p className="text-gray-600">Department: <span className="font-semibold text-blue-600">{user?.assignedDepartment || 'Not Assigned'}</span></p>
                </div>

                {/* Message Banner */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        <div className="flex justify-between items-center">
                            <span>{message.text}</span>
                            <button onClick={() => setMessage({ type: '', text: '' })} className="text-xl font-bold">×</button>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Total Staff</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalStaff}</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Total Students</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalStudents}</p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Faculty Advisors</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.facultyAdvisors}</p>
                                </div>
                                <div className="bg-purple-100 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Years</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.years?.length || 0}</p>
                                </div>
                                <div className="bg-orange-100 p-3 rounded-lg">
                                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-md mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('staff')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'staff'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Manage Staff
                            </button>
                            <button
                                onClick={() => setActiveTab('students')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'students'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">Department Overview</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-blue-800 mb-4">Department Information</h3>
                                        <div className="space-y-2">
                                            <p className="text-gray-700"><span className="font-medium">Department:</span> {user?.assignedDepartment}</p>
                                            <p className="text-gray-700"><span className="font-medium">HOD Name:</span> {user?.name}</p>
                                            <p className="text-gray-700"><span className="font-medium">Email:</span> {user?.email}</p>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-green-800 mb-4">Quick Actions</h3>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    setActiveTab('staff');
                                                    setShowCreateStaffModal(true);
                                                }}
                                                className="w-full bg-white text-green-700 font-medium py-2 px-4 rounded-lg shadow hover:shadow-md transition-shadow"
                                            >
                                                + Add New Staff
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('students')}
                                                className="w-full bg-white text-green-700 font-medium py-2 px-4 rounded-lg shadow hover:shadow-md transition-shadow"
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
                                    <h2 className="text-2xl font-bold text-gray-800">Staff Management</h2>
                                    <button
                                        onClick={() => setShowCreateStaffModal(true)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Staff
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                                        <p className="text-gray-600 mt-4">Loading staff...</p>
                                    </div>
                                ) : staff.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="text-gray-600 text-lg">No staff members found</p>
                                        <p className="text-gray-500 mt-2">Click "Add Staff" to create your first staff member</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {staff.map((member) => (
                                            <div key={member._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-lg font-semibold text-gray-800">{member.name}</h3>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-gray-600">
                                                            <p><span className="font-medium">Email:</span> {member.email}</p>
                                                            <p><span className="font-medium">Staff ID:</span> {member.staffId}</p>
                                                            <p><span className="font-medium">Phone:</span> {member.phone || 'N/A'}</p>
                                                            <p>
                                                                <span className="font-medium">Faculty Advisor:</span>{' '}
                                                                {member.isFacultyAdvisor ? (
                                                                    <span className="text-green-600 font-semibold">Yes</span>
                                                                ) : (
                                                                    <span className="text-gray-400">No</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {member.isFacultyAdvisor && member.advisorClass && (
                                                            <p className="text-xs text-purple-600 mt-1">
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
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStaff(member._id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">Department Students</h2>

                                {students.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                                        <p className="text-gray-600">No students found in this department</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {students.map((student) => (
                                                    <tr key={student._id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-sm text-gray-900">{student.rollNumber}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{student.name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.department}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.year}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.section || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.email}</td>
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
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Staff</h3>
                            <form onSubmit={handleCreateStaff}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.staffId}
                                            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                        <input
                                            type="password"
                                            required
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Reset Password</h3>
                            <p className="text-gray-600 mb-4">Staff: <span className="font-semibold">{selectedStaff.name}</span></p>
                            <form onSubmit={handleResetPassword}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
