const express = require('express');
const router = express.Router();
const { getPublicSettings, updateSettings } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/public', getPublicSettings);
router.put('/', protect, authorize('admin', 'superadmin'), updateSettings);

module.exports = router;
