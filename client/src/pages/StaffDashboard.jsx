import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import FaceRegistrationModal from '../components/FaceRegistrationModal';
import { useAuth, useLogout } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PlusIcon, TrashIcon, PencilIcon, CameraIcon, CheckIcon, XMarkIcon, EyeIcon, KeyIcon, UserGroupIcon } from '@heroicons/react/20/solid';

export default function StaffDashboard() {
    const { user } = useAuth();
    const logout = useLogout();
    const toast = useToast();
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') || 'students';

    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(true); // Loading state for students list
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [approvedLeaves, setApprovedLeaves] = useState([]);
    const [rejectedLeaves, setRejectedLeaves] = useState([]);
    const [reports, setReports] = useState([]);
    const [leaveTab, setLeaveTab] = useState('pending');

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [allStudents, setAllStudents] = useState([]);
    const [manualAttendance, setManualAttendance] = useState({ studentId: '', date: new Date().toISOString().split('T')[0], status: 'Present' });
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importResults, setImportResults] = useState(null);
    const [importing, setImporting] = useState(false);

    // Take Attendance States
    const [classFilters, setClassFilters] = useState({ departments: [], years: [], sections: [] });
    const [classFilter, setClassFilter] = useState({ department: '', year: '', section: '', period: '', date: new Date().toISOString().split('T')[0] });
    const [classStudents, setClassStudents] = useState([]);
    const [classAttendance, setClassAttendance] = useState({});
    const [classSubmitting, setClassSubmitting] = useState(false);
    const [classSummary, setClassSummary] = useState(null);

    // Session States - Simplified with manual inputs
    const [newSession, setNewSession] = useState({
        department: '',
        year: '',
        section: '',
        periods: '',            // Manual input: "1", "1-2", "1-4", etc.
        subject: '',            // Manual input: "Tamil", "Physics Lab", etc.
        duration: 45,           // Minutes (min 1 min for quick close)
        enableGeofencing: false,
        location: null,
        requiresFaceVerification: false
    });
    const [activeSessions, setActiveSessions] = useState([]);
    const [sessionCreating, setSessionCreating] = useState(false);
    const [showSessionModal, setShowSessionModal] = useState(false);

    // Generate period display text from manual inputs
    const getPeriodDisplay = (periods, subject) => {
        if (!periods) return '';
        const periodText = periods.includes('-') ? `Periods ${periods}` : `Period ${periods}`;
        return subject ? `${periodText} - ${subject}` : periodText;
    };

    // My Class States (Faculty Advisor)
    const [myClassStudents, setMyClassStudents] = useState([]);
    const [myClassStats, setMyClassStats] = useState(null);
    const [myStudents, setMyStudents] = useState([]); // Added for FA view
    const [loading, setLoading] = useState(false); // Added for FA view

    const [newStudent, setNewStudent] = useState({
        name: '', rollNumber: '', dob: '', department: '',
        year: '', section: '', email: '', phone: ''
    });
    const [addingStudent, setAddingStudent] = useState(false); // Prevent rapid clicks
    const [editingStudent, setEditingStudent] = useState(false); // Prevent rapid clicks

    // Staff Management States (Super Admin)
    const [staffList, setStaffList] = useState([]);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', staffId: '', password: '', department: '' });
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false); // For logged-in user
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
    const [resetPasswordId, setResetPasswordId] = useState(null); // Staff ID to reset
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [createdStaffCreds, setCreatedStaffCreds] = useState(null); // Show password once on creation
    const [absentees, setAbsentees] = useState([]); // For FA View

    // Zone States
    const [zones, setZones] = useState([]);
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [newZone, setNewZone] = useState({ name: '', latitude: '', longitude: '', radius: 50 });
    const [selectedZoneId, setSelectedZoneId] = useState(''); // For selecting a saved zone when starting session

    // QR Attendance States
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrSession, setQRSession] = useState(null);  // Selected session for QR display
    const [qrCodeData, setQRCodeData] = useState(null); // QR code image data URL
    const [qrLoading, setQRLoading] = useState(false);
    const [qrExpiresIn, setQRExpiresIn] = useState(30);
    const qrRefreshRef = useRef(null);  // Ref for auto-refresh interval

    // Report Filter States
    const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', department: '' });

    // Student Lookup States (for non-FA staff to verify student identity)
    const [studentSearch, setStudentSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedStudentView, setSelectedStudentView] = useState(null); // View-only modal

    // Period-Wise Attendance States
    const [periodWiseData, setPeriodWiseData] = useState(null);
    const [periodWiseLoading, setPeriodWiseLoading] = useState(false);
    const [periodWiseDate, setPeriodWiseDate] = useState(new Date().toISOString().split('T')[0]);
    const [periodWiseFilters, setPeriodWiseFilters] = useState({ department: '', year: '', section: '' });

    // Session Reports States
    const [sessionReports, setSessionReports] = useState([]);
    const [expandedSections, setExpandedSections] = useState({});
    const [reportsLoading, setReportsLoading] = useState(false);
    const [togglingStudentId, setTogglingStudentId] = useState(null); // For optimistic toggle update
    const [viewingStudentId, setViewingStudentId] = useState(null); // For View button loading
    const [togglingPhotoId, setTogglingPhotoId] = useState(null); // For photo permission toggle loading
    const [startingSession, setStartingSession] = useState(false); // For Start Session button loading

    // Export Handlers
    const handleExportExcel = async () => {
        try {
            const params = new URLSearchParams();
            if (reportFilters.startDate) params.append('startDate', reportFilters.startDate);
            if (reportFilters.endDate) params.append('endDate', reportFilters.endDate);
            if (reportFilters.department) params.append('department', reportFilters.department);

            const response = await api.get(`/reports/export/excel?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error('Failed to export: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleExportPDF = async () => {
        try {
            const params = new URLSearchParams();
            if (reportFilters.startDate) params.append('startDate', reportFilters.startDate);
            if (reportFilters.endDate) params.append('endDate', reportFilters.endDate);
            if (reportFilters.department) params.append('department', reportFilters.department);

            const response = await api.get(`/reports/export/pdf?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error('Failed to export: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        try {
            await api.put('/auth/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            toast.success('Password changed successfully!');
            setShowPasswordModal(false);
            setPasswordForm({ currentPassword: '', newPassword: '' });
        } catch (err) {
            toast.error('Failed to change password: ' + (err.response?.data?.message || err.message));
        }
    };

    // Session Reports Functions
    const toggleSection = (sessionId, section) => {
        setExpandedSections(prev => ({
            ...prev,
            [sessionId]: {
                ...prev[sessionId],
                [section]: !prev[sessionId]?.[section]
            }
        }));
    };

    const fetchSessionReports = async () => {
        setReportsLoading(true);
        try {
            const { data } = await api.get('/sessions/my/reports');
            setSessionReports(data);
        } catch (err) {
            console.error('Failed to fetch session reports:', err);
            toast.error(err.response?.data?.message || 'Failed to fetch reports');
        } finally {
            setReportsLoading(false);
        }
    };

    const updateAttendanceStatus = async (attendanceId, status) => {
        try {
            await api.put('/attendance/update-status', { attendanceId, status });
            toast.success(`Attendance updated to ${status}`);
            fetchSessionReports(); // Refresh
        } catch (err) {
            console.error('Failed to update:', err);
            toast.error(err.response?.data?.message || 'Failed to update');
        }
    };

    useEffect(() => {
        if (view === 'students') fetchStudents();
        if (view === 'leaves') fetchAllLeaves();
        if (view === 'reports') { fetchSessionReports(); }
        if (view === 'attendance') fetchClassFilters();
        if (view === 'session') { fetchClassFilters(); fetchActiveSessions(); fetchZones(); }
        if (view === 'zones') { fetchZones(); }
        if (view === 'period-wise') { fetchClassFilters(); }
        if (view === 'myclass' && user?.isFacultyAdvisor) { fetchMyClassData(); fetchAbsentees(); }
        if (view === 'staff' && user?.role === 'superadmin') fetchStaff();
    }, [view]);

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const { data } = await api.get('/admin/students');
            setStudents(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load students: ' + (e.message || 'Unknown error'));
        } finally {
            setLoadingStudents(false);
        }
    };

    const fetchClassFilters = async () => { try { const { data } = await api.get('/attendance/class/filters'); setClassFilters(data); } catch (e) { console.error(e); } };

    const fetchActiveSessions = async () => { try { const { data } = await api.get('/sessions/my/active'); setActiveSessions(data); } catch (e) { console.error(e); } };

    const fetchZones = async () => { try { const { data } = await api.get('/zones'); setZones(data); } catch (e) { console.error(e); } };

    // Student Search for identity verification (non-FA staff)
    const handleStudentSearch = async () => {
        if (!studentSearch.trim()) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const { data } = await api.get(`/admin/students/search?query=${encodeURIComponent(studentSearch)}`);
            setSearchResults(data);
        } catch (e) {
            console.error(e);
            setSearchResults([]);
        }
        setSearchLoading(false);
    };

    const handleCreateZone = async (e) => {
        e.preventDefault();
        try {
            await api.post('/zones', newZone);
            setShowZoneModal(false);
            setNewZone({ name: '', latitude: '', longitude: '', radius: 50 });
            fetchZones();
            toast.success('Zone saved!');
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to save zone'); }
    };

    const handleDeleteZone = async (id) => {
        if (!window.confirm('Delete this zone?')) return;
        try {
            await api.delete(`/zones/${id}`);
            fetchZones();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete zone'); }
    };

    const handleSelectZone = (zoneId) => {
        setSelectedZoneId(zoneId);
        if (zoneId) {
            const zone = zones.find(z => z._id === zoneId);
            if (zone) {
                setNewSession({
                    ...newSession,
                    enableGeofencing: true,
                    location: { latitude: zone.latitude, longitude: zone.longitude, radius: zone.radius }
                });
            }
        } else {
            setNewSession({ ...newSession, location: null });
        }
    };

    const captureZoneLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setNewZone({ ...newZone, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => toast.error('Failed to get location: ' + err.message)
        );
    };



    const handleCloseSession = async (sessionId) => {
        try {
            await api.put(`/sessions/${sessionId}/close`);
            fetchActiveSessions();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to close session'); }
    };

    const loadClassStudents = async () => {
        if (!classFilter.department || !classFilter.year || !classFilter.section) {
            toast.warning('Please select Department, Year, and Section');
            return;
        }
        try {
            const { data } = await api.get('/attendance/class/students', { params: classFilter });
            setClassStudents(data);
            const initialAttendance = {};
            data.forEach(s => { initialAttendance[s._id] = 'Present'; });
            setClassAttendance(initialAttendance);
            setClassSummary(null);
        } catch (e) { console.error(e); }
    };

    const handleMarkAllPresent = () => {
        const all = {};
        classStudents.forEach(s => { all[s._id] = 'Present'; });
        setClassAttendance(all);
    };

    const handleMarkAllAbsent = () => {
        const all = {};
        classStudents.forEach(s => { all[s._id] = 'Absent'; });
        setClassAttendance(all);
    };

    const handleSubmitClassAttendance = async () => {
        if (!classFilter.period) { toast.warning('Please enter a Period'); return; }
        setClassSubmitting(true);
        const attendanceList = Object.entries(classAttendance).map(([studentId, status]) => ({ studentId, status }));
        try {
            const { data } = await api.post('/attendance/class/mark', {
                date: classFilter.date,
                period: classFilter.period,
                attendanceList
            });
            setClassSummary(data.summary);
            toast.success(data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit attendance'); }
        finally { setClassSubmitting(false); }
    };

    const fetchAllLeaves = async () => {
        try {
            const [pending, approved, rejected] = await Promise.all([
                api.get('/leaves/pending'),
                api.get('/leaves/approved'),
                api.get('/leaves/rejected')
            ]);
            setPendingLeaves(pending.data);
            setApprovedLeaves(approved.data);
            setRejectedLeaves(rejected.data);
        } catch (e) { console.error(e); }
    };

    const fetchReports = async () => { try { const { data } = await api.get('/attendance/report'); setReports(data); } catch (e) { console.error(e); } };

    const fetchStudentsForAttendance = async () => { try { const { data } = await api.get('/attendance/students'); setAllStudents(data); } catch (e) { console.error(e); } };

    const handleStatusChange = async (attendanceId, newStatus) => {
        try {
            await api.put(`/attendance/${attendanceId}`, { status: newStatus });
            fetchReports();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    };

    const handleManualAttendance = async (e) => {
        e.preventDefault();
        try {
            await api.post('/attendance/manual', manualAttendance);
            setShowManualModal(false);
            setManualAttendance({ studentId: '', date: new Date().toISOString().split('T')[0], status: 'Present' });
            fetchReports();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to mark attendance'); }
    };

    const handleImportStudents = async (e) => {
        e.preventDefault();
        if (!importFile) return;

        setImporting(true);
        setImportResults(null);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const { data } = await api.post('/admin/students/bulk', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResults(data);
            fetchStudents();
        } catch (err) {
            setImportResults({ message: err.response?.data?.message || 'Import failed', errors: [], success: [] });
        } finally {
            setImporting(false);
        }
    };

    const fetchMyClassData = async () => {
        if (!user.advisorClass) return;
        setLoading(true);
        try {
            const { department, year, section } = user.advisorClass;
            const res = await api.get(`/attendance/class/students`, { params: { department, year, section } });
            setMyStudents(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const fetchAbsentees = async () => {
        try {
            const { data } = await api.get('/attendance/fa/absentees');
            setAbsentees(data);
        } catch (e) {
            console.error('Failed to fetch absentees', e);
        }
    };

    const handleStartSession = async (e, forceCreate = false) => {
        e?.preventDefault?.();
        if (startingSession) return; // Prevent double clicks
        setStartingSession(true);
        try {
            // Generate period name from manual inputs
            const periodName = getPeriodDisplay(newSession.periods, newSession.subject);

            const sessionData = {
                ...newSession,
                period: periodName,  // Generated period name like "Period 1 - Tamil" or "Periods 1-4 - Lab"
                forceCreate
            };
            if (!sessionData.enableGeofencing) {
                delete sessionData.location;
            }
            await api.post('/sessions', sessionData);
            // Reset form
            setNewSession({
                department: '', year: '', section: '',
                periods: '', subject: '', duration: 45,
                enableGeofencing: false, location: null
            });
            fetchActiveSessions();
            toast.success('Session started!');
        } catch (err) {
            // Handle session conflict (409)
            if (err.response?.status === 409 && err.response?.data?.conflict) {
                const conflictData = err.response.data;
                const existingSession = conflictData.existingSession;
                const startTime = new Date(existingSession.startTime).toLocaleTimeString();

                let message = `⚠️ Session Conflict!\n\n`;
                message += `A session is already active for this class:\n`;
                message += `• Period: ${existingSession.period}\n`;
                message += `• Started by: ${existingSession.staffName}\n`;
                message += `• Started at: ${startTime}\n\n`;

                if (conflictData.canOverride) {
                    const override = window.confirm(
                        message + `As a Faculty Advisor/Admin, you can override and close the existing session.\n\nDo you want to override and create a new session?`
                    );
                    if (override) {
                        // Retry with forceCreate
                        setStartingSession(false);
                        handleStartSession(null, true);
                        return;
                    }
                } else {
                    toast.warning(message + `Please coordinate with ${existingSession.staffName} or wait until their session ends.`);
                }
            } else {
                toast.error(err.response?.data?.message || 'Failed to start session');
            }
        } finally {
            setStartingSession(false);
        }
    };

    const captureLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNewSession({
                    ...newSession,
                    location: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        radius: 50 // default radius
                    }
                });
                toast.success('Location captured!');
            },
            (error) => {
                toast.error('Unable to retrieve location: ' + error.message);
            }
        );
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (addingStudent) return; // Prevent rapid clicks
        setAddingStudent(true);
        try {
            await api.post('/admin/students', newStudent);
            setShowAddModal(false);
            fetchStudents();
            if (user?.isFacultyAdvisor) fetchMyClassData();
            setNewStudent({ name: '', rollNumber: '', dob: '', department: '', year: '', section: '', email: '', phone: '' });
            toast.success('Student added successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setAddingStudent(false);
        }
    };

    const handleEditStudent = async (e) => {
        e.preventDefault();
        if (editingStudent) return; // Prevent rapid clicks
        setEditingStudent(true);
        try {
            await api.put(`/admin/students/${selectedStudent._id}`, selectedStudent);
            setShowEditModal(false);
            setSelectedStudent(null);
            fetchStudents();
            if (user?.isFacultyAdvisor) fetchMyClassData(); // Refresh My Class data too
            toast.success('Student updated successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setEditingStudent(false);
        }
    };

    const togglePhotoPermission = async (studentId, currentStatus) => {
        if (togglingPhotoId === studentId) return; // Prevent rapid clicks
        setTogglingPhotoId(studentId);

        // Optimistic UI update
        setSelectedStudent(prev => prev ? { ...prev, canUpdatePhoto: !prev.canUpdatePhoto } : prev);

        try {
            const { data } = await api.put(`/admin/students/${studentId}/photo-permission`);
            toast.success(data.message);
            fetchStudents();
        } catch (err) {
            // Revert on error
            setSelectedStudent(prev => prev ? { ...prev, canUpdatePhoto: currentStatus } : prev);
            toast.error(err.response?.data?.message || 'Failed to toggle photo permission');
        } finally {
            setTogglingPhotoId(null);
        }
    };

    const handleApproveLeave = async (id) => {
        try {
            await api.put(`/leaves/${id}`, { status: 'Approved' });
            fetchAllLeaves();
        } catch (err) { toast.error(err.response?.data?.message || err.message); }
    };

    const openRejectModal = (leave) => {
        setSelectedLeave(leave);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const handleRejectLeave = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) {
            toast.warning('Please provide a reason for rejection');
            return;
        }
        try {
            await api.put(`/leaves/${selectedLeave._id}`, { status: 'Rejected', rejectionReason });
            setShowRejectModal(false);
            setSelectedLeave(null);
            setRejectionReason('');
            fetchAllLeaves();
        } catch (err) { toast.error(err.response?.data?.message || err.message); }
    };

    // QR Attendance Functions
    const handleOpenQRModal = (session) => {
        setQRSession(session);
        setShowQRModal(true);
        generateQRCode(session._id);
    };

    const generateQRCode = async (sessionId) => {
        setQRLoading(true);
        try {
            const { data } = await api.post(`/qr/${sessionId}/qr/generate`);
            setQRCodeData(data.qrCode);
            setQRExpiresIn(data.refreshIn || 30);

            // Start countdown and auto-refresh
            startQRRefresh(sessionId, data.refreshIn || 30);
        } catch (err) {
            console.error('QR generation failed:', err);
            toast.error(err.response?.data?.message || 'Failed to generate QR code');
        } finally {
            setQRLoading(false);
        }
    };

    const startQRRefresh = (sessionId, seconds) => {
        // Clear any existing interval
        if (qrRefreshRef.current) {
            clearInterval(qrRefreshRef.current);
        }

        let countdown = seconds;
        setQRExpiresIn(countdown);

        qrRefreshRef.current = setInterval(() => {
            countdown--;
            setQRExpiresIn(countdown);

            if (countdown <= 0) {
                // Regenerate QR code
                generateQRCode(sessionId);
            }
        }, 1000);
    };

    const handleCloseQRModal = () => {
        setShowQRModal(false);
        setQRSession(null);
        setQRCodeData(null);

        // Clear refresh interval
        if (qrRefreshRef.current) {
            clearInterval(qrRefreshRef.current);
            qrRefreshRef.current = null;
        }
    };

    // Cleanup QR interval on unmount
    useEffect(() => {
        return () => {
            if (qrRefreshRef.current) {
                clearInterval(qrRefreshRef.current);
            }
        };
    }, []);

    // Period-Wise Attendance Functions
    const fetchPeriodWiseAttendance = async () => {
        setPeriodWiseLoading(true);
        try {
            const params = new URLSearchParams();
            if (periodWiseDate) params.append('date', periodWiseDate);
            if (periodWiseFilters.department) params.append('department', periodWiseFilters.department);
            if (periodWiseFilters.year) params.append('year', periodWiseFilters.year);
            if (periodWiseFilters.section) params.append('section', periodWiseFilters.section);

            const { data } = await api.get(`/attendance/period-wise?${params.toString()}`);
            setPeriodWiseData(data);
        } catch (err) {
            console.error('Failed to fetch period-wise data:', err);
            toast.error(err.response?.data?.message || 'Failed to fetch period-wise attendance');
        } finally {
            setPeriodWiseLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Present': return 'bg-green-100 text-green-800';
            case 'Absent': return 'bg-red-100 text-red-800';
            case 'Half Day': return 'bg-yellow-100 text-yellow-800';
            case 'Leave': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    const handleDeleteStudent = async (id) => {
        if (window.confirm('Are you sure you want to delete this student?')) {
            try {
                await api.delete(`/admin/students/${id}`);
                toast.success('Student deleted successfully');
                fetchStudents();
                if (user?.isFacultyAdvisor) fetchMyClassData();
            } catch (err) {
                console.error(err);
                toast.error(err.response?.data?.message || 'Failed to delete student');
            }
        }
    };

    const handleResetPassword = async (studentId, studentName) => {
        if (window.confirm(`Are you sure you want to reset the password for ${studentName} to their Date of Birth?`)) {
            try {
                const { data } = await api.put(`/admin/students/${studentId}/reset-password`);
                toast.success(data.message);
            } catch (err) {
                console.error(err);
                toast.error(err.response?.data?.message || 'Failed to reset password');
            }
        }
    };

    const openEditModal = (student) => {
        setSelectedStudent({ ...student });
        setShowEditModal(true);
    };

    const openViewModal = async (student) => {
        if (viewingStudentId) return; // Prevent rapid clicks
        setViewingStudentId(student._id);
        try {
            const { data } = await api.get(`/admin/students/${student._id}`);
            setSelectedStudent(data);
            setShowViewModal(true);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setViewingStudentId(null);
        }
    };

    const openFaceModal = (student) => {
        setSelectedStudent(student);
        setShowFaceModal(true);
    };

    const toggleEditPermission = async (student) => {
        // Prevent rapid clicking
        if (togglingStudentId === student._id) return;

        // Optimistic update - immediately toggle in UI
        const previousValue = student.canEditProfile;
        setTogglingStudentId(student._id);
        setStudents(prev => prev.map(s =>
            s._id === student._id ? { ...s, canEditProfile: !s.canEditProfile } : s
        ));

        try {
            await api.put(`/admin/students/${student._id}/permission`);
            // Success - keep the optimistic update
        } catch (err) {
            // Revert on error
            setStudents(prev => prev.map(s =>
                s._id === student._id ? { ...s, canEditProfile: previousValue } : s
            ));
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setTogglingStudentId(null);
        }
    };

    const getTitle = () => {
        switch (view) {
            case 'leaves': return 'Leave Management';
            case 'reports': return 'Attendance Reports';
            case 'session': return 'Attendance';
            case 'zones': return 'Zone Management';
            case 'period-wise': return 'Period-Wise Attendance';
            case 'myclass': return 'My Class';
            case 'staff': return 'Staff Management';
            default: return 'Students Management';
        }
    };

    const getCurrentLeaves = () => {
        switch (leaveTab) {
            case 'approved': return approvedLeaves;
            case 'rejected': return rejectedLeaves;
            default: return pendingLeaves;
        }
    };

    return (
        <Layout>
            {/* Faculty Advisor Banner - Only shows for Faculty Advisors */}
            {user?.isFacultyAdvisor && (
                <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-bold text-purple-800">📋 Faculty Advisor</p>
                            <p className="text-sm text-purple-700">
                                Class Incharge: {user.advisorClass?.department} Year {user.advisorClass?.year}
                                {user.advisorClass?.section && ` - Section ${user.advisorClass?.section}`}
                            </p>
                        </div>
                        <a href="/staff/dashboard?view=session" className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 text-sm">
                            📝 Mark Class Attendance
                        </a>
                    </div>
                </div>
            )}

            {/* Super Admin Banner */}
            {user?.role === 'superadmin' && (
                <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-bold text-blue-800">🛡️ Super Admin Control</p>
                            <p className="text-sm text-blue-700">Manage Staff, Assign Advisors, and View Reports</p>
                        </div>
                        <div className="flex gap-2">
                            <a href="/staff/dashboard?view=staff" className={`px-4 py-2 rounded-lg font-medium text-sm ${view === 'staff' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}>
                                👥 Staff Management
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* New Staff Credentials Alert */}
            {createdStaffCreds && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 relative">
                    <button onClick={() => setCreatedStaffCreds(null)} className="absolute top-2 right-2 text-green-600 hover:text-green-800"><XMarkIcon className="h-5 w-5" /></button>
                    <p className="font-bold text-green-800 mb-2">✅ New Staff Account Created!</p>
                    <div className="text-green-700 text-sm font-mono bg-green-100 p-2 rounded inline-block">
                        <p>Name: {createdStaffCreds.name}</p>
                        <p>ID: {createdStaffCreds.staffId}</p>
                        <p>Password: {createdStaffCreds.password}</p>
                    </div>
                    <p className="text-xs text-green-600 mt-2">Please copy these credentials. The password will not be shown again.</p>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPasswordModal(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Change My Password</h3>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                                    <input type="password" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm border p-2"
                                        value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                                    <input type="password" required minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm border p-2"
                                        value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                                </div>
                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                    <button type="submit" className="inline-flex w-full justify-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 sm:col-start-2">Update Password</button>
                                    <button type="button" className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        {getTitle()}
                    </h2>
                </div>
                {view === 'students' && (
                    <div className="mt-4 flex gap-2 md:ml-4 md:mt-0">
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            <KeyIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
                            Password
                        </button>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200 border"
                        >
                            📥 Import Excel
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
                        >
                            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                            Add Student
                        </button>
                    </div>
                )}
            </div>


            {/* Students List View */}
            {
                view === 'students' && (
                    <>
                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3">
                            {loadingStudents && (
                                <div className="py-12 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
                                    <p className="text-gray-500 mt-3">Loading students...</p>
                                </div>
                            )}
                            {!loadingStudents && students.length === 0 && (
                                <div className="py-8 text-center text-gray-500">No students found.</div>
                            )}
                            {!loadingStudents && students.map((student) => (
                                <div key={student._id} className="bg-white shadow rounded-lg p-4 border">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{student.name}</h3>
                                            <p className="text-sm text-gray-500">{student.department} • Roll: {student.rollNumber}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {student.faceEmbedding?.length > 0 ? (
                                                <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded">✓ Face</span>
                                            ) : (
                                                <span className="text-yellow-600 text-xs bg-yellow-50 px-2 py-1 rounded">✗ No Face</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Can Edit:</span>
                                            <button
                                                onClick={() => toggleEditPermission(student)}
                                                disabled={togglingStudentId === student._id}
                                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${student.canEditProfile ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${student.canEditProfile ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => openViewModal(student)} className="p-2 text-gray-600 hover:bg-gray-100 rounded" title="View">
                                                <EyeIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => openEditModal(student)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit">
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => openFaceModal(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Register Face">
                                                <CameraIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => handleDeleteStudent(student._id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => handleResetPassword(student._id, student.name)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded" title="Reset Password">
                                                <KeyIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden sm:block shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Roll No</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell">Department</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Face</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Can Edit</th>
                                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loadingStudents && (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                                                    <p className="text-gray-500">Loading students...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingStudents && students.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-gray-500">No students found.</td></tr>}
                                    {!loadingStudents && students.map((student) => (
                                        <tr key={student._id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                {student.name}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{student.rollNumber}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">{student.department}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                {student.faceEmbedding?.length > 0 ? <span className="text-green-600">✓</span> : <span className="text-yellow-600">✗</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <button
                                                    onClick={() => toggleEditPermission(student)}
                                                    disabled={togglingStudentId === student._id}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${togglingStudentId === student._id ? 'opacity-50 cursor-wait' : ''} ${student.canEditProfile ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    role="switch"
                                                    aria-checked={student.canEditProfile}
                                                    title={student.canEditProfile ? 'Click to disable' : 'Click to enable'}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${student.canEditProfile ? 'translate-x-5' : 'translate-x-0'}`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <div className="flex gap-2 items-center justify-end">
                                                    <button
                                                        onClick={() => openViewModal(student)}
                                                        disabled={viewingStudentId === student._id}
                                                        className={`p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded ${viewingStudentId === student._id ? 'opacity-50 cursor-wait' : ''}`}
                                                        title="View"
                                                    >
                                                        {viewingStudentId === student._id ? (
                                                            <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                                                        ) : (
                                                            <EyeIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button onClick={() => openEditModal(student)} className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => openFaceModal(student)} className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded" title="Register Face"><CameraIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => handleDeleteStudent(student._id)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => handleResetPassword(student._id, student.name)} className="p-1.5 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded" title="Reset Password"><KeyIcon className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )
            }

            {/* Staff Management View */}
            {
                view === 'staff' && user?.role === 'superadmin' && (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <div className="mb-4 flex justify-end">
                            <button onClick={() => setShowStaffModal(true)} className="bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-500 text-sm font-medium">Add Staff</button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="w-full py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Advisor</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Classes Today</th>
                                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {staffList.map((staff) => (
                                    <tr key={staff._id}>
                                        <td className="px-3 py-4 text-sm font-medium text-gray-900">{staff.name}<br /><span className="text-xs text-gray-500">{staff.staffId}</span></td>
                                        <td className="px-3 py-4 text-sm text-gray-500">{staff.role}</td>
                                        <td className="px-3 py-4 text-sm text-gray-500">{staff.isFacultyAdvisor ? `${staff.advisorClass?.department} ${staff.advisorClass?.year}` : '-'}</td>
                                        <td className="px-3 py-4 text-sm text-gray-500">{staff.todaysSessions?.length || 0}</td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <div className="flex gap-2 items-center justify-end">
                                                <button onClick={() => { setResetPasswordId(staff._id); setShowResetModal(true); }} className="text-orange-600 hover:text-orange-900"><KeyIcon className="h-4 w-4" /></button>
                                                <button onClick={() => { /* Implement delete */ }} className="text-red-600 hover:text-red-900"><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* My Class View (Faculty Advisor) */}
            {
                view === 'myclass' && user?.isFacultyAdvisor && (
                    <div className="space-y-6">
                        {/* Absentees Alert */}
                        {absentees.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="text-lg font-bold text-red-800 mb-2">⚠️ Today's Absentees (Period 1)</h3>
                                <ul className="list-disc list-inside text-red-700 text-sm">
                                    {absentees.map(s => (
                                        <li key={s._id}>{s.name} ({s.rollNumber}) - Parent: {s.parentPhone || 'N/A'}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 pl-4 text-left text-xs font-semibold text-gray-900">Name</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900">Roll No</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900">Phone</th>
                                        <th className="relative py-3 pl-3 pr-4 sm:pr-6 text-right text-xs font-semibold text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {myStudents.map(s => (
                                        <tr key={s._id}>
                                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{s.name}</td>
                                            <td className="px-3 py-2 text-sm text-gray-500">{s.rollNumber}</td>
                                            <td className="px-3 py-2 text-sm text-gray-500">{s.phone || '-'}</td>
                                            <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <div className="flex gap-2 items-center justify-end">
                                                    <button onClick={() => openViewModal(s)} className="text-blue-600 hover:text-blue-900"><EyeIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => openEditModal(s)} className="text-indigo-600 hover:text-indigo-900"><PencilIcon className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Attendance View */}
            {
                view === 'attendance' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                {/* Cascading Filter Inputs */}
                                <select
                                    value={classFilter.department}
                                    onChange={e => setClassFilter({ ...classFilter, department: e.target.value, year: '', section: '' })}
                                    className="border p-2 rounded"
                                >
                                    <option value="">Select Dept</option>
                                    {classFilters.departments?.map(d => <option key={d}>{d}</option>)}
                                </select>
                                <select
                                    value={classFilter.year}
                                    onChange={e => setClassFilter({ ...classFilter, year: e.target.value, section: '' })}
                                    className="border p-2 rounded"
                                    disabled={!classFilter.department}
                                >
                                    <option value="">Select Year</option>
                                    {/* Show only years available for selected department */}
                                    {classFilter.department && classFilters.hierarchy?.[classFilter.department] &&
                                        Object.keys(classFilters.hierarchy[classFilter.department]).sort().map(y =>
                                            <option key={y}>{y}</option>
                                        )
                                    }
                                </select>
                                <select
                                    value={classFilter.section}
                                    onChange={e => setClassFilter({ ...classFilter, section: e.target.value })}
                                    className="border p-2 rounded"
                                    disabled={!classFilter.year}
                                >
                                    <option value="">Select Section</option>
                                    {/* Show only sections available for selected department+year */}
                                    {classFilter.department && classFilter.year &&
                                        classFilters.hierarchy?.[classFilter.department]?.[classFilter.year]?.map(s =>
                                            <option key={s}>{s}</option>
                                        )
                                    }
                                </select>
                                <input value={classFilter.period} onChange={e => setClassFilter({ ...classFilter, period: e.target.value })} placeholder="Period" className="border p-2 rounded" />
                                <input type="date" value={classFilter.date} onChange={e => setClassFilter({ ...classFilter, date: e.target.value })} className="border p-2 rounded" />
                                <button onClick={loadClassStudents} className="bg-brand-600 text-white rounded p-2">Load</button>
                            </div>
                        </div>
                        {classStudents.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-4">
                                <div className="flex justify-between mb-4">
                                    <button onClick={handleMarkAllPresent} className="bg-green-100 text-green-800 px-3 py-1 rounded">Mark All Present</button>
                                    <button onClick={handleSubmitClassAttendance} className="bg-brand-600 text-white px-3 py-1 rounded">Submit</button>
                                </div>
                                {classStudents.map(s => (
                                    <div key={s._id} className="flex justify-between items-center border-b py-2">
                                        <span>{s.name} ({s.rollNumber})</span>
                                        <select value={classAttendance[s._id]} onChange={e => setClassAttendance({ ...classAttendance, [s._id]: e.target.value })} className="border rounded p-1">
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                            <option value="Half Day">Half Day</option>
                                            <option value="Leave">Leave</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Session View */}
            {
                view === 'session' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <h3 className="text-lg font-semibold mb-4">Start New Session</h3>
                            <form onSubmit={handleStartSession} className="space-y-4">
                                {/* Class Selection - Cascading */}
                                <div className="grid grid-cols-3 gap-4">
                                    <select
                                        value={newSession.department}
                                        onChange={e => setNewSession({ ...newSession, department: e.target.value, year: '', section: '', subject: '' })}
                                        required
                                        className="border p-2 rounded"
                                    >
                                        <option value="">Select Dept</option>
                                        {classFilters.departments?.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                    <select
                                        value={newSession.year}
                                        onChange={e => setNewSession({ ...newSession, year: e.target.value, section: '' })}
                                        required
                                        className="border p-2 rounded"
                                        disabled={!newSession.department}
                                    >
                                        <option value="">Select Year</option>
                                        {newSession.department && classFilters.hierarchy?.[newSession.department] &&
                                            Object.keys(classFilters.hierarchy[newSession.department]).sort().map(y =>
                                                <option key={y}>{y}</option>
                                            )
                                        }
                                    </select>
                                    <select
                                        value={newSession.section}
                                        onChange={e => setNewSession({ ...newSession, section: e.target.value })}
                                        className="border p-2 rounded"
                                        disabled={!newSession.year}
                                    >
                                        <option value="">All Sections</option>
                                        {newSession.department && newSession.year &&
                                            classFilters.hierarchy?.[newSession.department]?.[newSession.year]?.map(s =>
                                                <option key={s}>{s}</option>
                                            )
                                        }
                                    </select>
                                </div>

                                {/* Period Selection - SIMPLIFIED MANUAL INPUTS */}
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 className="text-sm font-semibold text-blue-800 mb-3">📚 Period & Subject Details</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        {/* Periods - Manual Input */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Period(s)</label>
                                            <input
                                                type="text"
                                                value={newSession.periods}
                                                onChange={e => setNewSession({ ...newSession, periods: e.target.value })}
                                                placeholder="e.g., 1 or 1-2 or 1-4"
                                                className="border p-2 rounded w-full"
                                                required
                                            />
                                            <span className="text-xs text-gray-500">Single: 1, Multiple: 1-2, Lab: 1-4</span>
                                        </div>

                                        {/* Subject - Manual Input */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                                            <input
                                                type="text"
                                                value={newSession.subject}
                                                onChange={e => setNewSession({ ...newSession, subject: e.target.value })}
                                                placeholder="e.g., Tamil, Physics Lab"
                                                className="border p-2 rounded w-full"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Session Preview */}
                                    <div className="bg-white p-3 rounded border">
                                        <span className="text-xs text-gray-500">Session Name Preview:</span>
                                        <p className="font-semibold text-gray-800">
                                            {getPeriodDisplay(newSession.periods, newSession.subject) || 'Enter period and subject...'}
                                        </p>
                                    </div>
                                </div>

                                {/* Duration - Manual Input with Quick Close Support */}
                                <div className="bg-gray-50 p-3 rounded border">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Session Duration</label>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <input
                                            type="number"
                                            min="1"
                                            max="300"
                                            value={newSession.duration}
                                            onChange={e => setNewSession({ ...newSession, duration: parseInt(e.target.value) || 45 })}
                                            className="border p-2 rounded w-24 text-center"
                                        />
                                        <span className="text-sm text-gray-600">minutes</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">💡 Enter duration in minutes (e.g., 45 for one period, 90 for two periods)</p>
                                </div>

                                {/* Geofencing UI */}
                                <div className="border p-3 rounded bg-gray-50">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={newSession.enableGeofencing} onChange={e => setNewSession({ ...newSession, enableGeofencing: e.target.checked })} />
                                        <span className="font-medium">Enable Geofencing</span>
                                    </label>
                                    {newSession.enableGeofencing && (
                                        <div className="mt-2 pl-6 space-y-3">
                                            {/* Saved Zones Dropdown */}
                                            <div>
                                                <label className="text-xs font-medium">Use Saved Zone:</label>
                                                <select
                                                    value={selectedZoneId}
                                                    onChange={e => handleSelectZone(e.target.value)}
                                                    className="border rounded p-1 ml-2 text-sm"
                                                >
                                                    <option value="">-- Manual Entry --</option>
                                                    {zones.map(z => (
                                                        <option key={z._id} value={z._id}>{z.name} ({z.radius}m)</option>
                                                    ))}
                                                </select>
                                                <a href="/staff/dashboard?view=zones" className="ml-2 text-blue-600 text-xs underline hover:text-blue-800">Manage Zones →</a>
                                            </div>

                                            {/* Manual Location Entry */}
                                            {!selectedZoneId && (
                                                <>
                                                    <button type="button" onClick={captureLocation} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">📍 Set Current Location</button>
                                                    {newSession.location && <span className="text-xs text-green-600 ml-2">Lat: {newSession.location.latitude.toFixed(4)}, Lon: {newSession.location.longitude.toFixed(4)}</span>}
                                                </>
                                            )}

                                            <div>
                                                <span className="text-xs">Radius (m):</span>
                                                <input type="number" value={newSession.location?.radius || 50} onChange={e => setNewSession({ ...newSession, location: { ...newSession.location, radius: parseInt(e.target.value) } })} className="border rounded p-1 ml-2 w-20" />
                                            </div>
                                        </div>
                                    )}
                                    {/* Face Verification Toggle */}
                                    <div className="border p-3 rounded bg-purple-50 mt-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newSession.requiresFaceVerification}
                                                onChange={e => setNewSession({ ...newSession, requiresFaceVerification: e.target.checked })}
                                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                            />
                                            <span className="font-medium text-purple-900">Require Face Verification (QR + Face)</span>
                                        </label>
                                        <p className="text-xs text-purple-600 mt-1 pl-6">
                                            🛡️ Students must scan the QR code AND verify their identity using facial recognition. This bypasses GPS issues.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={startingSession}
                                    className={`w-full py-2 rounded-md text-white font-medium flex items-center justify-center gap-2 ${startingSession ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
                                >
                                    {startingSession ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                            Starting...
                                        </>
                                    ) : 'Start Session'}
                                </button>
                            </form>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
                            {activeSessions.length === 0 && (
                                <p className="text-gray-500 text-center py-4">No active sessions</p>
                            )}
                            {activeSessions.map(s => (
                                <div key={s._id} className="flex justify-between items-center border-b py-3">
                                    <div>
                                        <p className="font-medium text-gray-900">{s.period}</p>
                                        <p className="text-sm text-gray-500">{s.department} {s.year}{s.section ? `-${s.section}` : ''} • Ends: {new Date(s.endTime).toLocaleTimeString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenQRModal(s)}
                                            className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-sm hover:bg-purple-200 flex items-center gap-1"
                                        >
                                            📱 QR
                                        </button>
                                        <button onClick={() => handleCloseSession(s._id)} className="text-red-600 text-sm hover:bg-red-50 px-2 py-1 rounded">End</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Student Lookup - For identity verification */}
                        <div className="bg-white p-6 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <h3 className="text-lg font-semibold mb-4">🔍 Student Lookup</h3>
                            <p className="text-sm text-gray-500 mb-4">Search for a student by name or roll number to verify their identity.</p>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Enter name or roll number..."
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleStudentSearch()}
                                    className="flex-1 border border-gray-300 rounded-lg p-2"
                                />
                                <button
                                    onClick={handleStudentSearch}
                                    disabled={searchLoading}
                                    className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-500 disabled:opacity-50"
                                >
                                    {searchLoading ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border rounded-lg divide-y">
                                    {searchResults.map(student => (
                                        <div
                                            key={student._id}
                                            className="flex items-center gap-4 p-3 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => setSelectedStudentView(student)}
                                        >
                                            {student.profilePhoto ? (
                                                <img
                                                    src={student.profilePhoto}
                                                    alt={student.name}
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                    <span className="text-lg font-semibold">{student.name?.charAt(0)}</span>
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-900">{student.name}</p>
                                                <p className="text-sm text-gray-500">Roll: {student.rollNumber} • {student.department} {student.year}-{student.section}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {studentSearch && searchResults.length === 0 && !searchLoading && (
                                <p className="text-gray-500 text-center py-4">No students found matching "{studentSearch}"</p>
                            )}
                        </div>
                    </div >
                )
            }

            {/* Zones View - Separate from Session */}
            {
                view === 'zones' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Saved Zones</h3>
                                <button
                                    onClick={() => setShowZoneModal(true)}
                                    className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-500 text-sm font-medium"
                                >
                                    + Add New Zone
                                </button>
                            </div>

                            {zones.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                                    <p className="text-gray-500 mb-2">No saved zones yet</p>
                                    <p className="text-sm text-gray-400">Create zones to quickly start sessions with predefined locations.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {zones.map(zone => (
                                        <div key={zone._id} className="border rounded-lg p-4 hover:shadow-md transition">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-2">{zone.name}</h4>
                                                    <div className="space-y-1 text-sm text-gray-600">
                                                        <p>📍 Lat: {zone.latitude.toFixed(5)}, Lon: {zone.longitude.toFixed(5)}</p>
                                                        <p>📏 Radius: {zone.radius}m</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteZone(zone._id)}
                                                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                                                    title="Delete Zone"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Period-Wise Attendance View - Separate from Session */}
            {
                view === 'period-wise' && (
                    <div className="bg-white p-6 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                        <h3 className="text-lg font-semibold mb-2">📊 Period-Wise Attendance</h3>
                        <p className="text-sm text-gray-500 mb-4">View attendance breakdown for classes you've taken.</p>

                        {/* Filters */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <input
                                type="date"
                                value={periodWiseDate}
                                onChange={e => setPeriodWiseDate(e.target.value)}
                                className="border rounded-lg p-2"
                            />
                            <select
                                value={periodWiseFilters.department}
                                onChange={e => setPeriodWiseFilters({ ...periodWiseFilters, department: e.target.value })}
                                className="border rounded-lg p-2"
                            >
                                <option value="">All Departments</option>
                                {classFilters.departments.map(d => <option key={d}>{d}</option>)}
                            </select>
                            <select
                                value={periodWiseFilters.year}
                                onChange={e => setPeriodWiseFilters({ ...periodWiseFilters, year: e.target.value })}
                                className="border rounded-lg p-2"
                            >
                                <option value="">All Years</option>
                                {classFilters.years.map(y => <option key={y}>{y}</option>)}
                            </select>
                            <select
                                value={periodWiseFilters.section}
                                onChange={e => setPeriodWiseFilters({ ...periodWiseFilters, section: e.target.value })}
                                className="border rounded-lg p-2"
                            >
                                <option value="">All Sections</option>
                                {classFilters.sections.map(s => <option key={s}>{s}</option>)}
                            </select>
                            <button
                                onClick={fetchPeriodWiseAttendance}
                                disabled={periodWiseLoading}
                                className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-500 disabled:opacity-50"
                            >
                                {periodWiseLoading ? 'Loading...' : '🔍 View Report'}
                            </button>
                        </div>

                        {/* Class Summary */}
                        {periodWiseData && periodWiseData.classSummary && Object.keys(periodWiseData.classSummary).length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg mb-4">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">📈 Class Summary for {periodWiseData.date}</h4>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(periodWiseData.classSummary).map(([period, stats]) => (
                                        <div key={period} className="bg-white px-3 py-2 rounded-lg text-xs">
                                            <span className="font-medium">{period.length > 20 ? period.slice(0, 20) + '...' : period}</span>
                                            <span className="mx-2">|</span>
                                            <span className="text-green-600">✓ {stats.present}</span>
                                            <span className="mx-1">/</span>
                                            <span className="text-red-600">✗ {stats.absent}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Period-Wise Table */}
                        {periodWiseData && periodWiseData.students && periodWiseData.students.length > 0 ? (
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                                            {periodWiseData.periods.map(period => (
                                                <th key={period} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase" title={period}>
                                                    {period.length > 15 ? period.slice(0, 15) + '...' : period}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Summary</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {periodWiseData.students.map(student => (
                                            <tr key={student._id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {student.profilePhoto ? (
                                                            <img src={student.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold">{student.name?.charAt(0)}</div>
                                                        )}
                                                        <span className="text-sm font-medium text-gray-900">{student.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{student.rollNumber}</td>
                                                {periodWiseData.periods.map(period => (
                                                    <td key={period} className="px-3 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(student.periods[period]?.status)}`}>
                                                            {student.periods[period]?.status === 'Present' ? '✓' :
                                                                student.periods[period]?.status === 'Absent' ? '✗' :
                                                                    student.periods[period]?.status === 'Half Day' ? '½' : '—'}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-center text-sm">
                                                    <span className="text-green-600 font-medium">{student.summary?.present || 0}</span>
                                                    <span className="text-gray-400 mx-1">/</span>
                                                    <span className="text-red-600 font-medium">{student.summary?.absent || 0}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : periodWiseData && periodWiseData.students?.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No students found for the selected filters</p>
                        ) : (
                            <p className="text-gray-400 text-center py-8 border-2 border-dashed rounded-lg">
                                Select filters and click "View Report" to see period-wise attendance
                            </p>
                        )}
                    </div>
                )
            }

            {/* Leaves View */}
            {
                view === 'leaves' && (
                    <div>
                        <div className="border-b border-gray-200 mb-6">
                            <nav className="-mb-px flex space-x-8">
                                <button onClick={() => setLeaveTab('pending')} className={`${leaveTab === 'pending' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}>
                                    ⏳ Pending <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">{pendingLeaves.length}</span>
                                </button>
                                <button onClick={() => setLeaveTab('approved')} className={`${leaveTab === 'approved' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}>
                                    ✅ Approved <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">{approvedLeaves.length}</span>
                                </button>
                                <button onClick={() => setLeaveTab('rejected')} className={`${leaveTab === 'rejected' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}>
                                    ❌ Rejected <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">{rejectedLeaves.length}</span>
                                </button>
                            </nav>
                        </div>
                        <div className="space-y-4">
                            {getCurrentLeaves().length === 0 && <p className="text-gray-500 py-8 text-center">No {leaveTab} leave requests.</p>}
                            {getCurrentLeaves().map((leave) => (
                                <div key={leave._id} className="bg-white p-6 shadow sm:rounded-lg ring-1 ring-black ring-opacity-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-gray-900">{leave.student?.name}</p>
                                                <span className="text-xs text-gray-500">({leave.student?.rollNumber})</span>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${leave.status === 'Approved' ? 'bg-green-100 text-green-800' : leave.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{leave.status}</span>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600">
                                                <p><span className="font-medium">Reason:</span> {leave.reason}</p>
                                                <p className="text-xs text-gray-500 mt-1">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                                                {leave.status === 'Rejected' && leave.rejectionReason && (
                                                    <p className="mt-2 text-red-600 text-sm"><span className="font-medium">Rejection:</span> {leave.rejectionReason}</p>
                                                )}
                                            </div>
                                        </div>
                                        {leaveTab === 'pending' && (
                                            <div className="flex gap-2 ml-4">
                                                <button onClick={() => handleApproveLeave(leave._id)} className="rounded-md bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-600 hover:bg-green-100 flex items-center gap-1"><CheckIcon className="h-4 w-4" />Approve</button>
                                                <button onClick={() => openRejectModal(leave)} className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100 flex items-center gap-1"><XMarkIcon className="h-4 w-4" />Reject</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Reports View */}
            {
                view === 'reports' && (
                    <div className="space-y-4">
                        {/* Filters and Export Bar */}
                        <div className="bg-white p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5">
                            <div className="flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={reportFilters?.startDate || ''}
                                        onChange={e => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                                        className="border rounded p-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={reportFilters?.endDate || ''}
                                        onChange={e => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                                        className="border rounded p-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                                    <select
                                        value={reportFilters?.department || ''}
                                        onChange={e => setReportFilters({ ...reportFilters, department: e.target.value })}
                                        className="border rounded p-2 text-sm"
                                    >
                                        <option value="">All</option>
                                        {classFilters.departments.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={handleExportExcel}
                                        className="inline-flex items-center px-3 py-2 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
                                    >
                                        📊 Excel
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                                    >
                                        📄 PDF
                                    </button>
                                    <button
                                        onClick={() => setShowManualModal(true)}
                                        className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                                    >
                                        + Mark Attendance
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Reports Table */}
                        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Photo</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Student</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Time</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {reports.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-gray-500">No attendance records.</td></tr>}
                                    {reports.map((r) => (
                                        <tr key={r._id}>
                                            <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm sm:pl-6">
                                                {r.capturedPhoto ? (
                                                    <img src={r.capturedPhoto} alt="Capture" className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(r.capturedPhoto, '_blank')} />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">{r.isManual ? 'M' : '-'}</div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <p className="font-medium text-gray-900">{r.student?.name}</p>
                                                <p className="text-xs text-gray-500">{r.student?.rollNumber}</p>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {r.time ? new Date(r.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <select
                                                    value={r.status}
                                                    onChange={(e) => handleStatusChange(r._id, e.target.value)}
                                                    className={`rounded-md border-0 py-1 px-2 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-brand-500 ${r.status === 'Present' ? 'bg-green-100 text-green-800' :
                                                        r.status === 'Half Day' ? 'bg-yellow-100 text-yellow-800' :
                                                            r.status === 'Leave' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    <option value="Present">✓ Present</option>
                                                    <option value="Absent">✗ Absent</option>
                                                    <option value="Half Day">½ Half Day</option>
                                                    <option value="Leave">📋 Leave</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Add Student Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-6 text-gray-900">Add New Student</h3>
                            <form onSubmit={handleAddStudent} className="space-y-4">
                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                    <input
                                        placeholder="Enter student's full name"
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                        required
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Roll Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                                        <input
                                            placeholder="e.g., 01, 02, 10"
                                            className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                            required
                                            value={newStudent.rollNumber}
                                            onChange={e => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                                        />
                                        <span className="text-xs text-gray-500">Use 01, 02 for single digits</span>
                                    </div>

                                    {/* DOB */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                                        <input
                                            type="date"
                                            className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                            required
                                            value={newStudent.dob}
                                            onChange={e => setNewStudent({ ...newStudent, dob: e.target.value })}
                                        />
                                        <span className="text-xs text-gray-500">This will be login password</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Department */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                        <input
                                            placeholder="e.g., CSE, ECE, AI & DS"
                                            className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                            value={newStudent.department}
                                            onChange={e => setNewStudent({ ...newStudent, department: e.target.value })}
                                        />
                                    </div>

                                    {/* Year Dropdown */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                        <select
                                            className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border bg-white"
                                            value={newStudent.year}
                                            onChange={e => setNewStudent({ ...newStudent, year: e.target.value })}
                                        >
                                            <option value="">Select Year</option>
                                            <option value="First Year">First Year</option>
                                            <option value="Second Year">Second Year</option>
                                            <option value="Third Year">Third Year</option>
                                            <option value="Final Year">Final Year</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                                    <input
                                        placeholder="e.g., A, B, C (optional)"
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                        value={newStudent.section}
                                        onChange={e => setNewStudent({ ...newStudent, section: e.target.value })}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                    <input
                                        placeholder="student@example.com"
                                        type="email"
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                        required
                                        value={newStudent.email}
                                        onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowAddModal(false)} disabled={addingStudent} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium disabled:opacity-50">Cancel</button>
                                    <button type="submit" disabled={addingStudent} className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium disabled:opacity-50 disabled:cursor-wait min-w-[80px]">
                                        {addingStudent ? 'Creating...' : 'Create Student'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* View Student Details Modal */}
            {
                showViewModal && selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Student Details</h3>
                                <button onClick={() => { setShowViewModal(false); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-500">
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Profile Header */}
                            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                                <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden">
                                    {selectedStudent.profilePhoto ? (
                                        <img src={selectedStudent.profilePhoto} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-brand-600 text-2xl font-bold">{selectedStudent.name?.charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900">{selectedStudent.name}</h4>
                                    <p className="text-sm text-gray-500">Roll No: {selectedStudent.rollNumber}</p>
                                    <div className="flex gap-2 mt-1">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${selectedStudent.faceEmbedding?.length > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {selectedStudent.faceEmbedding?.length > 0 ? '✓ Face Registered' : '✗ Face Not Registered'}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${selectedStudent.canEditProfile ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {selectedStudent.canEditProfile ? '✓ Can Edit Profile' : '✗ Cannot Edit'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bio Data Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Email</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.email || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Phone</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.phone || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Department</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.department || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Year / Section</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.year || '-'} / {selectedStudent.section || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.dob ? new Date(selectedStudent.dob).toLocaleDateString() : '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Blood Group</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.bloodGroup || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Father's Name</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.fatherName || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Mother's Name</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.motherName || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Parent Phone</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.parentPhone || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Emergency Contact</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedStudent.emergencyContact || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                                    <p className="text-xs text-gray-500 uppercase">Address</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {[selectedStudent.address, selectedStudent.city, selectedStudent.state, selectedStudent.pincode].filter(Boolean).join(', ') || '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t">
                                {/* Photo Permission Toggle */}
                                <button
                                    onClick={() => togglePhotoPermission(selectedStudent._id, selectedStudent.canUpdatePhoto)}
                                    disabled={togglingPhotoId === selectedStudent._id}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${togglingPhotoId === selectedStudent._id ? 'opacity-50 cursor-wait' : ''
                                        } ${selectedStudent.canUpdatePhoto
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                                        }`}
                                >
                                    {togglingPhotoId === selectedStudent._id ? (
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                                    ) : (
                                        <CameraIcon className="h-4 w-4" />
                                    )}
                                    {selectedStudent.canUpdatePhoto ? '📷 Photo Update: ON' : '📷 Photo Update: OFF'}
                                </button>
                                <button onClick={() => { setShowViewModal(false); setSelectedStudent(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Student Modal */}
            {
                showEditModal && selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-6 text-gray-900">Edit Student</h3>

                            {/* Student Photo Display */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                                    {selectedStudent.profilePhoto ? (
                                        <img src={selectedStudent.profilePhoto} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-brand-600 text-3xl font-bold">{selectedStudent.name?.charAt(0)}</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 mt-2">To change photo, ask student to update profile</p>
                            </div>
                            <form onSubmit={handleEditStudent} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" required value={selectedStudent.name} onChange={e => setSelectedStudent({ ...selectedStudent, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                                        <input className="w-full bg-gray-100 sm:text-sm p-2 border rounded-md" value={selectedStudent.rollNumber} disabled />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input type="email" className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" required value={selectedStudent.email} onChange={e => setSelectedStudent({ ...selectedStudent, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.department || ''} onChange={e => setSelectedStudent({ ...selectedStudent, department: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.year || ''} onChange={e => setSelectedStudent({ ...selectedStudent, year: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.section || ''} onChange={e => setSelectedStudent({ ...selectedStudent, section: e.target.value })} />
                                    </div>
                                </div>

                                <hr className="my-4" />
                                <h4 className="font-medium text-gray-900">Bio Data</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Phone</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.phone || ''} onChange={e => setSelectedStudent({ ...selectedStudent, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        {/* Empty spacer or another field if needed, for now getting shifted */}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.fatherName || ''} onChange={e => setSelectedStudent({ ...selectedStudent, fatherName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.motherName || ''} onChange={e => setSelectedStudent({ ...selectedStudent, motherName: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.parentPhone || ''} onChange={e => setSelectedStudent({ ...selectedStudent, parentPhone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.emergencyContact || ''} onChange={e => setSelectedStudent({ ...selectedStudent, emergencyContact: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                        <select className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.bloodGroup || ''} onChange={e => setSelectedStudent({ ...selectedStudent, bloodGroup: e.target.value })}>
                                            <option value="">Select</option>
                                            <option value="A+">A+</option><option value="A-">A-</option>
                                            <option value="B+">B+</option><option value="B-">B-</option>
                                            <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                            <option value="O+">O+</option><option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.pincode || ''} onChange={e => setSelectedStudent({ ...selectedStudent, pincode: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.address || ''} onChange={e => setSelectedStudent({ ...selectedStudent, address: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.city || ''} onChange={e => setSelectedStudent({ ...selectedStudent, city: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <input className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" value={selectedStudent.state || ''} onChange={e => setSelectedStudent({ ...selectedStudent, state: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => { setShowEditModal(false); setSelectedStudent(null); }} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Reject Leave Modal */}
            {
                showRejectModal && selectedLeave && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                            <h3 className="text-lg font-bold mb-2 text-gray-900">Reject Leave Request</h3>
                            <p className="text-sm text-gray-500 mb-4">Rejecting leave for: <span className="font-semibold">{selectedLeave.student?.name}</span></p>
                            <form onSubmit={handleRejectLeave}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Rejection *</label>
                                    <textarea rows={3} required value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Please provide a reason..." className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" />
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => { setShowRejectModal(false); setSelectedLeave(null); }} className="px-4 py-2 bg-white text-gray-700 border rounded-md hover:bg-gray-50 text-sm font-medium">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 text-sm font-medium">Reject</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Face Registration Modal */}
            {
                showFaceModal && selectedStudent && (
                    <FaceRegistrationModal student={selectedStudent} onClose={() => { setShowFaceModal(false); setSelectedStudent(null); }} onSuccess={() => { fetchStudents(); }} />
                )
            }

            {/* Manual Attendance Modal */}
            {
                showManualModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                            <h3 className="text-lg font-bold mb-4 text-gray-900">Mark Attendance Manually</h3>
                            <form onSubmit={handleManualAttendance} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                                    <select
                                        required
                                        value={manualAttendance.studentId}
                                        onChange={e => setManualAttendance({ ...manualAttendance, studentId: e.target.value })}
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                    >
                                        <option value="">Select Student</option>
                                        {allStudents.map(s => (
                                            <option key={s._id} value={s._id}>{s.name} ({s.rollNumber})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={manualAttendance.date}
                                        onChange={e => setManualAttendance({ ...manualAttendance, date: e.target.value })}
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                                    <select
                                        required
                                        value={manualAttendance.status}
                                        onChange={e => setManualAttendance({ ...manualAttendance, status: e.target.value })}
                                        className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border"
                                    >
                                        <option value="Present">✓ Present</option>
                                        <option value="Absent">✗ Absent</option>
                                        <option value="Half Day">½ Half Day</option>
                                        <option value="Leave">📋 Leave</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowManualModal(false)} className="px-4 py-2 bg-white text-gray-700 border rounded-md hover:bg-gray-50 text-sm font-medium">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium">Mark Attendance</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Import Excel Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg font-bold mb-2 text-gray-900">📥 Import Students from Excel</h3>
                            <p className="text-sm text-gray-500 mb-4">Upload Excel file downloaded from Google Forms</p>

                            <div className="bg-blue-50 p-4 rounded-lg mb-4 text-sm">
                                <p className="font-semibold text-blue-800 mb-2">Required Excel Columns:</p>
                                <ul className="text-blue-700 space-y-1 text-xs">
                                    <li>✓ Full Name, Roll Number, Email</li>
                                    <li>✓ Date of Birth (used as password)</li>
                                    <li>✓ Department, Year, Section</li>
                                    <li>○ Phone Number, Parent Phone (optional)</li>
                                    <li>○ Profile Photo URL (optional)</li>
                                </ul>
                            </div>

                            {!importResults ? (
                                <form onSubmit={handleImportStudents}>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-500 transition-colors">
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={(e) => setImportFile(e.target.files[0])}
                                            className="hidden"
                                            id="excel-upload"
                                        />
                                        <label htmlFor="excel-upload" className="cursor-pointer">
                                            <div className="text-4xl mb-2">📄</div>
                                            <p className="text-sm text-gray-600">
                                                {importFile ? importFile.name : 'Click to select Excel file'}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, or .csv</p>
                                        </label>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button type="button" onClick={() => { setShowImportModal(false); setImportFile(null); }} className="px-4 py-2 bg-white text-gray-700 border rounded-md hover:bg-gray-50 text-sm font-medium">Cancel</button>
                                        <button type="submit" disabled={!importFile || importing} className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium disabled:opacity-50">
                                            {importing ? 'Importing...' : 'Import Students'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <div className={`p-4 rounded-lg mb-4 ${importResults.success?.length > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <p className="font-semibold">{importResults.message}</p>
                                    </div>
                                    {importResults.success?.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-green-700">✓ {importResults.success.length} students added</p>
                                        </div>
                                    )}
                                    {importResults.errors?.length > 0 && (
                                        <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                                            <p className="text-sm font-medium text-red-700 mb-2">Errors ({importResults.errors.length}):</p>
                                            {importResults.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-600">Row {err.row}: {err.error}</p>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex justify-end mt-6">
                                        <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportResults(null); }} className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-500 text-sm font-medium">Done</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* Zone Management Modal */}
            {
                showZoneModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg font-bold mb-4 text-gray-900">Manage Saved Zones</h3>

                            {/* Create Zone Form */}
                            <form onSubmit={handleCreateZone} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                                <h4 className="font-medium text-gray-700">Add New Zone</h4>
                                <input
                                    placeholder="Zone Name (e.g., Lab A)"
                                    value={newZone.name}
                                    onChange={e => setNewZone({ ...newZone, name: e.target.value })}
                                    required
                                    className="w-full border rounded p-2 text-sm"
                                />
                                <div className="flex gap-2 items-center">
                                    <button type="button" onClick={captureZoneLocation} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">📍 Get Location</button>
                                    {newZone.latitude && <span className="text-xs text-green-600">Lat: {parseFloat(newZone.latitude).toFixed(4)}</span>}
                                </div>
                                <div className="flex gap-3">
                                    <input type="number" placeholder="Lat" value={newZone.latitude} onChange={e => setNewZone({ ...newZone, latitude: e.target.value })} className="w-1/3 border rounded p-2 text-sm" required />
                                    <input type="number" placeholder="Lon" value={newZone.longitude} onChange={e => setNewZone({ ...newZone, longitude: e.target.value })} className="w-1/3 border rounded p-2 text-sm" required />
                                    <input type="number" placeholder="Radius (m)" value={newZone.radius} onChange={e => setNewZone({ ...newZone, radius: parseInt(e.target.value) })} className="w-1/3 border rounded p-2 text-sm" />
                                </div>
                                <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-500">Save Zone</button>
                            </form>

                            {/* Existing Zones List */}
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-700 mb-2">Your Saved Zones</h4>
                                {zones.length === 0 && <p className="text-gray-500 text-sm">No zones saved yet.</p>}
                                {zones.map(zone => (
                                    <div key={zone._id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <div>
                                            <p className="font-medium text-gray-900">{zone.name}</p>
                                            <p className="text-xs text-gray-500">Radius: {zone.radius}m | Lat: {zone.latitude.toFixed(4)}</p>
                                        </div>
                                        <button onClick={() => handleDeleteZone(zone._id)} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end mt-6">
                                <button onClick={() => setShowZoneModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">Close</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Student View-Only Modal (for identity verification) */}
            {
                selectedStudentView && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4">
                                <h3 className="text-lg font-bold text-white">Student Identity</h3>
                                <p className="text-brand-100 text-sm">View-only information for verification</p>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {/* Photo */}
                                <div className="flex justify-center mb-6">
                                    {selectedStudentView.profilePhoto ? (
                                        <img
                                            src={selectedStudentView.profilePhoto}
                                            alt={selectedStudentView.name}
                                            className="w-32 h-32 rounded-full object-cover border-4 border-brand-100 shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border-4 border-brand-100">
                                            <span className="text-4xl font-bold">{selectedStudentView.name?.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="text-center space-y-2">
                                    <h4 className="text-xl font-bold text-gray-900">{selectedStudentView.name}</h4>
                                    <p className="text-lg text-brand-600 font-semibold">Roll No: {selectedStudentView.rollNumber}</p>
                                    <div className="flex justify-center gap-2 flex-wrap">
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">{selectedStudentView.department}</span>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Year {selectedStudentView.year}</span>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Section {selectedStudentView.section}</span>
                                    </div>
                                </div>

                                {/* Notice */}
                                <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-700 text-center">
                                        ℹ️ This is view-only information for identity verification. No editing allowed.
                                    </p>
                                </div>
                            </div>

                            {/* Close Button */}
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setSelectedStudentView(null)}
                                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* QR Attendance Modal */}
            {showQRModal && qrSession && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">📱 QR Attendance</h3>
                            <p className="text-purple-100 text-sm">{qrSession.period}</p>
                        </div>

                        {/* QR Code Display */}
                        <div className="p-6 text-center">
                            {qrLoading ? (
                                <div className="py-12">
                                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
                                    <p className="text-gray-500">Generating QR Code...</p>
                                </div>
                            ) : qrCodeData ? (
                                <div>
                                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4 shadow-lg">
                                        <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
                                    </div>

                                    <div className="mb-4">
                                        <div className="text-sm text-gray-500 mb-1">Refreshes in:</div>
                                        <div className={`text-3xl font-bold ${qrExpiresIn <= 5 ? 'text-red-600 animate-pulse' : 'text-purple-600'}`}>
                                            {qrExpiresIn}s
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                            <div
                                                className="bg-purple-600 h-2 rounded-full transition-all duration-1000"
                                                style={{ width: `${(qrExpiresIn / 30) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-3 rounded-lg text-left text-sm">
                                        <p className="font-medium text-blue-800 mb-1">📋 Instructions:</p>
                                        <ol className="text-blue-700 list-decimal list-inside space-y-1">
                                            <li>Students open their Dashboard</li>
                                            <li>Tap "📷 Scan QR" button</li>
                                            <li>Point camera at this QR</li>
                                            {qrSession.requiresFaceVerification && (
                                                <li className="font-bold text-purple-700 underline">Verify identity via Face Recognition</li>
                                            )}
                                        </ol>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-gray-500">
                                    <p>Failed to generate QR code</p>
                                    <button
                                        onClick={() => generateQRCode(qrSession._id)}
                                        className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                                    >
                                        🔄 Retry
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Session Info */}
                        <div className="px-6 pb-4">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>{qrSession.department} {qrSession.year}{qrSession.section ? `-${qrSession.section}` : ''}</span>
                                <span>Ends: {new Date(qrSession.endTime).toLocaleTimeString()}</span>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div className="px-6 pb-6">
                            <button
                                onClick={handleCloseQRModal}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                            >
                                Close QR Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
