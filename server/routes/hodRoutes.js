const express = require('express');
const router = express.Router();
const {
    getAllStaffInDepartment,
    createStaff,
    updateStaff,
    deleteStaff,
    resetStaffPassword,
    assignStaffToClass,
    getMyDepartmentStats,
    getAllStudentsInDepartment
} = require('../controllers/hodController');
const { protect, hod } = require('../middleware/authMiddleware');

// All routes require HOD authentication
router.use(protect);
router.use(hod);

// Department statistics
router.route('/stats')
    .get(getMyDepartmentStats);

// Staff management in HOD's department
router.route('/staff')
    .get(getAllStaffInDepartment)
    .post(createStaff);

router.route('/staff/:id')
    .put(updateStaff)
    .delete(deleteStaff);

router.route('/staff/:id/password')
    .put(resetStaffPassword);

router.route('/staff/:id/class')
    .put(assignStaffToClass);

// Student overview in HOD's department
router.route('/students')
    .get(getAllStudentsInDepartment);

module.exports = router;
