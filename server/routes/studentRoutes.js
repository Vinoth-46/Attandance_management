const express = require('express');
const router = express.Router();
const { completeProfile, updateProfile, getProfile } = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');

// Profile routes for students
router.route('/complete-profile')
    .put(protect, completeProfile);

router.route('/profile')
    .get(protect, getProfile)
    .put(protect, updateProfile);

module.exports = router;
