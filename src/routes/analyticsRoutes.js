const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/analyticsController');

router.get('/', protect, authorize('admin', 'superadmin', 'manager'), controller.getAnalytics);
router.get('/portfolio/me', protect, controller.getPortfolio);
router.get('/portfolio/:internId', protect, authorize('admin', 'superadmin', 'manager', 'supervisor'), controller.getPortfolio);

module.exports = router;
