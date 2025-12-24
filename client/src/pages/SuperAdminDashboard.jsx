import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    UsersIcon,
    UserGroupIcon,
    ChartBarIcon,
    PlusIcon,
    TrashIcon,
    KeyIcon,
    ShieldCheckIcon,
    XMarkIcon,
    CheckIcon,
    EyeIcon,
    AcademicCapIcon,
    BuildingLibraryIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function SuperAdminDashboard() {
    const { user } = useAuth();
    const { socket } = useSocket();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = searchParams.get('view') || 'stats';

    // State
    const [stats, setStats] = useState({ totalStudents: 0, totalStaff: 0, facultyAdvisors: 0, totalHODs: 0, departments: [] });
    const [advancedStats, setAdvancedStats] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [hodList, setHodList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showAdvisorModal, setShowAdvisorModal] = useState(false);
    const [showHODModal, setShowHODModal] = useState(false); // For promoting staff to HOD

    const [selectedStaff, setSelectedStaff] = useState(null);
    const [classFilters, setClassFilters] = useState({ departments: [], years: [], sections: [] });
    const [message, setMessage] = useState({ type: '', text: '' });

    // Form states
    const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', staffId: '', password: '', department: '' });
    const [newPassword, setNewPassword] = useState('');
    const [advisorClass, setAdvisorClass] = useState({ department: '', year: '', section: '' });
    const [manualSection, setManualSection] = useState(''); // New state for manual section entry
    const [hodDepartment, setHodDepartment] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, []);

    // Real-time Updates
    useEffect(() => {
        if (!socket) return;

        const handleStaffUpdate = (data) => {
            console.log('Real-time Staff Update:', data);
            fetchAllData(); // Refresh all lists
        };

        const handleAttendanceUpdate = (data) => {
            console.log('Real-time Attendance Update:', data);
            fetchStats(); // Refresh stats
            fetchAdvancedStats();
        };

        socket.on('staff:update', handleStaffUpdate);
        socket.on('attendance:update', handleAttendanceUpdate);

        return () => {
            socket.off('staff:update', handleStaffUpdate);
            socket.off('attendance:update', handleAttendanceUpdate);
        };
    }, [socket]);

    const fetchAllData = () => {
        fetchStats();
        fetchAdvancedStats();
        fetchStaff();
        fetchHODs();
        fetchClassFilters();
    };

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/superadmin/stats');
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchAdvancedStats = async () => {
        try {
            // Note: I added this route to adminRoutes, exposed at /api/admin/advanced-stats
            // But checking if I should call /api/admin or mock it if not found.
            // Dashboard prefix is /superadmin usually. Checking my route implementation...
            // I put it in adminRoutes.js which is mounted at /api/admin.
            const { data } = await api.get('/admin/advanced-stats');
            setAdvancedStats(data);
        } catch (err) {
            console.error('Failed to fetch advanced stats:', err);
        }
    };

    const fetchStaff = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/superadmin/staff');
            setStaffList(data);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHODs = async () => {
        try {
            const { data } = await api.get('/superadmin/hods');
            setHodList(data);
        } catch (err) {
            console.error('Failed to fetch HODs:', err);
        }
    };

    const fetchClassFilters = async () => {
        try {
            const { data } = await api.get('/attendance/class/filters');
            setClassFilters(data);
        } catch (err) {
            console.error('Failed to fetch class filters:', err);
        }
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        try {
            await api.post('/superadmin/staff', newStaff);
            setMessage({ type: 'success', text: `Staff ${newStaff.name} created successfully!` });
            setShowAddModal(false);
            setNewStaff({ name: '', email: '', phone: '', staffId: '', password: '', department: '' });
            fetchStaff();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create staff' });
        }
    };

    const handleDeleteStaff = async (id, name, role = 'staff') => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            const endpoint = role === 'hod' ? `/superadmin/hods/${id}` : `/superadmin/staff/${id}`;
            await api.delete(endpoint);
            setMessage({ type: 'success', text: `${name} deleted successfully` });
            fetchAllData();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete user' });
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!selectedStaff) return;
        try {
            const endpoint = selectedStaff.role === 'hod'
                ? `/superadmin/hods/${selectedStaff._id}/password`
                : `/superadmin/staff/${selectedStaff._id}/password`;

            await api.put(endpoint, { password: newPassword });
            setMessage({ type: 'success', text: `Password updated for ${selectedStaff.name}` });
            setShowPasswordModal(false);
            setNewPassword('');
            setSelectedStaff(null);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reset password' });
        }
    };

    const handleAssignAdvisor = async (e) => {
        e.preventDefault();
        if (!selectedStaff) return;

        // Determine final section
        const finalSection = advisorClass.section === 'new' ? manualSection : advisorClass.section;
        const payload = { ...advisorClass, section: finalSection };

        try {
            await api.put(`/superadmin/staff/${selectedStaff._id}/advisor`, payload);
            setMessage({ type: 'success', text: `${selectedStaff.name} assigned as Faculty Advisor` });
            setShowAdvisorModal(false);
            setAdvisorClass({ department: '', year: '', section: '' });
            setManualSection(''); // Reset manual section
            setSelectedStaff(null);
            fetchStaff();
            fetchStats();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign advisor' });
        }
    };

    const handleRemoveAdvisor = async (staff) => {
        if (!confirm(`Remove ${staff.name} as Faculty Advisor?`)) return;
        try {
            await api.delete(`/superadmin/staff/${staff._id}/advisor`);
            setMessage({ type: 'success', text: `${staff.name} is no longer a Faculty Advisor` });
            fetchStaff();
            fetchStats();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove advisor' });
        }
    };

    const handleMakeHOD = async (e) => {
        e.preventDefault();
        if (!selectedStaff) return;
        try {
            await api.put(`/admin/staff/${selectedStaff._id}/hod`, { department: hodDepartment });
            setMessage({ type: 'success', text: `${selectedStaff.name} promoted to HOD of ${hodDepartment}` });
            setShowHODModal(false);
            setHodDepartment('');
            setSelectedStaff(null);
            fetchAllData();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign HOD' });
        }
    };

    const handleDemoteHOD = async (hod) => {
        if (!confirm(`Demote ${hod.name} back to Staff?`)) return;
        try {
            // Calling toggleHOD (mapped to put) without department implies demotion? 
            // My toggleHOD check: if role === 'hod' -> demote.
            await api.put(`/admin/staff/${hod._id}/hod`, {});
            setMessage({ type: 'success', text: `${hod.name} demoted to Staff` });
            fetchAllData();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to demote HOD' });
        }
    };

    const openPasswordModal = (staff) => {
        setSelectedStaff(staff);
        setNewPassword('');
        setShowPasswordModal(true);
    };

    const openAdvisorModal = (staff) => {
        setSelectedStaff(staff);
        setAdvisorClass({ department: '', year: '', section: '' });
        setShowAdvisorModal(true);
    };

    const openHODModal = (staff) => {
        setSelectedStaff(staff);
        setHodDepartment(staff.department || '');
        setShowHODModal(true);
    };

    const tabs = [
        { id: 'stats', name: 'Dashboard', icon: ChartBarIcon },
        { id: 'hods', name: 'HOD Management', icon: BuildingLibraryIcon },
        { id: 'staff', name: 'Staff Management', icon: UsersIcon },
        { id: 'advisors', name: 'Faculty Advisors', icon: AcademicCapIcon },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="sm:flex sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-500">Manage staff, faculty advisors, HODs, and system settings</p>
                    </div>
                </div>

                {/* Message Alert */}
                {message.text && (
                    <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {message.type === 'success' ? (
                                    <CheckIcon className="h-5 w-5 text-green-400" />
                                ) : (
                                    <XMarkIcon className="h-5 w-5 text-red-400" />
                                )}
                            </div>
                            <div className="ml-3">
                                <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                                    {message.text}
                                </p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button onClick={() => setMessage({ type: '', text: '' })} className="inline-flex text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSearchParams({ view: tab.id })}
                                className={`${currentView === tab.id
                                    ? 'border-brand-500 text-brand-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
                            >
                                <tab.icon className="h-5 w-5" />
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                {currentView === 'stats' && (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                                <dt className="truncate text-sm font-medium text-gray-500">Total Students</dt>
                                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.totalStudents}</dd>
                            </div>
                            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                                <dt className="truncate text-sm font-medium text-gray-500">Total Staff</dt>
                                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.totalStaff}</dd>
                            </div>
                            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                                <dt className="truncate text-sm font-medium text-gray-500">Total HODs</dt>
                                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.totalHODs}</dd>
                            </div>
                            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                                <dt className="truncate text-sm font-medium text-gray-500">Faculty Advisors</dt>
                                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stats.facultyAdvisors}</dd>
                            </div>
                        </div>

                        {/* Advanced Stats: Department Breakdown */}
                        {advancedStats && advancedStats.deptStats && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                    <ChartBarIcon className="h-5 w-5 text-brand-600" />
                                    Today's Attendance by Department
                                </h3>
                                <div className="space-y-4">
                                    {advancedStats.deptStats.map((dept) => (
                                        <div key={dept.department}>
                                            <div className="flex items-center justify-between text-sm font-medium text-gray-600">
                                                <span>{dept.department}</span>
                                                <span className="text-gray-900">{dept.percentage}% ({dept.present}/{dept.total})</span>
                                            </div>
                                            <div className="mt-1 w-full bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full ${parseFloat(dept.percentage) >= 75 ? 'bg-green-600' : parseFloat(dept.percentage) >= 50 ? 'bg-yellow-500' : 'bg-red-600'}`}
                                                    style={{ width: `${dept.percentage}%` }} // Ensure string value is handled
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={() => { setSearchParams({ view: 'staff' }); setShowAddModal(true); }}
                                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-600 hover:border-brand-500 hover:text-brand-600 transition-colors"
                                >
                                    <PlusIcon className="h-6 w-6" />
                                    <span>Add New Staff</span>
                                </button>
                                <button
                                    onClick={() => setSearchParams({ view: 'advisors' })}
                                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-600 hover:border-brand-500 hover:text-brand-600 transition-colors"
                                >
                                    <AcademicCapIcon className="h-6 w-6" />
                                    <span>Manage Advisors</span>
                                </button>
                                <button
                                    onClick={() => setSearchParams({ view: 'hods' })}
                                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-600 hover:border-brand-500 hover:text-brand-600 transition-colors"
                                >
                                    <BuildingLibraryIcon className="h-6 w-6" />
                                    <span>Manage HODs</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HOD Management Tab */}
                {currentView === 'hods' && (
                    <div className="space-y-4">
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Department</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Staff Count</th>
                                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {hodList.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-10 text-center text-gray-500">No HODs assigned. Go to Staff Management to promote staff.</td>
                                        </tr>
                                    ) : (
                                        hodList.map((hod) => (
                                            <tr key={hod._id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                            {hod.name?.charAt(0)}
                                                        </div>
                                                        <div className="ml-4">
                                                            <div>{hod.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                                                        {hod.assignedDepartment}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{hod.email}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{hod.staffCount || 0}</td>
                                                <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openPasswordModal({ ...hod, role: 'hod' })}
                                                            className="text-gray-400 hover:text-brand-600"
                                                            title="Reset Password"
                                                        >
                                                            <KeyIcon className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDemoteHOD(hod)}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Demote to Staff"
                                                        >
                                                            <ArrowPathIcon className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStaff(hod._id, hod.name, 'hod')}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Delete HOD"
                                                        >
                                                            <TrashIcon className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {currentView === 'staff' && (
                    <div className="space-y-4">
                        {/* Add Staff Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
                            >
                                <PlusIcon className="h-5 w-5" />
                                Add Staff
                            </button>
                        </div>

                        {/* Staff Table */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="w-full py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Staff ID</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Today's Sessions</th>
                                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="py-10 text-center text-gray-500">Loading...</td>
                                        </tr>
                                    ) : staffList.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-10 text-center text-gray-500">No staff members found</td>
                                        </tr>
                                    ) : (
                                        staffList.map((staff) => (
                                            <tr key={staff._id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-brand-100 flex items-center justify-center">
                                                            <span className="text-brand-700 font-medium">{staff.name?.charAt(0)}</span>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="font-medium text-gray-900">{staff.name}</div>
                                                            {staff.isFacultyAdvisor && (
                                                                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                                                    <ShieldCheckIcon className="h-3 w-3 mr-1" />
                                                                    Faculty Advisor
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{staff.staffId}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{staff.email}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {staff.role}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {staff.todaysSessions?.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {staff.todaysSessions.map((s, i) => (
                                                                <span key={i} className={`inline-flex rounded px-2 py-0.5 text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {s.department} Y{s.year} P{s.period}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openPasswordModal(staff)}
                                                            className="text-gray-400 hover:text-brand-600"
                                                            title="Reset Password"
                                                        >
                                                            <KeyIcon className="h-5 w-5" />
                                                        </button>

                                                        {/* Make HOD Button */}
                                                        <button
                                                            onClick={() => openHODModal(staff)}
                                                            className="text-gray-400 hover:text-indigo-600"
                                                            title="Promote to HOD"
                                                        >
                                                            <BuildingLibraryIcon className="h-5 w-5" />
                                                        </button>

                                                        {!staff.isFacultyAdvisor ? (
                                                            <button
                                                                onClick={() => openAdvisorModal(staff)}
                                                                className="text-gray-400 hover:text-green-600"
                                                                title="Assign as Advisor"
                                                            >
                                                                <AcademicCapIcon className="h-5 w-5" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleRemoveAdvisor(staff)}
                                                                className="text-green-600 hover:text-red-600"
                                                                title="Remove Advisor Role"
                                                            >
                                                                <AcademicCapIcon className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteStaff(staff._id, staff.name)}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Delete Staff"
                                                        >
                                                            <TrashIcon className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Faculty Advisors Tab (Same as before) */}
                {currentView === 'advisors' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-medium text-gray-900">Faculty Advisors</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {staffList.filter(s => s.isFacultyAdvisor).length === 0 ? (
                                <div className="col-span-full text-center py-10 text-gray-500 bg-white rounded-lg shadow">
                                    No Faculty Advisors assigned yet
                                </div>
                            ) : (
                                staffList.filter(s => s.isFacultyAdvisor).map((advisor) => (
                                    <div key={advisor._id} className="bg-white rounded-lg shadow p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                                                    <AcademicCapIcon className="h-6 w-6 text-green-600" />
                                                </div>
                                                <div className="ml-4">
                                                    <h3 className="text-sm font-medium text-gray-900">{advisor.name}</h3>
                                                    <p className="text-sm text-gray-500">{advisor.email}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveAdvisor(advisor)}
                                                className="text-gray-400 hover:text-red-600"
                                                title="Remove Advisor"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <div className="mt-4 border-t border-gray-100 pt-4">
                                            <p className="text-sm font-medium text-gray-700">Assigned Class</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                                                    {advisor.advisorClass?.department}
                                                </span>
                                                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                                                    Year {advisor.advisorClass?.year}
                                                </span>
                                                {advisor.advisorClass?.section && (
                                                    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                                                        Section {advisor.advisorClass?.section}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {/* Add Staff Modal - Same as before */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddModal(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Add New Staff</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateStaff} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                                    <input type="text" required value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Staff ID *</label>
                                    <input type="text" required value={newStaff.staffId} onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                                    <input type="email" required value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                                    <input type="tel" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department</label>
                                    <select value={newStaff.department} onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2">
                                        <option value="">Select Department</option>
                                        {classFilters.departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password *</label>
                                    <div className="relative mt-1">
                                        <input type={showPassword ? "text" : "password"} required minLength="6" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 pr-10" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                            <EyeIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">Create Staff</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showPasswordModal && selectedStaff && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPasswordModal(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
                                <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">Reset password for <strong>{selectedStaff.name}</strong></p>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">New Password *</label>
                                    <input type="password" required minLength="6" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2" />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowPasswordModal(false)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">Reset Password</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Advisor Modal */}
            {showAdvisorModal && selectedStaff && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAdvisorModal(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Assign as Faculty Advisor</h3>
                                <button onClick={() => setShowAdvisorModal(false)} className="text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">Assign <strong>{selectedStaff.name}</strong> as Faculty Advisor for:</p>
                            <form onSubmit={handleAssignAdvisor} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department *</label>
                                    <select required value={advisorClass.department} onChange={(e) => setAdvisorClass({ ...advisorClass, department: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2">
                                        <option value="">Select Department</option>
                                        {classFilters.departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Year *</label>
                                    <select required value={advisorClass.year} onChange={(e) => setAdvisorClass({ ...advisorClass, year: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2">
                                        <option value="">Select Year</option>
                                        {classFilters.years.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Section (Optional)</label>
                                    <div className="space-y-2">
                                        <select value={advisorClass.section} onChange={(e) => setAdvisorClass({ ...advisorClass, section: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2">
                                            <option value="">All Sections / None</option>
                                            {classFilters.sections.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                            <option value="new" className="font-semibold text-brand-600">+ Add New Section</option>
                                        </select>

                                        {/* Manual Input for New Section */}
                                        {advisorClass.section === 'new' && (
                                            <input
                                                type="text"
                                                placeholder="Enter Section Name (e.g. A, B, C)"
                                                value={manualSection}
                                                onChange={(e) => setManualSection(e.target.value)}
                                                className="block w-full rounded-md border-brand-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border bg-brand-50"
                                                autoFocus
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowAdvisorModal(false)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">Assign Advisor</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Promote HOD Modal */}
            {showHODModal && selectedStaff && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowHODModal(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Promote to HOD</h3>
                                <button onClick={() => setShowHODModal(false)} className="text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">Promote <strong>{selectedStaff.name}</strong> to Head of Department for:</p>
                            <form onSubmit={handleMakeHOD} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department *</label>
                                    <select required value={hodDepartment} onChange={(e) => setHodDepartment(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2">
                                        <option value="">Select Department</option>
                                        {classFilters.departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowHODModal(false)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">Promote to HOD</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
