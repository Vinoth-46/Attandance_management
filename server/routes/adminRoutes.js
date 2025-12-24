const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    addStudent,
    getStudents,
    getStudentDetails,
    updateStudent,
    toggleEditPermission,
    registerStudentFace,
    deleteStudent,
    bulkImportStudents,
    getMyClassStudents,
    getMyClassStats,
    searchStudents,
    toggleHOD,
    getAdvancedStats,
    getClassFilters,
    promoteStudents
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// Multer config for Excel file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
        }
    }
});

// Advanced Stats for Principal
router.route('/advanced-stats')
    .get(protect, admin, getAdvancedStats);

// Class filters (for cascading dropdowns)
router.route('/class-filters')
    .get(protect, admin, getClassFilters);

// Staff Management
router.route('/staff/:id/hod')
    .put(protect, admin, toggleHOD);

// Faculty Advisor - My Class routes
router.route('/myclass/students')
    .get(protect, admin, getMyClassStudents);

router.route('/myclass/stats')
    .get(protect, admin, getMyClassStats);

// Student search (limited info for identity verification - all staff can use)
router.route('/students/search')
    .get(protect, admin, searchStudents);

// Student promotion (year advancement)
router.route('/students/promote')
    .post(protect, admin, promoteStudents);

// Student management routes
router.route('/students')
    .post(protect, admin, addStudent)
    .get(protect, admin, getStudents);

router.route('/students/bulk')
    .post(protect, admin, upload.single('file'), bulkImportStudents);

router.route('/students/:id')
    .get(protect, admin, getStudentDetails)
    .put(protect, admin, updateStudent)
    .delete(protect, admin, deleteStudent);

router.route('/students/:id/face')
    .post(protect, admin, registerStudentFace);

router.route('/students/:id/permission')
    .put(protect, admin, toggleEditPermission);

module.exports = router;

