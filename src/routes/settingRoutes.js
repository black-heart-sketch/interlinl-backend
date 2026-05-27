const express = require('express');
const router = express.Router();
const { getPublicSettings, getSettings, updateSettings } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/public', getPublicSettings);
router.get('/', protect, authorize('admin', 'superadmin'), getSettings);
router.put('/', protect, authorize('admin', 'superadmin'), updateSettings);

module.exports = router;
