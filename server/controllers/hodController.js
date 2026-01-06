const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get all staff in HOD's department
// @route   GET /api/hod/staff
// @access  HOD
const getAllStaffInDepartment = async (req, res) => {
    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        const staffMembers = await User.find({
            role: 'staff',
            department: hod.assignedDepartment,
            managedBy: req.user.id
        })
            .select('-password')
            .sort({ name: 1 })
            .lean();

        // Get today's sessions for these staff members
        const AttendanceSession = require('../models/AttendanceSession');
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todaysSessions = await AttendanceSession.find({
            startTime: { $gte: startOfDay, $lte: endOfDay }
        });

        // Map sessions to staff
        const staffWithSessions = staffMembers.map(staff => {
            const sessions = todaysSessions.filter(s => s.staff.toString() === staff._id.toString());
            return {
                ...staff,
                todaysSessions: sessions.map(s => ({
                    department: s.department,
                    year: s.year,
                    section: s.section,
                    period: s.period,
                    status: s.status,
                    startTime: s.startTime
                }))
            };
        });

        res.json(staffWithSessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new staff member in HOD's department
// @route   POST /api/hod/staff
// @access  HOD
const createStaff = async (req, res) => {
    const { name, email, phone, staffId, password } = req.body;

    if (!name || !email || !staffId || !password) {
        return res.status(400).json({ message: 'Name, email, staffId, and password are required' });
    }

    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        const exists = await User.findOne({ $or: [{ email }, { staffId }] });
        if (exists) {
            return res.status(400).json({ message: 'Staff with this email or ID already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const staff = await User.create({
            name,
            email,
            phone,
            staffId,
            department: hod.assignedDepartment,
            role: 'staff',
            password: hashedPassword,
            managedBy: req.user.id,
            isFacultyAdvisor: false
        });

        res.status(201).json({
            _id: staff._id,
            name: staff.name,
            email: staff.email,
            staffId: staff.staffId,
            department: staff.department
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update staff member details
// @route   PUT /api/hod/staff/:id
// @access  HOD
const updateStaff = async (req, res) => {
    const { name, email, phone, staffId } = req.body;

    try {
        const staff = await User.findOne({
            _id: req.params.id,
            role: 'staff',
            managedBy: req.user.id
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found or not managed by you' });
        }

        if (name) staff.name = name;
        if (email) staff.email = email;
        if (phone) staff.phone = phone;
        if (staffId) staff.staffId = staffId;

        await staff.save();

        res.json({
            _id: staff._id,
            name: staff.name,
            email: staff.email,
            staffId: staff.staffId,
            department: staff.department
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete staff member
// @route   DELETE /api/hod/staff/:id
// @access  HOD
const deleteStaff = async (req, res) => {
    try {
        const staff = await User.findOne({
            _id: req.params.id,
            role: 'staff',
            managedBy: req.user.id
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found or not managed by you' });
        }

        await staff.deleteOne();
        res.json({ message: `Staff ${staff.name} removed` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset staff password
// @route   PUT /api/hod/staff/:id/password
// @access  HOD
const resetStaffPassword = async (req, res) => {
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const staff = await User.findOne({
            _id: req.params.id,
            role: 'staff',
            managedBy: req.user.id
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found or not managed by you' });
        }

        const salt = await bcrypt.genSalt(10);
        staff.password = await bcrypt.hash(password, salt);
        await staff.save();

        res.json({ message: `Password updated for ${staff.name}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign staff to class (Faculty Advisor)
// @route   PUT /api/hod/staff/:id/class
// @access  HOD
const assignStaffToClass = async (req, res) => {
    const { year, section, isFacultyAdvisor } = req.body;

    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        const staff = await User.findOne({
            _id: req.params.id,
            role: 'staff',
            managedBy: req.user.id
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found or not managed by you' });
        }

        if (isFacultyAdvisor) {
            // Check if another staff is already advisor for this class
            const existingAdvisor = await User.findOne({
                isFacultyAdvisor: true,
                'advisorClass.department': hod.assignedDepartment,
                'advisorClass.year': year,
                'advisorClass.section': section || null,
                _id: { $ne: req.params.id }
            });

            if (existingAdvisor) {
                return res.status(400).json({
                    message: `${existingAdvisor.name} is already the Faculty Advisor for this class`
                });
            }

            staff.isFacultyAdvisor = true;
            staff.advisorClass = {
                department: hod.assignedDepartment,
                year,
                section: section || null
            };
        } else {
            staff.isFacultyAdvisor = false;
            staff.advisorClass = { department: null, year: null, section: null };
        }

        await staff.save();

        res.json({
            message: isFacultyAdvisor
                ? `${staff.name} is now Faculty Advisor for ${hod.assignedDepartment} Year ${year}${section ? ` Section ${section}` : ''}`
                : `${staff.name} is no longer a Faculty Advisor`,
            staff: {
                _id: staff._id,
                name: staff.name,
                isFacultyAdvisor: staff.isFacultyAdvisor,
                advisorClass: staff.advisorClass
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get department statistics
// @route   GET /api/hod/stats
// @access  HOD
const getMyDepartmentStats = async (req, res) => {
    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        const totalStaff = await User.countDocuments({
            role: 'staff',
            department: hod.assignedDepartment,
            managedBy: req.user.id
        });

        const totalStudents = await User.countDocuments({
            role: 'student',
            department: hod.assignedDepartment
        });

        const facultyAdvisors = await User.countDocuments({
            role: 'staff',
            department: hod.assignedDepartment,
            isFacultyAdvisor: true,
            managedBy: req.user.id
        });

        const years = await User.distinct('year', {
            role: 'student',
            department: hod.assignedDepartment
        });

        res.json({
            department: hod.assignedDepartment,
            totalStaff,
            totalStudents,
            facultyAdvisors,
            years: years.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students in HOD's department
// @route   GET /api/hod/students
// @access  HOD
const getAllStudentsInDepartment = async (req, res) => {
    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        const students = await User.find({
            role: 'student',
            department: hod.assignedDepartment
        })
            .select('-password -faceEmbedding')
            .sort({ year: 1, section: 1, rollNumber: 1 });

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all classes in HOD's department
// @route   GET /api/hod/classes
// @access  HOD
const getDepartmentClasses = async (req, res) => {
    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        // Get all unique year-section combinations in the department
        const students = await User.aggregate([
            {
                $match: {
                    role: 'student',
                    department: hod.assignedDepartment
                }
            },
            {
                $group: {
                    _id: {
                        year: '$year',
                        section: '$section'
                    },
                    totalStudents: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.section': 1 }
            }
        ]);

        // Get today's attendance stats for each class
        const Attendance = require('../models/Attendance');
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const classesWithStats = await Promise.all(students.map(async (cls) => {
            const classStudents = await User.find({
                role: 'student',
                department: hod.assignedDepartment,
                year: cls._id.year,
                section: cls._id.section || { $exists: true }
            });

            const studentIds = classStudents.map(s => s._id);

            // Get today's attendance
            const todayAttendance = await Attendance.find({
                student: { $in: studentIds },
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            const presentCount = todayAttendance.filter(a => a.status === 'Present').length;
            const absentCount = todayAttendance.filter(a => a.status === 'Absent').length;

            // Get faculty advisor if any
            const advisor = await User.findOne({
                role: 'staff',
                isFacultyAdvisor: true,
                'advisorClass.department': hod.assignedDepartment,
                'advisorClass.year': cls._id.year,
                'advisorClass.section': cls._id.section || null
            }).select('name email');

            return {
                year: cls._id.year,
                section: cls._id.section || null,
                department: hod.assignedDepartment,
                totalStudents: cls.totalStudents,
                todayPresent: presentCount,
                todayAbsent: absentCount,
                attendancePercentage: cls.totalStudents > 0 ? Math.round(((presentCount / cls.totalStudents) * 100)) : 0,
                facultyAdvisor: advisor ? { name: advisor.name, email: advisor.email } : null
            };
        }));

        res.json(classesWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get period-wise attendance for a specific class
// @route   GET /api/hod/classes/attendance
// @access  HOD
const getClassPeriodAttendance = async (req, res) => {
    const { year, section, date } = req.query;

    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        // Get students in this class
        const studentQuery = {
            role: 'student',
            department: hod.assignedDepartment,
            year: year
        };
        if (section) studentQuery.section = section;

        const students = await User.find(studentQuery)
            .select('_id name rollNumber profilePhoto')
            .sort({ rollNumber: 1 });

        if (students.length === 0) {
            return res.json({ students: [], periods: [], classSummary: {} });
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
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        }

        const Attendance = require('../models/Attendance');
        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            date: { $gte: startDate, $lte: endDate }
        }).populate('student', 'name rollNumber');

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
            year,
            section: section || null,
            department: hod.assignedDepartment,
            students: result,
            periods,
            classSummary
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get detailed absentee list for a class, date, and period
// @route   GET /api/hod/classes/absentees
// @access  HOD
const getClassAbsentees = async (req, res) => {
    const { year, section, date, period } = req.query;

    if (!year || !date || !period) {
        return res.status(400).json({ message: 'Year, date, and period are required' });
    }

    try {
        const hod = await User.findById(req.user.id);
        if (!hod || !hod.assignedDepartment) {
            return res.status(400).json({ message: 'HOD not assigned to any department' });
        }

        // Get students in this class
        const studentQuery = {
            role: 'student',
            department: hod.assignedDepartment,
            year: year
        };
        if (section) studentQuery.section = section;

        const students = await User.find(studentQuery)
            .select('_id name rollNumber profilePhoto phone parentPhone email');

        const studentIds = students.map(s => s._id);

        // Get date range
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const Attendance = require('../models/Attendance');
        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            date: { $gte: startDate, $lte: endDate },
            period: period,
            status: 'Absent'
        }).populate('student');

        const absentees = attendanceRecords.map(a => ({
            _id: a.student._id,
            name: a.student.name,
            rollNumber: a.student.rollNumber,
            profilePhoto: a.student.profilePhoto,
            phone: a.student.phone,
            parentPhone: a.student.parentPhone,
            email: a.student.email,
            period: a.period,
            status: a.status,
            markedAt: a.time
        }));

        res.json({
            date: startDate.toISOString().split('T')[0],
            year,
            section: section || null,
            department: hod.assignedDepartment,
            period,
            totalStudents: students.length,
            absentCount: absentees.length,
            absentees
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllStaffInDepartment,
    createStaff,
    updateStaff,
    deleteStaff,
    resetStaffPassword,
    assignStaffToClass,
    getMyDepartmentStats,
    getAllStudentsInDepartment,
    getDepartmentClasses,
    getClassPeriodAttendance,
    getClassAbsentees
};
