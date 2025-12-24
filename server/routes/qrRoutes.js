const express = require('express');
const router = express.Router();
const {
    generateQRCode,
    verifyQRAndMarkAttendance,
    getQRStatus,
    toggleQRMode
} = require('../controllers/qrController');
const { protect, admin } = require('../middleware/authMiddleware');

// Staff routes
router.post('/:sessionId/qr/generate', protect, admin, generateQRCode);
router.get('/:sessionId/qr/status', protect, admin, getQRStatus);
router.put('/:sessionId/qr/toggle', protect, admin, toggleQRMode);

// Student route - verify QR and mark attendance
router.post('/qr/verify', protect, verifyQRAndMarkAttendance);

module.exports = router;
