const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get all staff members with their active/today's sessions
// @route   GET /api/superadmin/staff
// @access  Super Admin
const getAllStaff = async (req, res) => {
    try {
        const staffMembers = await User.find({ role: { $in: ['staff', 'admin'] } })
            .select('-password')
            .sort({ name: 1 })
            .lean(); // Use lean for better performance and modification

        // Get today's sessions
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

// @desc    Reset staff password
// @route   PUT /api/superadmin/staff/:id/password
// @access  Super Admin
const resetStaffPassword = async (req, res) => {
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const staff = await User.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const salt = await bcrypt.genSalt(10);
        staff.password = await bcrypt.hash(password, salt);
        await staff.save();

        res.json({ message: `Password updated for ${staff.name}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new staff member
// @route   POST /api/superadmin/staff
// @access  Super Admin
const createStaff = async (req, res) => {
    const { name, email, phone, staffId, password, department } = req.body;

    if (!name || !email || !staffId || !password) {
        return res.status(400).json({ message: 'Name, email, staffId, and password are required' });
    }

    try {
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
            department,
            role: 'staff',
            password: hashedPassword,
            isFacultyAdvisor: false
        });

        res.status(201).json({
            _id: staff._id,
            name: staff.name,
            email: staff.email,
            staffId: staff.staffId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign staff as Faculty Advisor
// @route   PUT /api/superadmin/staff/:id/advisor
// @access  Super Admin
const assignFacultyAdvisor = async (req, res) => {
    const { department, year, section } = req.body;

    if (!department || !year) {
        return res.status(400).json({ message: 'Department and year are required' });
    }

    try {
        // Check if another staff is already advisor for this class
        // treating null/undefined/"" section as the same thing
        const sectionQuery = section ? section : { $in: [null, '', undefined] };

        const existingAdvisor = await User.findOne({
            isFacultyAdvisor: true,
            'advisorClass.department': department,
            'advisorClass.year': year,
            'advisorClass.section': sectionQuery,
            _id: { $ne: req.params.id }
        });

        if (existingAdvisor) {
            return res.status(400).json({
                message: `${existingAdvisor.name} is already the Faculty Advisor for this class`
            });
        }

        const staff = await User.findById(req.params.id);
        if (!staff || !['staff', 'admin'].includes(staff.role)) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        staff.isFacultyAdvisor = true;
        staff.advisorClass = { department, year, section: section || null };
        await staff.save();

        res.json({
            message: `${staff.name} is now Faculty Advisor for ${department} Year ${year}${section ? ` Section ${section}` : ''}`,
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

// @desc    Remove Faculty Advisor role
// @route   DELETE /api/superadmin/staff/:id/advisor
// @access  Super Admin
const removeFacultyAdvisor = async (req, res) => {
    try {
        const staff = await User.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        staff.isFacultyAdvisor = false;
        staff.advisorClass = { department: null, year: null, section: null };
        await staff.save();

        res.json({ message: `${staff.name} is no longer a Faculty Advisor` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete staff member
// @route   DELETE /api/superadmin/staff/:id
// @access  Super Admin
const deleteStaff = async (req, res) => {
    try {
        const staff = await User.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        await staff.deleteOne();
        res.json({ message: 'Staff removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard stats for super admin
// @route   GET /api/superadmin/stats
// @access  Super Admin
const getStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalStaff = await User.countDocuments({ role: { $in: ['staff', 'admin'] } });
        const totalHODs = await User.countDocuments({ role: 'hod' });
        const facultyAdvisors = await User.countDocuments({ isFacultyAdvisor: true });
        const departments = await User.distinct('department', { role: 'student' });

        res.json({
            totalStudents,
            totalStaff,
            totalHODs,
            facultyAdvisors,
            departments: departments.filter(Boolean)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all HODs
// @route   GET /api/superadmin/hods
// @access  Super Admin
const getAllHODs = async (req, res) => {
    try {
        const hods = await User.find({ role: 'hod' })
            .select('-password')
            .sort({ name: 1 })
            .lean();

        // Get staff count for each HOD
        const hodsWithStats = await Promise.all(hods.map(async (hod) => {
            const staffCount = await User.countDocuments({
                role: 'staff',
                managedBy: hod._id
            });

            const studentCount = hod.assignedDepartment
                ? await User.countDocuments({
                    role: 'student',
                    department: hod.assignedDepartment
                })
                : 0;

            return {
                ...hod,
                staffCount,
                studentCount
            };
        }));

        res.json(hodsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new HOD
// @route   POST /api/superadmin/hods
// @access  Super Admin
const createHOD = async (req, res) => {
    const { name, email, phone, password, assignedDepartment } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!assignedDepartment) {
        return res.status(400).json({ message: 'Assigned department is required for HOD' });
    }

    try {
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Check if HOD already exists for this department
        const existingHOD = await User.findOne({
            role: 'hod',
            assignedDepartment
        });

        if (existingHOD) {
            return res.status(400).json({
                message: `${existingHOD.name} is already HOD for ${assignedDepartment} department`
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const hod = await User.create({
            name,
            email,
            phone,
            role: 'hod',
            password: hashedPassword,
            assignedDepartment
        });

        res.status(201).json({
            _id: hod._id,
            name: hod.name,
            email: hod.email,
            assignedDepartment: hod.assignedDepartment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update HOD details
// @route   PUT /api/superadmin/hods/:id
// @access  Super Admin
const updateHOD = async (req, res) => {
    const { name, email, phone } = req.body;

    try {
        const hod = await User.findOne({ _id: req.params.id, role: 'hod' });
        if (!hod) {
            return res.status(404).json({ message: 'HOD not found' });
        }

        if (name) hod.name = name;
        if (email) hod.email = email;
        if (phone) hod.phone = phone;

        await hod.save();

        res.json({
            _id: hod._id,
            name: hod.name,
            email: hod.email,
            phone: hod.phone,
            assignedDepartment: hod.assignedDepartment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign/Reassign department to HOD
// @route   PUT /api/superadmin/hods/:id/department
// @access  Super Admin
const assignDepartmentToHOD = async (req, res) => {
    const { assignedDepartment } = req.body;

    if (!assignedDepartment) {
        return res.status(400).json({ message: 'Department is required' });
    }

    try {
        const hod = await User.findOne({ _id: req.params.id, role: 'hod' });
        if (!hod) {
            return res.status(404).json({ message: 'HOD not found' });
        }

        // Check if another HOD is already assigned to this department
        const existingHOD = await User.findOne({
            role: 'hod',
            assignedDepartment,
            _id: { $ne: req.params.id }
        });

        if (existingHOD) {
            return res.status(400).json({
                message: `${existingHOD.name} is already HOD for ${assignedDepartment} department`
            });
        }

        hod.assignedDepartment = assignedDepartment;
        await hod.save();

        res.json({
            message: `${hod.name} is now HOD for ${assignedDepartment} department`,
            hod: {
                _id: hod._id,
                name: hod.name,
                assignedDepartment: hod.assignedDepartment
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete HOD
// @route   DELETE /api/superadmin/hods/:id
// @access  Super Admin
const deleteHOD = async (req, res) => {
    try {
        const hod = await User.findOne({ _id: req.params.id, role: 'hod' });
        if (!hod) {
            return res.status(404).json({ message: 'HOD not found' });
        }

        // Check if HOD has staff members
        const staffCount = await User.countDocuments({
            role: 'staff',
            managedBy: hod._id
        });

        if (staffCount > 0) {
            return res.status(400).json({
                message: `Cannot delete HOD. ${staffCount} staff members are managed by this HOD. Please reassign or delete them first.`
            });
        }

        await hod.deleteOne();
        res.json({ message: `HOD ${hod.name} removed` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset HOD password
// @route   PUT /api/superadmin/hods/:id/password
// @access  Super Admin
const resetHODPassword = async (req, res) => {
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const hod = await User.findOne({ _id: req.params.id, role: 'hod' });
        if (!hod) {
            return res.status(404).json({ message: 'HOD not found' });
        }

        const salt = await bcrypt.genSalt(10);
        hod.password = await bcrypt.hash(password, salt);
        await hod.save();

        res.json({ message: `Password updated for ${hod.name}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllStaff,
    createStaff,
    assignFacultyAdvisor,
    removeFacultyAdvisor,
    deleteStaff,
    getStats,
    resetStaffPassword,
    // HOD Management
    getAllHODs,
    createHOD,
    updateHOD,
    deleteHOD,
    assignDepartmentToHOD,
    resetHODPassword
};
