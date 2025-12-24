const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);

            // CRITICAL: Check if user still exists in database
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return res.status(401).json({
                    message: 'User no longer exists. Please login again.',
                    deleted: true
                });
            }

            // SECURITY: Validate session token (for single-device login and password change invalidation)
            if (decoded.sessionToken && user.sessionToken !== decoded.sessionToken) {
                return res.status(401).json({
                    message: 'Session expired. Please login again.',
                    sessionExpired: true
                });
            }

            req.user = decoded; // { id, role, isFacultyAdvisor, advisorClass }
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Staff or Admin middleware (includes HOD)
const admin = (req, res, next) => {
    if (req.user && (req.user.role === 'staff' || req.user.role === 'hod' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as staff' });
    }
};

// HOD only middleware
const hod = (req, res, next) => {
    if (req.user && req.user.role === 'hod') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as HOD' });
    }
};

// HOD or above (HOD, Admin, Super Admin)
const hodOrAbove = (req, res, next) => {
    if (req.user && (req.user.role === 'hod' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized. HOD access required.' });
    }
};

// Super Admin only middleware
const superAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as super admin' });
    }
};

// Faculty Advisor middleware (also allows superadmin)
const facultyAdvisor = (req, res, next) => {
    if (req.user && (req.user.isFacultyAdvisor || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized. Only Faculty Advisors can access leave requests.' });
    }
};

module.exports = { protect, admin, superAdmin, facultyAdvisor, hod, hodOrAbove };
