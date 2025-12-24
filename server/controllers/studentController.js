const User = require('../models/User');

// Helper for Euclidean Distance
const getEuclideanDistance = (a, b) => {
    if (!a || !b || a.length !== b.length) return Infinity;
    return Math.sqrt(
        a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
};


// @desc    Complete student profile (bio data + face)
// @route   PUT /api/students/complete-profile
// @access  Student
const completeProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const {
            address, city, state, pincode,
            bloodGroup, fatherName, motherName,
            parentPhone, emergencyContact,
            faceDescriptor, profilePhoto
        } = req.body;

        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Update bio data
        student.address = address;
        student.city = city;
        student.state = state;
        student.pincode = pincode;
        student.bloodGroup = bloodGroup;
        student.fatherName = fatherName;
        student.motherName = motherName;
        student.parentPhone = parentPhone;
        student.emergencyContact = emergencyContact;

        // Update face data
        if (faceDescriptor && faceDescriptor.length > 0) {
            // Check for duplicate face
            const allStudents = await User.find({
                _id: { $ne: studentId }, // Exclude current user
                faceEmbedding: { $exists: true, $not: { $size: 0 } }
            }).select('name faceEmbedding');

            for (const otherStudent of allStudents) {
                const distance = getEuclideanDistance(faceDescriptor, otherStudent.faceEmbedding);
                if (distance < 0.6) { // same threshold as attendance
                    return res.status(400).json({
                        message: `This face is already registered to another student (${otherStudent.name}). Please use your own photo.`
                    });
                }
            }

            student.faceEmbedding = faceDescriptor;
        }
        if (profilePhoto) {
            student.profilePhoto = profilePhoto;
        }

        // Mark profile as complete and lock editing
        student.isProfileComplete = true;
        student.canEditProfile = false;

        await student.save();

        // Return updated student data (without password)
        const updatedStudent = student.toObject();
        delete updatedStudent.password;

        res.json(updatedStudent);
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student profile (if edit is enabled)
// @route   PUT /api/students/profile
// @access  Student
const updateProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if editing is allowed
        if (!student.canEditProfile && student.isProfileComplete) {
            return res.status(403).json({
                message: 'Profile editing is disabled. Contact your Faculty Advisor to enable editing.'
            });
        }

        const allowedFields = [
            'phone', 'address', 'city', 'state', 'pincode',
            'emergencyContact', 'parentPhone'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                student[field] = req.body[field];
            }
        });

        await student.save();

        const updatedStudent = student.toObject();
        delete updatedStudent.password;

        res.json(updatedStudent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student's own profile
// @route   GET /api/students/profile
// @access  Student
const getProfile = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('-password');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { completeProfile, updateProfile, getProfile };
