const express = require('express');
const router = express.Router();
const { completeProfile, updateProfile, getProfile, updatePhoto } = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');

// Profile routes for students
router.route('/complete-profile')
    .put(protect, completeProfile);

router.route('/profile')
    .get(protect, getProfile)
    .put(protect, updateProfile);

// Secure photo update with face verification
router.route('/update-photo')
    .put(protect, updatePhoto);

module.exports = router;
