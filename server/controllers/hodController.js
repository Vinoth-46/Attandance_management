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

module.exports = {
    getAllStaffInDepartment,
    createStaff,
    updateStaff,
    deleteStaff,
    resetStaffPassword,
    assignStaffToClass,
    getMyDepartmentStats,
    getAllStudentsInDepartment
};
