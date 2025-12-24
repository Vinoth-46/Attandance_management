const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// @desc    Create a new attendance session
// @route   POST /api/sessions
// @access  Staff/Admin
const createSession = async (req, res) => {
    const { department, year, section, period, duration, location, forceCreate, requiresFaceVerification } = req.body;

    if (!department || !year || !period || !duration) {
        return res.status(400).json({ message: 'Department, year, period, and duration are required' });
    }

    try {
        const now = new Date();

        // Check for existing active sessions for the same class by ANY staff
        const existingSession = await AttendanceSession.findOne({
            department,
            year,
            $or: [
                { section: section || null },
                { section: null },
                { section: '' }
            ],
            status: 'active',
            endTime: { $gt: now }
        }).populate('staff', 'name');

        if (existingSession) {
            // Check if it's the same staff - allow closing their own session
            if (existingSession.staff._id.toString() === req.user.id) {
                // Close their own session and allow new one
                existingSession.status = 'closed';
                existingSession.endTime = now;
                await existingSession.save();
            } else {
                // Different staff - check if forceCreate is requested
                const currentUser = await User.findById(req.user.id);
                const canOverride = currentUser?.isFacultyAdvisor || currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

                if (!forceCreate) {
                    return res.status(409).json({
                        conflict: true,
                        message: `Session already active for ${department} ${year}${section ? `-${section}` : ''}`,
                        existingSession: {
                            _id: existingSession._id,
                            period: existingSession.period,
                            staffName: existingSession.staff?.name,
                            startTime: existingSession.startTime,
                            endTime: existingSession.endTime
                        },
                        canOverride: canOverride
                    });
                }

                // Override requested - check if user has permission
                if (!canOverride) {
                    return res.status(403).json({
                        message: 'Only Faculty Advisors and Admins can override existing sessions'
                    });
                }

                // Override allowed - close the existing session
                existingSession.status = 'closed';
                existingSession.endTime = now;
                existingSession.closedBy = req.user.id;
                existingSession.closeReason = 'Overridden by another staff';
                await existingSession.save();
            }
        }

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes

        const session = await AttendanceSession.create({
            staff: req.user.id,
            department,
            year,
            section: section || null,
            period,
            startTime,
            endTime,
            status: 'active',
            location: location || null,
            requiresFaceVerification: requiresFaceVerification === true
        });

        // Get staff name for notification
        const staff = await User.findById(req.user.id).select('name');

        // Emit Socket.io event for real-time notification to students
        const io = req.app.get('io');
        if (io) {
            const room = `class:${department}:${year}:${section || 'all'}`;
            io.to(room).emit('session:started', {
                type: 'session_started',
                message: `${period} by ${staff?.name} is now open for attendance!`,
                session: {
                    _id: session._id,
                    period,
                    staffName: staff?.name,
                    department,
                    year,
                    section,
                    endTime,
                    duration
                }
            });

            // Also emit to all staff
            io.to('staff').emit('session:started', {
                sessionId: session._id,
                period,
                department,
                year,
                section
            });
        }

        res.status(201).json({
            message: `Attendance session started for ${department} - Year ${year}${section ? ` - Section ${section}` : ''}`,
            session
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get active sessions for a student's class (filtering out already marked)
// @route   GET /api/sessions/active
// @access  Student
const getActiveSessionsForStudent = async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Find active sessions for this student's class
        const sessions = await AttendanceSession.find({
            department: student.department,
            year: student.year,
            $or: [
                { section: student.section },
                { section: null },
                { section: '' }
            ],
            status: 'active',
            endTime: { $gt: now }
        }).populate('staff', 'name');

        // Get today's attendance records with their periods
        const markedAttendance = await Attendance.find({
            student: req.user.id,
            date: { $gte: todayStart }
        }).select('period');

        const markedPeriods = markedAttendance.map(a => a.period).filter(Boolean);

        // Filter out sessions where attendance is already marked for that period
        const unMarkedSessions = sessions.filter(session =>
            !markedPeriods.includes(session.period)
        );

        // Format response with time remaining
        const formattedSessions = unMarkedSessions.map(session => ({
            _id: session._id,
            period: session.period,
            staffName: session.staff?.name,
            startTime: session.startTime,
            endTime: session.endTime,
            timeRemaining: Math.max(0, Math.floor((session.endTime - now) / 1000)), // seconds remaining
            location: session.location // Include location for client-side check or UI info
        }));

        res.json(formattedSessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all sessions by staff (for staff dashboard)
// @route   GET /api/sessions/my
// @access  Staff/Admin
const getMySessions = async (req, res) => {
    try {
        const sessions = await AttendanceSession.find({ staff: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current active session by staff
// @route   GET /api/sessions/my/active
// @access  Staff/Admin
const getMyActiveSessions = async (req, res) => {
    try {
        const now = new Date();
        const sessions = await AttendanceSession.find({
            staff: req.user.id,
            status: 'active',
            endTime: { $gt: now }
        });

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper: Mark absences for students who didn't mark attendance
const markAbsencesForSession = async (session) => {
    try {
        // Get all students for this class
        const studentQuery = {
            role: 'student',
            department: session.department,
            year: session.year
        };

        if (session.section) {
            studentQuery.section = session.section;
        }

        const students = await User.find(studentQuery);

        const startOfDay = new Date(session.startTime);
        startOfDay.setHours(0, 0, 0, 0);

        // Get who already marked attendance for this period
        const markedRecords = await Attendance.find({
            date: startOfDay,
            period: session.period
        });

        const markedStudentIds = markedRecords.map(r => r.student.toString());

        // Filter students who haven't marked attendance
        const absentees = students.filter(s => !markedStudentIds.includes(s._id.toString()));

        // Mark them as absent
        for (const student of absentees) {
            await Attendance.create({
                student: student._id,
                date: startOfDay,
                time: new Date(),
                period: session.period,
                status: 'Absent',
                markedBy: session.staff,
                isManual: true,
                verified: true
            });
        }

        console.log(`Auto-marked ${absentees.length} students as absent for ${session.period}`);
    } catch (error) {
        console.error('Error marking absences:', error);
    }
};

// @desc    Close a session manually
// @route   PUT /api/sessions/:id/close
// @access  Staff/Admin
const closeSession = async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (session.staff.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to close this session' });
        }

        // Auto-mark absences before closing
        await markAbsencesForSession(session);

        session.status = 'closed';
        session.endTime = new Date();
        await session.save();

        res.json({ message: 'Session closed and absences marked', session });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auto-close expired sessions (can be called periodically)
const closeExpiredSessions = async () => {
    try {
        const now = new Date();
        const expiredSessions = await AttendanceSession.find({
            status: 'active',
            endTime: { $lte: now }
        });

        for (const session of expiredSessions) {
            await markAbsencesForSession(session);
            session.status = 'closed';
            await session.save();
        }

        console.log(`Auto-closed ${expiredSessions.length} expired sessions`);
    } catch (error) {
        console.error('Error closing expired sessions:', error);
    }
};

// @desc    Get session reports for staff (with present/absent lists)
// @route   GET /api/sessions/my/reports
// @access  Staff/Admin
const getMySessionReports = async (req, res) => {
    try {
        const sessions = await AttendanceSession.find({
            staff: req.user.id
        }).sort({ startTime: -1 }).limit(20);

        const reports = [];
        for (const session of sessions) {
            const startOfDay = new Date(session.startTime);
            startOfDay.setHours(0, 0, 0, 0);

            // Get attendance records for this period
            const records = await Attendance.find({
                date: startOfDay,
                period: session.period
            }).populate('student', 'name rollNumber profilePhoto');

            const present = records.filter(r => r.status === 'Present');
            const absent = records.filter(r => r.status === 'Absent');

            reports.push({
                session: {
                    _id: session._id,
                    period: session.period,
                    department: session.department,
                    year: session.year,
                    section: session.section,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    status: session.status
                },
                presentCount: present.length,
                absentCount: absent.length,
                presentStudents: present.map(r => ({
                    attendanceId: r._id,
                    _id: r.student._id,
                    name: r.student.name,
                    rollNumber: r.student.rollNumber,
                    profilePhoto: r.student.profilePhoto
                })),
                absentStudents: absent.map(r => ({
                    attendanceId: r._id,
                    _id: r.student._id,
                    name: r.student.name,
                    rollNumber: r.student.rollNumber,
                    profilePhoto: r.student.profilePhoto
                }))
            });
        }

        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createSession,
    getActiveSessionsForStudent,
    getMySessions,
    getMyActiveSessions,
    closeSession,
    closeExpiredSessions,
    getMySessionReports
};
