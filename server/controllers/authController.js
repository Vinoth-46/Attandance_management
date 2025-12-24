const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// SECURITY: Get JWT_SECRET from environment, with fallback only for development
const JWT_SECRET = process.env.JWT_SECRET || (
    process.env.NODE_ENV === 'production'
        ? null  // Will cause errors in production if not set
        : 'dev_secret_key_not_for_production'
);

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required!');
    process.exit(1);
}

const generateToken = (user, sessionToken) => {
    return jwt.sign({
        id: user._id,
        role: user.role,
        isFacultyAdvisor: user.isFacultyAdvisor || false,
        advisorClass: user.advisorClass || null,
        sessionToken: sessionToken
    }, JWT_SECRET, {
        expiresIn: '7d', // SECURITY: Reduced from 30d to 7d
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({
            $or: [{ rollNumber: username }, { staffId: username }, { email: username }]
        });

        if (user) {
            let isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // Generate a unique session token for this login
                const sessionToken = crypto.randomUUID();

                // Save the session token to the user document
                user.sessionToken = sessionToken;
                await user.save();

                const responseData = {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    canEditProfile: user.canEditProfile,
                    sessionToken: sessionToken, // Include in response for socket auth
                    token: generateToken(user, sessionToken),
                };

                // Add staff-specific fields (including HOD)
                if (['staff', 'hod', 'admin', 'superadmin'].includes(user.role)) {
                    responseData.isFacultyAdvisor = user.isFacultyAdvisor || false;
                    responseData.advisorClass = user.advisorClass || null;
                }

                // Add HOD-specific fields
                if (user.role === 'hod') {
                    responseData.assignedDepartment = user.assignedDepartment;
                }

                // Add student-specific fields
                if (user.role === 'student') {
                    responseData.isProfileComplete = user.isProfileComplete || false;
                    responseData.department = user.department;
                    responseData.year = user.year;
                    responseData.section = user.section;
                    responseData.rollNumber = user.rollNumber;
                }

                res.json(responseData);
                return;
            }
        }

        res.status(401).json({ message: 'Invalid credentials' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my profile
// @route   GET /api/auth/profile
// @access  Private
const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -faceEmbedding');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update my profile (students only, if permitted)
// @route   PUT /api/auth/profile
// @access  Private
const updateMyProfile = async (req, res) => {
    const {
        phone, address, city, state, pincode, bloodGroup,
        fatherName, motherName, emergencyContact, parentPhone
    } = req.body;

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if student has edit permission
        if (user.role === 'student' && !user.canEditProfile) {
            return res.status(403).json({ message: 'Edit permission not granted. Contact admin.' });
        }

        // Update allowed fields only (not name, email, rollNumber, department, year - those are admin-only)
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address;
        if (city !== undefined) user.city = city;
        if (state !== undefined) user.state = state;
        if (pincode !== undefined) user.pincode = pincode;
        if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
        if (fatherName !== undefined) user.fatherName = fatherName;
        if (motherName !== undefined) user.motherName = motherName;
        if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
        if (parentPhone !== undefined) user.parentPhone = parentPhone;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                city: user.city
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Change my password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found. Please re-login.' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'Password not set for this account.' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // SECURITY: Invalidate all existing sessions by generating new session token
        user.sessionToken = crypto.randomUUID();
        await user.save();

        res.json({
            message: 'Password updated successfully. Please login again with your new password.',
            requireRelogin: true
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Failed to change password. Please try again.' });
    }
};

module.exports = { loginUser, getMyProfile, updateMyProfile, changePassword };
