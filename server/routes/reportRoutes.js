const express = require('express');
const router = express.Router();
const {
    getAttendanceSummary,
    exportToExcel,
    exportToPDF,
    getDailyReport
} = require('../controllers/reportController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require staff/admin
router.use(protect);
router.use(admin);

// Get attendance summary report
router.get('/summary', getAttendanceSummary);

// Export to Excel
router.get('/export/excel', exportToExcel);

// Export to PDF
router.get('/export/pdf', exportToPDF);

// Get daily attendance report
router.get('/daily', getDailyReport);

module.exports = router;
