const express = require('express');
const router = express.Router();
const { applyLeave, getMyLeaves, getPendingLeaves, getApprovedLeaves, getRejectedLeaves, getDeletedLeaves, updateLeaveStatus, deleteLeave, bulkDeleteLeaves } = require('../controllers/leaveController');
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

router.route('/deleted')
    .get(protect, facultyAdvisor, getDeletedLeaves); // Faculty Advisor view deleted

router.route('/bulk')
    .delete(protect, facultyAdvisor, bulkDeleteLeaves); // Bulk delete


router.route('/:id')
    .put(protect, facultyAdvisor, updateLeaveStatus) // Faculty Advisor approve/reject
    .delete(protect, facultyAdvisor, deleteLeave);   // Soft delete

module.exports = router;

