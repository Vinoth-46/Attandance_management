const express = require('express');
const router = express.Router();
const {
    createSession,
    getActiveSessionsForStudent,
    getMySessions,
    getMyActiveSessions,
    closeSession,
    getMySessionReports
} = require('../controllers/sessionController');
const { protect, admin } = require('../middleware/authMiddleware');

// Staff routes
router.route('/')
    .post(protect, admin, createSession);

router.route('/my')
    .get(protect, admin, getMySessions);

router.route('/my/active')
    .get(protect, admin, getMyActiveSessions);

router.route('/my/reports')
    .get(protect, admin, getMySessionReports);

router.route('/:id/close')
    .put(protect, admin, closeSession);

// Student routes
router.route('/active')
    .get(protect, getActiveSessionsForStudent);

module.exports = router;
