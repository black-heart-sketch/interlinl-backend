const express = require('express');
const { createActivity, getActivities, deleteActivity } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, authorize('superadmin', 'admin', 'advisor', 'teacher'), getActivities)
  .post(protect, authorize('superadmin', 'admin', 'advisor', 'teacher'), createActivity);

router.route('/:id')
  .delete(protect, authorize('superadmin', 'admin'), deleteActivity);

module.exports = router;
