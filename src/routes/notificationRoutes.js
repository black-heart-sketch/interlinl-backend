const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, markNotificationRead } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.patch('/:id/read', protect, markNotificationRead);

module.exports = router;
