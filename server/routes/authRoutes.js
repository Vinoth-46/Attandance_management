const express = require('express');
const router = express.Router();
const { loginUser, getMyProfile, updateMyProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateMyProfile);
router.put('/password', protect, changePassword);

module.exports = router;
