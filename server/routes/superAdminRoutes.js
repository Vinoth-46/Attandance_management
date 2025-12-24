const express = require('express');
const router = express.Router();
const {
    getAllStaff,
    createStaff,
    assignFacultyAdvisor,
    removeFacultyAdvisor,
    deleteStaff,
    getStats,
    resetStaffPassword,
    getAllHODs,
    createHOD,
    updateHOD,
    deleteHOD,
    assignDepartmentToHOD,
    resetHODPassword
} = require('../controllers/superAdminController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// All routes require super admin
router.use(protect);
router.use(superAdmin);

router.route('/stats')
    .get(getStats);

router.route('/staff')
    .get(getAllStaff)
    .post(createStaff);

router.route('/staff/:id')
    .delete(deleteStaff);

router.route('/staff/:id/password')
    .put(resetStaffPassword);

router.route('/staff/:id/advisor')
    .put(assignFacultyAdvisor)
    .delete(removeFacultyAdvisor);

// HOD Management Routes
router.route('/hods')
    .get(getAllHODs)
    .post(createHOD);

router.route('/hods/:id')
    .put(updateHOD)
    .delete(deleteHOD);

router.route('/hods/:id/password')
    .put(resetHODPassword);

router.route('/hods/:id/department')
    .put(assignDepartmentToHOD);

module.exports = router;
