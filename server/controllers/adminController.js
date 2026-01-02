const User = require('../models/User');
const Attendance = require('../models/Attendance');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

// Helper for Euclidean Distance
const getEuclideanDistance = (a, b) => {
    if (!a || !b || a.length !== b.length) return Infinity;
    return Math.sqrt(
        a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
};

// @desc    Register a new student
// @route   POST /api/admin/students
// @access  Staff/Admin
const addStudent = async (req, res) => {
    const { name, rollNumber, department, year, section, dob, email, phone, parentPhone, profilePhoto } = req.body;

    try {
        const userExists = await User.findOne({
            $or: [{ email }, { rollNumber }]
        });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists (Email or Roll No)' });
        }

        // Hash DOB as password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(dob, salt);

        const user = await User.create({
            name,
            email,
            phone,
            role: 'student',
            password: hashedPassword,
            rollNumber,
            department,
            year,
            section,
            dob,
            parentPhone,
            profilePhoto,
            canEditProfile: false // Default: student cannot edit their profile
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                rollNumber: user.rollNumber,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Staff/Admin
const getStudents = async (req, res) => {
    try {
        const requestingStaff = await User.findById(req.user.id);

        // If faculty advisor with valid advisorClass, only show students from their assigned class
        // Need to check that advisorClass has actual non-empty values, not just an empty object
        const hasValidAdvisorClass = requestingStaff.advisorClass &&
            requestingStaff.advisorClass.department &&
            requestingStaff.advisorClass.year;

        if (requestingStaff.isFacultyAdvisor && hasValidAdvisorClass) {
            const { department, year, section } = requestingStaff.advisorClass;
            const query = {
                role: 'student',
                department,
                year
            };
            // Only add section filter if it has a value
            if (section) {
                query.section = section;
            }
            const students = await User.find(query).select('-password');
            return res.json(students);
        }

        // Super admin, HOD, or regular staff (including FA with invalid/empty advisorClass): show all students
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single student details
// @route   GET /api/admin/students/:id
// @access  Staff/Admin
const getStudentDetails = async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select('-password');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Not a student account' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student
// @route   PUT /api/admin/students/:id
// @access  Staff/Admin
const updateStudent = async (req, res) => {
    const {
        name, email, phone, department, year, section, parentPhone,
        address, city, state, pincode, bloodGroup, fatherName, motherName, emergencyContact,
        profilePhoto
    } = req.body;

    try {
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Can only update student accounts' });
        }

        // Update fields if provided
        if (name) student.name = name;
        if (email) student.email = email;
        if (phone) student.phone = phone;
        if (department) student.department = department;
        if (year) student.year = year;
        if (section) student.section = section;
        if (parentPhone) student.parentPhone = parentPhone;
        if (address !== undefined) student.address = address;
        if (city !== undefined) student.city = city;
        if (state !== undefined) student.state = state;
        if (pincode !== undefined) student.pincode = pincode;
        if (bloodGroup !== undefined) student.bloodGroup = bloodGroup;
        if (fatherName !== undefined) student.fatherName = fatherName;
        if (motherName !== undefined) student.motherName = motherName;
        if (emergencyContact !== undefined) student.emergencyContact = emergencyContact;
        if (profilePhoto !== undefined) student.profilePhoto = profilePhoto;

        const updatedStudent = await student.save();

        res.json({
            _id: updatedStudent._id,
            name: updatedStudent.name,
            email: updatedStudent.email,
            rollNumber: updatedStudent.rollNumber,
            department: updatedStudent.department,
            message: 'Student updated successfully'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle student edit permission
// @route   PUT /api/admin/students/:id/permission
// @access  Staff/Admin
const toggleEditPermission = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Can only modify student permissions' });
        }

        // Toggle the permission
        student.canEditProfile = !student.canEditProfile;
        await student.save();

        res.json({
            message: `Edit permission ${student.canEditProfile ? 'enabled' : 'disabled'} for ${student.name}`,
            canEditProfile: student.canEditProfile
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle student photo update permission
// @route   PUT /api/admin/students/:id/photo-permission
// @access  Staff/Admin
const togglePhotoPermission = async (req, res) => {
    const { enableAll } = req.body; // If true, enable for all students in filter

    try {
        // If enableAll is requested with optional filter
        if (enableAll !== undefined) {
            const filter = { role: 'student' };
            const result = await User.updateMany(filter, { $set: { canUpdatePhoto: enableAll } });
            return res.json({
                message: `Photo update permission ${enableAll ? 'enabled' : 'disabled'} for ${result.modifiedCount} students`,
                modifiedCount: result.modifiedCount
            });
        }

        // Single student toggle
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Can only modify student permissions' });
        }

        student.canUpdatePhoto = !student.canUpdatePhoto;
        await student.save();

        res.json({
            message: `Photo update permission ${student.canUpdatePhoto ? 'enabled' : 'disabled'} for ${student.name}`,
            canUpdatePhoto: student.canUpdatePhoto
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register student face embedding
// @route   POST /api/admin/students/:id/face
// @access  Staff/Admin
const registerStudentFace = async (req, res) => {
    const { faceDescriptor, profilePhoto } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
        return res.status(400).json({ message: 'Face descriptor array is required' });
    }

    try {
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Can only register face for student accounts' });
        }

        // Check for duplicate face
        const allStudents = await User.find({
            _id: { $ne: student._id },
            faceEmbedding: { $exists: true, $not: { $size: 0 } }
        }).select('name faceEmbedding');

        for (const otherStudent of allStudents) {
            const distance = getEuclideanDistance(faceDescriptor, otherStudent.faceEmbedding);
            if (distance < 0.4) {
                return res.status(400).json({
                    message: `This face is already registered to another student (${otherStudent.name}). Duplicate faces are not allowed.`
                });
            }
        }

        student.faceEmbedding = faceDescriptor;
        if (profilePhoto) {
            student.profilePhoto = profilePhoto; // Save the photo as profilePhoto
        }
        await student.save();

        res.json({
            message: 'Face registered successfully',
            studentId: student._id,
            studentName: student.name
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get students with pending photo update requests
// @route   GET /api/admin/students/pending-photos
// @access  Staff/Admin
const getPendingPhotoRequests = async (req, res) => {
    try {
        const students = await User.find({
            role: 'student',
            'pendingPhotoUpdate.requestedAt': { $exists: true }
        }).select('name rollNumber department year section profilePhoto pendingPhotoUpdate');

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve or reject pending photo update
// @route   PUT /api/admin/students/:id/approve-photo
// @access  Staff/Admin
const approvePendingPhoto = async (req, res) => {
    const { approve } = req.body; // true to approve, false to reject

    try {
        const student = await User.findById(req.params.id);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (!student.pendingPhotoUpdate || !student.pendingPhotoUpdate.requestedAt) {
            return res.status(400).json({ message: 'No pending photo request for this student' });
        }

        if (approve) {
            // Apply the pending photo update
            student.profilePhoto = student.pendingPhotoUpdate.photo;
            student.faceEmbedding = student.pendingPhotoUpdate.faceDescriptor;
            student.canUpdatePhoto = false; // Auto-disable after approval
        }

        // Clear pending request
        student.pendingPhotoUpdate = undefined;
        student.photoUpdateFailedAttempts = 0;

        await student.save();

        res.json({
            message: approve
                ? `Photo update approved for ${student.name}`
                : `Photo update rejected for ${student.name}`,
            approved: approve
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle HOD role
// @route   PUT /api/admin/staff/:id/hod
// @access  SuperAdmin
const toggleHOD = async (req, res) => {
    const { department } = req.body; // Required if enabling

    try {
        const staff = await User.findById(req.params.id);

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        if (staff.role === 'hod') {
            // Demote to staff
            staff.role = 'staff';
            staff.assignedDepartment = undefined;
        } else {
            // Promote to HOD
            if (!department) {
                return res.status(400).json({ message: 'Department is required to assign HOD' });
            }
            staff.role = 'hod';
            staff.assignedDepartment = department;
        }

        await staff.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to('staff').emit('staff:update', {
                type: 'hod_update',
                staffId: staff._id,
                name: staff.name,
                role: staff.role
            });
        }

        res.json({
            message: `Staff role updated to ${staff.role}`,
            role: staff.role,
            assignedDepartment: staff.assignedDepartment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete student
// @route   DELETE /api/admin/students/:id
// @access  Staff/Admin
const deleteStudent = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // SECURITY: Prevent IDOR - only allow deleting student accounts
        if (user.role !== 'student') {
            return res.status(403).json({ message: 'Cannot delete non-student accounts via this endpoint' });
        }

        await user.deleteOne();
        res.json({ message: 'Student removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk import students from Excel
// @route   POST /api/admin/students/bulk
// @access  Staff/Admin
const bulkImportStudents = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Parse Excel file using exceljs
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        // Convert worksheet to JSON-like array
        const data = [];
        const headers = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                // First row is headers
                row.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.value?.toString() || '';
                });
            } else {
                // Data rows
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        rowData[header] = cell.value;
                    }
                });
                if (Object.keys(rowData).length > 0) {
                    data.push(rowData);
                }
            }
        });

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = { success: [], errors: [] };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Excel row number (1-indexed + header)

            try {
                // Flexible column name mapping
                const name = row['Full Name'] || row['Name'] || row['name'] || row['fullName'];
                const rollNumber = row['Roll Number'] || row['RollNumber'] || row['rollNumber'] || row['Roll No'] || row['roll_number'];
                const email = row['Email'] || row['email'] || row['Email Address'];
                const dobRaw = row['Date of Birth'] || row['DOB'] || row['dob'] || row['DateOfBirth'];
                const department = row['Department'] || row['department'] || row['Dept'];
                const year = row['Year'] || row['year'];
                const section = row['Section'] || row['section'];
                const phone = row['Phone Number'] || row['Phone'] || row['phone'] || row['Mobile'];
                const parentPhone = row['Parent Phone'] || row['ParentPhone'] || row['parentPhone'] || row['Guardian Phone'];
                const profilePhoto = row['Profile Photo'] || row['profilePhoto'] || row['Photo'] || '';

                // Validate required fields
                if (!name || !rollNumber || !email || !dobRaw || !department || !year || !section) {
                    results.errors.push({ row: rowNum, rollNumber: rollNumber || 'N/A', error: 'Missing required fields' });
                    continue;
                }

                // Parse DOB - handle Excel date serial numbers
                let dob;
                if (typeof dobRaw === 'number') {
                    // Excel serial date number
                    const date = new Date((dobRaw - 25569) * 86400 * 1000);
                    dob = date.toISOString().split('T')[0]; // YYYY-MM-DD
                } else if (typeof dobRaw === 'string') {
                    dob = dobRaw;
                } else {
                    dob = new Date(dobRaw).toISOString().split('T')[0];
                }

                // Check if user already exists
                const existingUser = await User.findOne({
                    $or: [{ email }, { rollNumber }]
                });

                if (existingUser) {
                    results.errors.push({ row: rowNum, rollNumber, error: 'Email or Roll Number already exists' });
                    continue;
                }

                // Hash DOB as password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(dob, salt);

                // Create student
                const student = await User.create({
                    name,
                    email,
                    phone: phone?.toString() || '',
                    role: 'student',
                    password: hashedPassword,
                    rollNumber: rollNumber?.toString(),
                    department,
                    year: year?.toString(),
                    section: section?.toString(),
                    dob,
                    parentPhone: parentPhone?.toString() || '',
                    profilePhoto: profilePhoto || '',
                    canEditProfile: false
                });

                results.success.push({ row: rowNum, rollNumber, name: student.name });
            } catch (err) {
                results.errors.push({ row: rowNum, rollNumber: row['Roll Number'] || 'N/A', error: err.message });
            }
        }

        res.json({
            message: `Import complete. ${results.success.length} students added, ${results.errors.length} errors.`,
            totalRows: data.length,
            success: results.success,
            errors: results.errors
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get students for Faculty Advisor's class (FULL details)
// @route   GET /api/admin/myclass/students
// @access  Faculty Advisor
const getMyClassStudents = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id);

        if (!staff || !staff.isFacultyAdvisor) {
            return res.status(403).json({ message: 'Not a Faculty Advisor' });
        }

        const { department, year, section } = staff.advisorClass;

        const query = { role: 'student', department, year };
        if (section) query.section = section;

        const students = await User.find(query)
            .select('-password')
            .sort({ rollNumber: 1 });

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get attendance stats for Faculty Advisor's class
// @route   GET /api/admin/myclass/stats
// @access  Faculty Advisor
const getMyClassStats = async (req, res) => {
    try {
        const staff = await User.findById(req.user.id);

        if (!staff || !staff.isFacultyAdvisor) {
            return res.status(403).json({ message: 'Not a Faculty Advisor' });
        }

        const { department, year, section } = staff.advisorClass;

        const query = { role: 'student', department, year };
        if (section) query.section = section;

        const students = await User.find(query).select('_id name rollNumber');
        const studentIds = students.map(s => s._id);

        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get today's attendance
        const todayAttendance = await Attendance.find({
            student: { $in: studentIds },
            date: { $gte: today, $lt: tomorrow }
        }).populate('student', 'name rollNumber');

        const presentToday = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Half Day');
        const absentToday = todayAttendance.filter(a => a.status === 'Absent');

        // Students who haven't marked attendance today
        const markedIds = todayAttendance.map(a => a.student._id.toString());
        const notMarked = students.filter(s => !markedIds.includes(s._id.toString()));

        res.json({
            totalStudents: students.length,
            presentToday: presentToday.length,
            absentToday: absentToday.length,
            notMarkedToday: notMarked.length,
            absentees: absentToday.map(a => ({ name: a.student.name, rollNumber: a.student.rollNumber })),
            notMarkedList: notMarked.map(s => ({ name: s.name, rollNumber: s.rollNumber }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// SECURITY: Helper to escape regex special characters (prevent ReDoS)
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Search students (limited info for identity verification)
// @route   GET /api/admin/students/search?query=...
// @access  Staff
const searchStudents = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.json([]);
        }

        // SECURITY: Escape regex special characters to prevent ReDoS attacks
        const safeQuery = escapeRegex(query);
        const searchRegex = new RegExp(safeQuery, 'i');

        const students = await User.find({
            role: 'student',
            $or: [
                { name: searchRegex },
                { rollNumber: searchRegex }
            ]
        })
            .select('name rollNumber department year section profilePhoto') // Limited fields only
            .limit(10);

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get advanced statistics for Principal (SuperAdmin)
// @route   GET /api/superadmin/advanced-stats
// @access  SuperAdmin
const getAdvancedStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Department-wise Attendance for Today
        const allStudents = await User.find({ role: 'student' }).select('department');
        const totalStudentsByDept = {};
        allStudents.forEach(s => {
            if (s.department) {
                totalStudentsByDept[s.department] = (totalStudentsByDept[s.department] || 0) + 1;
            }
        });

        const todayAttendance = await Attendance.find({
            date: { $gte: today }
        }).populate('student', 'department');

        const presentByDept = {};
        todayAttendance.forEach(a => {
            if (a.student && a.student.department && (a.status === 'Present' || a.status === 'Half Day')) {
                presentByDept[a.student.department] = (presentByDept[a.student.department] || 0) + 1; // Count visits, or distinct students? Assuming 1 record per student per day usually, or take unique students
            }
        });

        const deptStats = Object.keys(totalStudentsByDept).map(dept => {
            const total = totalStudentsByDept[dept];
            const present = presentByDept[dept] || 0;
            const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
            return { department: dept, total, present, percentage };
        });

        // 2. Global Attendance (Today)
        const totalStudents = allStudents.length;
        // Unique students present today
        const uniquePresentIds = new Set(todayAttendance.filter(a => a.status === 'Present' || a.status === 'Half Day').map(a => a.student._id.toString()));
        const totalPresent = uniquePresentIds.size;
        const globalPercentage = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : 0;

        // 3. Low Attendance Students (Below 75% - Mock calculation or real aggregation)
        // For real aggregation, we need total days vs present days. That's heavy.
        // Alerting absentees for today is lighter.

        res.json({
            deptStats,
            globalStats: {
                totalStudents,
                totalPresent,
                percentage: globalPercentage
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get available class filters (departments, years, sections)
// @route   GET /api/admin/class-filters?department=CSE&year=First Year
// @access  Staff/Admin
const getClassFilters = async (req, res) => {
    try {
        const { department, year } = req.query;

        // Get all distinct departments
        const departments = await User.distinct('department', { role: 'student', department: { $ne: null, $ne: '' } });

        // Cascade: department → years
        let years = [];
        if (department) {
            years = await User.distinct('year', { role: 'student', department, year: { $ne: null, $ne: '' } });
        } else {
            years = await User.distinct('year', { role: 'student', year: { $ne: null, $ne: '' } });
        }

        // Cascade: department + year → sections
        let sections = [];
        if (department && year) {
            sections = await User.distinct('section', {
                role: 'student',
                department,
                year,
                section: { $ne: null, $ne: '' }
            });
        } else if (department) {
            sections = await User.distinct('section', { role: 'student', department, section: { $ne: null, $ne: '' } });
        }

        res.json({
            departments: departments.sort(),
            years: years.sort(),
            sections: sections.sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Promote students to next year
// @route   POST /api/admin/students/promote
// @access  SuperAdmin/Admin
const promoteStudents = async (req, res) => {
    const { department, fromYear, toYear } = req.body;

    if (!fromYear || !toYear) {
        return res.status(400).json({ message: 'fromYear and toYear are required' });
    }

    try {
        const query = { role: 'student', year: fromYear };
        if (department) {
            query.department = department;
        }

        const result = await User.updateMany(query, { $set: { year: toYear } });

        res.json({
            message: `Promoted ${result.modifiedCount} students from ${fromYear} to ${toYear}`,
            promoted: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addStudent,
    getStudents,
    getStudentDetails,
    updateStudent,
    toggleEditPermission,
    togglePhotoPermission,
    registerStudentFace,
    getPendingPhotoRequests,
    approvePendingPhoto,
    deleteStudent,
    bulkImportStudents,
    getMyClassStudents,
    getMyClassStats,
    searchStudents,
    toggleHOD,
    getAdvancedStats,
    getClassFilters,
    promoteStudents,
    resetStudentPassword
};

// @desc    Reset student password to DOB (DD-MM-YYYY)
// @route   PUT /api/admin/students/:id/reset-password
// @access  Staff/Admin
const resetStudentPassword = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Can only reset password for student accounts' });
        }

        if (!student.dob) {
            return res.status(400).json({ message: 'Student DOB not set, cannot reset password.' });
        }

        // Format DOB to DD-MM-YYYY string using UTC to avoid timezone shifts
        const dob = new Date(student.dob);
        const day = String(dob.getUTCDate()).padStart(2, '0');
        const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
        const year = dob.getUTCFullYear();

        const passwordString = `${day}-${month}-${year}`;

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(passwordString, salt);

        // Invalidate sessions
        student.sessionToken = require('crypto').randomUUID();

        await student.save();

        res.json({ message: `Password reset successfully to ${passwordString}` });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addStudent,
    getStudents,
    getStudentDetails,
    updateStudent,
    toggleEditPermission,
    togglePhotoPermission,
    registerStudentFace,
    getPendingPhotoRequests,
    approvePendingPhoto,
    deleteStudent,
    bulkImportStudents,
    getMyClassStudents,
    getMyClassStats,
    searchStudents,
    toggleHOD,
    getAdvancedStats,
    getClassFilters,
    promoteStudents,
    resetStudentPassword
};

