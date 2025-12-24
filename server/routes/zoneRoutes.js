const express = require('express');
const router = express.Router();
const { getZones, createZone, deleteZone } = require('../controllers/zoneController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require authentication and admin/staff role
router.use(protect, admin);

router.get('/', getZones);
router.post('/', createZone);
router.delete('/:id', deleteZone);

module.exports = router;
