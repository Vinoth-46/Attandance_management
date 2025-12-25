const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Helper for Euclidean Distance
const getEuclideanDistance = (a, b) => {
    if (!a || !b || a.length !== b.length) return Infinity;
    return Math.sqrt(
        a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
};

// Helper for Haversine Distance (in meters)
const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

// @desc    Mark attendance (Student self via face)
// @route   POST /api/attendance/mark
// @access  Student
const AttendanceSession = require('../models/AttendanceSession');

// @desc    Mark attendance (Student self via face)
// @route   POST /api/attendance/mark
// @access  Student
// Liveness Detection Threshold
const LIVENESS_THRESHOLD = 0.8;

const markAttendance = async (req, res) => {
    const { faceDescriptor, capturedPhoto, location, livenessScore } = req.body;
    // location: { latitude, longitude }
    // livenessScore: number between 0 and 1 from face-api liveness detection

    if (!faceDescriptor) {
        return res.status(400).json({ message: 'Face descriptor required' });
    }

    try {
        // Validate liveness if provided
        if (livenessScore !== undefined && livenessScore !== null) {
            console.log(`Liveness Score: ${livenessScore}`);
            if (livenessScore < LIVENESS_THRESHOLD) {
                return res.status(400).json({
                    message: `Liveness check failed. Please ensure you are a real person. Score: ${(livenessScore * 100).toFixed(1)}%`,
                    livenessScore
                });
            }
        }

        const student = await User.findById(req.user.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const storedFace = student.faceEmbedding;

        if (!storedFace || storedFace.length === 0) {
            return res.status(400).json({ message: 'Face not registered. Contact Admin.' });
        }

        const distance = getEuclideanDistance(Object.values(faceDescriptor), storedFace);
        console.log(`Face Match Distance: ${distance}`);

        if (distance > 0.6) {
            return res.status(401).json({ message: 'Face not matched', distance });
        }

        // Get Active Session to check Geofence
        const now = new Date();
        const activeSession = await AttendanceSession.findOne({
            department: student.department,
            year: student.year,
            $or: [{ section: student.section }, { section: null }, { section: '' }],
            status: 'active',
            endTime: { $gt: now }
        });

        if (activeSession && activeSession.location && activeSession.location.latitude) {
            if (!location || !location.latitude || !location.longitude) {
                return res.status(400).json({ message: 'Location permission required to mark attendance.' });
            }

            const distMeters = getDistanceFromLatLonInM(
                activeSession.location.latitude,
                activeSession.location.longitude,
                location.latitude,
                location.longitude
            );

            // Add 20% tolerance for GPS inaccuracy (especially on laptops)
            const toleranceRadius = activeSession.location.radius * 1.2;

            console.log(`Geofence Check:
  Session Location: (${activeSession.location.latitude}, ${activeSession.location.longitude})
  Student Location: (${location.latitude}, ${location.longitude})
  Distance: ${distMeters.toFixed(2)}m | Radius: ${activeSession.location.radius}m | With Tolerance: ${toleranceRadius.toFixed(0)}m`);

            if (distMeters > toleranceRadius) {
                return res.status(400).json({
                    message: `You are ${Math.round(distMeters)}m away from the class location. Maximum allowed: ${activeSession.location.radius}m. Try again or ask staff to increase radius.`,
                    details: {
                        yourDistance: Math.round(distMeters),
                        maxAllowed: activeSession.location.radius,
                        sessionLocation: {
                            lat: activeSession.location.latitude.toFixed(5),
                            lon: activeSession.location.longitude.toFixed(5)
                        },
                        yourLocation: {
                            lat: location.latitude.toFixed(5),
                            lon: location.longitude.toFixed(5)
                        }
                    }
                });
            }
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Get the period from active session (if exists) to allow multiple periods per day
        const sessionPeriod = activeSession ? activeSession.period : null;

        // Check if already marked for THIS SPECIFIC PERIOD today (not just any attendance today)
        const existingQuery = {
            student: req.user.id,
            date: { $gte: startOfDay, $lte: endOfDay }
        };

        // If there's an active session, check by that specific period
        if (sessionPeriod) {
            existingQuery.period = sessionPeriod;
        }

        const existingAttendance = await Attendance.findOne(existingQuery);

        if (existingAttendance) {
            return res.status(400).json({
                message: sessionPeriod
                    ? `Attendance already marked for ${sessionPeriod}`
                    : 'Attendance already marked for today'
            });
        }

        const attendance = await Attendance.create({
            student: req.user.id,
            date: startOfDay,
            time: new Date(),
            period: sessionPeriod || 'General', // Store the period name
            status: 'Present',
            capturedPhoto: capturedPhoto || null,
            livenessScore: livenessScore || null,
            verified: true,
            isManual: false
        });

        res.status(201).json({ message: 'Attendance marked successfully', attendance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manual attendance marking by admin
// @route   POST /api/attendance/manual
// @access  Staff/Admin
const markManualAttendance = async (req, res) => {
    const { studentId, date, status } = req.body;

    if (!studentId || !date || !status) {
        return res.status(400).json({ message: 'Student ID, date, and status are required' });
    }

    if (!['Present', 'Absent', 'Half Day', 'Leave'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        // Check if record exists for this date
        let attendance = await Attendance.findOne({
            student: studentId,
            date: attendanceDate
        });

        if (attendance) {
            // Update existing record
            attendance.status = status;
            attendance.markedBy = req.user.id;
            attendance.isManual = true;
            await attendance.save();
        } else {
            // Create new record
            attendance = await Attendance.create({
                student: studentId,
                date: attendanceDate,
                time: new Date(),
                status,
                markedBy: req.user.id,
                isManual: true,
                verified: true
            });
        }

        res.json({ message: `Attendance marked as ${status}`, attendance });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my attendance history & stats
// @route   GET /api/attendance/my
// @access  Student
const getMyAttendance = async (req, res) => {
    try {
        const logs = await Attendance.find({ student: req.user.id }).sort({ date: -1, time: -1 });

        // Count UNIQUE DAYS present (not individual period records)
        const presentDates = new Set();
        logs.forEach(l => {
            if (l.status === 'Present' || l.status === 'Half Day') {
                // Use date string (YYYY-MM-DD) to count unique days
                const dateStr = new Date(l.date).toISOString().split('T')[0];
                presentDates.add(dateStr);
            }
        });
        const totalDaysPresent = presentDates.size;

        // Also count total periods for more detailed stats
        const totalPeriodsPresent = logs.filter(l => l.status === 'Present' || l.status === 'Half Day').length;

        res.json({
            logs,
            totalPresent: totalDaysPresent,  // Unique days present
            totalPeriodsPresent  // Total period records (for detailed view)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students for attendance marking
// @route   GET /api/attendance/students
// @access  Staff/Admin
const getStudentsForAttendance = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('name rollNumber department');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all attendance (Staff View)
// @route   GET /api/attendance/report
// @access  Staff/Admin
const getAttendanceReport = async (req, res) => {
    try {
        const report = await Attendance.find()
            .populate('student', 'name rollNumber department profilePhoto')
            .populate('markedBy', 'name')
            .sort({ date: -1, time: -1 });
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get students by class (dept, year, section)
// @route   GET /api/attendance/class/students
// @access  Staff/Admin
const getClassStudents = async (req, res) => {
    const { department, year, section } = req.query;

    try {
        const query = { role: 'student' };
        if (department) query.department = department;
        if (year) query.year = year.toString();
        if (section) query.section = section.toString();

        const students = await User.find(query)
            .select('name rollNumber department year section profilePhoto phone email parentPhone fatherName motherName emergencyContact address city state pincode bloodGroup dob')
            .sort({ rollNumber: 1 });

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark attendance for entire class (bulk)
// @route   POST /api/attendance/class/mark
// @access  Staff/Admin
const markClassAttendance = async (req, res) => {
    const { date, period, attendanceList } = req.body;
    // attendanceList: [{ studentId, status }]

    if (!date || !period || !attendanceList || !Array.isArray(attendanceList)) {
        return res.status(400).json({ message: 'Date, period, and attendance list are required' });
    }

    try {
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        const results = { success: 0, updated: 0, errors: [] };

        for (const item of attendanceList) {
            try {
                const existing = await Attendance.findOne({
                    student: item.studentId,
                    date: attendanceDate,
                    period: period
                });

                if (existing) {
                    existing.status = item.status;
                    existing.markedBy = req.user.id;
                    await existing.save();
                    results.updated++;
                } else {
                    await Attendance.create({
                        student: item.studentId,
                        date: attendanceDate,
                        time: new Date(),
                        period: period,
                        status: item.status,
                        markedBy: req.user.id,
                        isManual: true,
                        verified: true
                    });
                    results.success++;
                }
            } catch (err) {
                results.errors.push({ studentId: item.studentId, error: err.message });
            }
        }

        // Get summary
        const presentCount = attendanceList.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
        const absentCount = attendanceList.filter(a => a.status === 'Absent').length;

        res.json({
            message: `Attendance marked. ${results.success} new, ${results.updated} updated.`,
            summary: {
                total: attendanceList.length,
                present: presentCount,
                absent: absentCount,
                halfDay: attendanceList.filter(a => a.status === 'Half Day').length,
                leave: attendanceList.filter(a => a.status === 'Leave').length
            },
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get attendance status for a class on specific date/period
// @route   GET /api/attendance/class/status
// @access  Staff/Admin
const getClassAttendanceStatus = async (req, res) => {
    const { department, year, section, date, period } = req.query;

    try {
        // Get students in class
        const query = { role: 'student' };
        if (department) query.department = department;
        if (year) query.year = year.toString();
        if (section) query.section = section.toString();

        const students = await User.find(query).select('_id name rollNumber');
        const studentIds = students.map(s => s._id);

        // Get existing attendance for this date/period
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            date: attendanceDate,
            period: period || null
        });

        // Map attendance to students
        const attendanceMap = {};
        attendanceRecords.forEach(a => {
            attendanceMap[a.student.toString()] = a.status;
        });

        const result = students.map(s => ({
            _id: s._id,
            name: s.name,
            rollNumber: s.rollNumber,
            status: attendanceMap[s._id.toString()] || 'Not Marked'
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get unique departments, years, sections for dropdowns (hierarchical)
// @route   GET /api/attendance/class/filters
// @access  Staff/Admin
const getClassFilters = async (req, res) => {
    try {
        // Get all students with department, year, section
        const students = await User.find({ role: 'student' })
            .select('department year section')
            .lean();

        // Build hierarchical structure: department -> years -> sections
        const hierarchy = {};

        students.forEach(s => {
            if (!s.department) return;

            if (!hierarchy[s.department]) {
                hierarchy[s.department] = {};
            }

            if (s.year && !hierarchy[s.department][s.year]) {
                hierarchy[s.department][s.year] = new Set();
            }

            if (s.year && s.section) {
                hierarchy[s.department][s.year].add(s.section);
            }
        });

        // Convert Sets to arrays
        const hierarchyResult = {};
        Object.keys(hierarchy).sort().forEach(dept => {
            hierarchyResult[dept] = {};
            Object.keys(hierarchy[dept]).sort().forEach(year => {
                hierarchyResult[dept][year] = Array.from(hierarchy[dept][year]).sort();
            });
        });

        // Also return flat lists for backward compatibility
        const departments = Object.keys(hierarchyResult).sort();
        const years = [...new Set(students.map(s => s.year).filter(Boolean))].sort();
        const sections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();

        res.json({
            departments,
            years,
            sections,
            hierarchy: hierarchyResult  // New: hierarchical data for cascading
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get absentees for Faculty Advisor's class (Period 1 today)
// @route   GET /api/attendance/fa/absentees
// @access  Faculty Advisor
const getFAAbsentees = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id);
        if (!staff || !staff.isFacultyAdvisor || !staff.advisorClass) {
            return res.status(403).json({ message: 'Not authorized as Faculty Advisor' });
        }

        const { department, year, section } = staff.advisorClass;

        // 1. Get all students in this class
        const students = await User.find({
            role: 'student',
            department,
            year,
            section: section || { $exists: true } // match specific section or any if not defined
        }).select('_id name rollNumber phone parentPhone profilePhoto');

        const studentIds = students.map(s => s._id);

        // 2. Get attendance for today, Period 1
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        // 3. Identify Absentees (Any period)
        const studentAbsenceMap = {};

        attendanceRecords.forEach(a => {
            if (a.status === 'Absent') {
                const sId = a.student.toString();
                if (!studentAbsenceMap[sId]) {
                    studentAbsenceMap[sId] = [];
                }
                studentAbsenceMap[sId].push(a.period);
            }
        });

        const absentees = students
            .filter(s => studentAbsenceMap[s._id.toString()])
            .map(s => ({
                _id: s._id,
                name: s.name,
                rollNumber: s.rollNumber,
                phone: s.phone,
                parentPhone: s.parentPhone,
                profilePhoto: s.profilePhoto,
                periods: studentAbsenceMap[s._id.toString()].sort(), // List of periods absent
                status: 'Absent'
            }));

        res.json(absentees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get period-wise attendance for a class (for FA and Super Admin)
// @route   GET /api/attendance/period-wise
// @access  Staff/Admin
const getPeriodWiseAttendance = async (req, res) => {
    const { department, year, section, date } = req.query;

    try {
        // Build query for students
        const studentQuery = { role: 'student' };
        if (department) studentQuery.department = department;
        if (year) studentQuery.year = year.toString();
        if (section) studentQuery.section = section.toString();

        const students = await User.find(studentQuery)
            .select('_id name rollNumber profilePhoto')
            .sort({ rollNumber: 1 });

        if (students.length === 0) {
            return res.json({ students: [], periods: [], summary: {} });
        }

        const studentIds = students.map(s => s._id);

        // Get date range
        let startDate, endDate;
        if (date) {
            startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Default to today
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        }

        // Build attendance query
        const attendanceQuery = {
            student: { $in: studentIds },
            date: { $gte: startDate, $lte: endDate }
        };

        // Filter by staff if not superadmin
        const staffUser = await User.findById(req.user.id);
        if (staffUser.role !== 'superadmin') {
            // Regular staff see only their own attendance records
            attendanceQuery.markedBy = req.user.id;
        }

        // Get all attendance records for these students on this date
        const attendanceRecords = await Attendance.find(attendanceQuery)
            .populate('student', 'name rollNumber');

        // Get unique periods
        const periods = [...new Set(attendanceRecords.map(a => a.period).filter(Boolean))].sort();

        // Build period-wise attendance map
        const attendanceMap = {};
        attendanceRecords.forEach(a => {
            const studentId = a.student._id.toString();
            if (!attendanceMap[studentId]) {
                attendanceMap[studentId] = {};
            }
            attendanceMap[studentId][a.period] = {
                status: a.status,
                time: a.time
            };
        });

        // Build result
        const result = students.map(s => {
            const studentAttendance = attendanceMap[s._id.toString()] || {};
            const periodData = {};
            let presentCount = 0;
            let absentCount = 0;

            periods.forEach(p => {
                if (studentAttendance[p]) {
                    periodData[p] = studentAttendance[p];
                    if (studentAttendance[p].status === 'Present') presentCount++;
                    else if (studentAttendance[p].status === 'Absent') absentCount++;
                } else {
                    periodData[p] = { status: 'Not Marked', time: null };
                }
            });

            return {
                _id: s._id,
                name: s.name,
                rollNumber: s.rollNumber,
                profilePhoto: s.profilePhoto,
                periods: periodData,
                summary: {
                    present: presentCount,
                    absent: absentCount,
                    total: periods.length
                }
            };
        });

        // Class summary
        const classSummary = {};
        periods.forEach(p => {
            const present = result.filter(r => r.periods[p]?.status === 'Present').length;
            const absent = result.filter(r => r.periods[p]?.status === 'Absent').length;
            const notMarked = result.filter(r => r.periods[p]?.status === 'Not Marked').length;
            classSummary[p] = { present, absent, notMarked, total: students.length };
        });

        res.json({
            date: startDate.toISOString().split('T')[0],
            students: result,
            periods,
            classSummary
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update attendance status (e.g., change Absent to Present)
// @route   PUT /api/attendance/update-status
// @access  Staff/Admin
const updateAttendanceStatus = async (req, res) => {
    const { attendanceId, status } = req.body;

    if (!attendanceId || !status) {
        return res.status(400).json({ message: 'Attendance ID and status are required' });
    }

    if (!['Present', 'Absent', 'Half Day'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const record = await Attendance.findById(attendanceId);

        if (!record) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        // Verify staff owns this attendance record
        if (record.markedBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this attendance' });
        }

        record.status = status;
        await record.save();

        res.json({ message: 'Attendance updated successfully', record });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    markAttendance,
    markManualAttendance,
    updateAttendanceStatus,
    getMyAttendance,
    getStudentsForAttendance,
    getAttendanceReport,
    getClassStudents,
    markClassAttendance,
    getClassAttendanceStatus,
    getClassFilters,
    getFAAbsentees,
    getPeriodWiseAttendance
};
