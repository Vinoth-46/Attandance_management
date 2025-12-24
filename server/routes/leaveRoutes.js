const express = require('express');
const router = express.Router();
const { applyLeave, getMyLeaves, getPendingLeaves, getApprovedLeaves, getRejectedLeaves, updateLeaveStatus } = require('../controllers/leaveController');
const { protect, facultyAdvisor } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, applyLeave); // Student apply

router.route('/my')
    .get(protect, getMyLeaves); // Student view

router.route('/pending')
    .get(protect, facultyAdvisor, getPendingLeaves); // Faculty Advisor view pending

router.route('/approved')
    .get(protect, facultyAdvisor, getApprovedLeaves); // Faculty Advisor view approved

router.route('/rejected')
    .get(protect, facultyAdvisor, getRejectedLeaves); // Faculty Advisor view rejected

router.route('/:id')
    .put(protect, facultyAdvisor, updateLeaveStatus); // Faculty Advisor approve/reject

module.exports = router;

