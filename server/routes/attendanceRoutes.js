const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/attendanceController');
const { protect, admin } = require('../middleware/authMiddleware');

// Student routes
router.route('/mark')
    .post(protect, markAttendance);

router.route('/my')
    .get(protect, getMyAttendance);

// Faculty Advisor routes
router.route('/fa/absentees')
    .get(protect, getFAAbsentees);

// Period-wise attendance report (FA and Super Admin)
router.route('/period-wise')
    .get(protect, admin, getPeriodWiseAttendance);

// Admin routes - Class-based attendance
router.route('/class/filters')
    .get(protect, admin, getClassFilters);

router.route('/class/students')
    .get(protect, admin, getClassStudents);

router.route('/class/status')
    .get(protect, admin, getClassAttendanceStatus);

router.route('/class/mark')
    .post(protect, admin, markClassAttendance);

// Admin routes
router.route('/manual')
    .post(protect, admin, markManualAttendance);

router.route('/students')
    .get(protect, admin, getStudentsForAttendance);

router.route('/report')
    .get(protect, admin, getAttendanceReport);

router.route('/update-status')
    .put(protect, admin, updateAttendanceStatus);

module.exports = router;
