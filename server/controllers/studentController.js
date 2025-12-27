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
                if (distance < 0.4) { // Stricter threshold for duplicate detection
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

// @desc    Update student photo with face verification
// @route   PUT /api/students/update-photo
// @access  Student
const updatePhoto = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { newFaceDescriptor, newProfilePhoto, forceRequest } = req.body;

        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if photo update is allowed
        if (!student.canUpdatePhoto) {
            return res.status(403).json({
                message: 'Photo update is not enabled. Please contact your Faculty Advisor.',
                needsAdminApproval: true
            });
        }

        // If forceRequest is true, student is requesting staff approval after failed attempts
        if (forceRequest) {
            student.pendingPhotoUpdate = {
                photo: newProfilePhoto,
                faceDescriptor: newFaceDescriptor,
                requestedAt: new Date(),
                reason: 'Face verification failed multiple times'
            };
            await student.save();

            return res.json({
                message: 'Photo update request sent to admin for approval.',
                pendingApproval: true
            });
        }

        // Face verification: compare new face with old face
        if (!student.faceEmbedding || student.faceEmbedding.length === 0) {
            return res.status(400).json({
                message: 'No existing face data. Contact admin to register your photo.'
            });
        }

        if (!newFaceDescriptor || newFaceDescriptor.length === 0) {
            return res.status(400).json({ message: 'New face descriptor is required.' });
        }

        const distance = getEuclideanDistance(newFaceDescriptor, student.faceEmbedding);

        // Track failed attempts
        const failedAttempts = student.photoUpdateFailedAttempts || 0;

        if (distance >= 0.45) {
            // Face doesn't match - increment failed attempts
            student.photoUpdateFailedAttempts = failedAttempts + 1;
            await student.save();

            if (failedAttempts + 1 >= 4) {
                return res.status(400).json({
                    message: 'Face verification failed 4 times. You can now request admin approval.',
                    canRequestApproval: true,
                    failedAttempts: failedAttempts + 1
                });
            }

            return res.status(400).json({
                message: `Face doesn't match your registered photo. Attempt ${failedAttempts + 1}/4.`,
                failedAttempts: failedAttempts + 1,
                canRequestApproval: false
            });
        }

        // Face matches! Update photo
        student.faceEmbedding = newFaceDescriptor;
        student.profilePhoto = newProfilePhoto;

        // Auto-disable after successful update
        student.canUpdatePhoto = false;
        student.photoUpdateFailedAttempts = 0;

        await student.save();

        const updatedStudent = student.toObject();
        delete updatedStudent.password;

        res.json({
            message: 'Photo updated successfully! To change again, contact your administrator.',
            ...updatedStudent,
            photoUpdated: true
        });
    } catch (error) {
        console.error('Update photo error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { completeProfile, updateProfile, getProfile, updatePhoto };
